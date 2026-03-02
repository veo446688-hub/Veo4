import { readFile, unlink, readdir, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import ZAI from 'z-ai-web-dev-sdk'

// Database client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

// ZAI SDK instance
let zai: any = null

// Initialize ZAI SDK
async function initZAI() {
  try {
    zai = await ZAI.create()
    console.log('✓ ZAI SDK initialized successfully')
  } catch (error) {
    console.error('✗ Failed to initialize ZAI SDK:', error)
    throw error
  }
}

// Get MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop()
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff'
  }
  return mimeTypes[ext || ''] || 'image/jpeg'
}

// Read image and convert to base64
async function imageToBase64(imagePath: string): Promise<string> {
  try {
    const buffer = await readFile(imagePath)
    const mimeType = getMimeType(imagePath)
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  } catch (error) {
    console.error('Error reading image:', error)
    throw error
  }
}

// Poll task status until completion
async function pollTaskUntilComplete(taskId: string, maxPolls: number = 60): Promise<any> {
  let pollCount = 0
  const pollInterval = 5000 // 5 seconds

  while (pollCount < maxPolls) {
    try {
      const result = await zai.async.result.query(taskId)

      if (result.task_status === 'SUCCESS') {
        // Extract video URL from result
        const videoUrl = result.video_result?.[0]?.url ||
                        result.video_url ||
                        result.url ||
                        result.video

        if (!videoUrl) {
          throw new Error('Video URL not found in successful response')
        }

        return { success: true, url: videoUrl }
      }

      if (result.task_status === 'FAIL') {
        throw new Error('Video generation task failed')
      }

      // Still processing
      pollCount++
      console.log(`  Poll ${pollCount}/${maxPolls}: ${result.task_status}`)
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      if (pollCount >= maxPolls - 1) {
        throw error
      }
      // Continue polling on transient errors
      pollCount++
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error('Task polling timeout')
}

// Process a single video generation job
async function processJob(jobId: string, triggerData: any) {
  console.log(`\n📹 Processing job: ${jobId}`)
  console.log(`  Prompt: ${triggerData.prompt}`)
  console.log(`  Duration: ${triggerData.duration}s, FPS: ${triggerData.fps}`)
  console.log(`  Quality: ${triggerData.quality}, Resolution: ${triggerData.resolution}`)

  try {
    // Update job status to processing
    await prisma.videoJob.update({
      where: { id: jobId },
      data: { status: 'processing', progress: 20 }
    })

    // Read image and convert to base64
    const imagePath = join(process.cwd(), '..', '..', 'uploads', 'images', triggerData.imageFile)
    if (!existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`)
    }

    const base64Image = await imageToBase64(imagePath)
    console.log('  ✓ Image converted to base64')

    // Update progress
    await prisma.videoJob.update({
      where: { id: jobId },
      data: { progress: 30 }
    })

    // Create video generation task
    const task = await zai.video.generations.create({
      image_url: base64Image,
      prompt: triggerData.prompt,
      quality: triggerData.quality,
      duration: triggerData.duration,
      fps: triggerData.fps,
      size: triggerData.resolution
    })

    console.log(`  ✓ Video task created: ${task.id}`)

    // Update job with external task ID
    await prisma.videoJob.update({
      where: { id: jobId },
      data: { taskId: task.id, progress: 40 }
    })

    // Poll for results
    const result = await pollTaskUntilComplete(task.id, 80) // Allow up to ~7 minutes
    console.log('  ✓ Video generation completed')

    // Update job with success
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        videoUrl: result.url,
        completedAt: new Date()
      }
    })

    console.log(`✓ Job ${jobId} completed successfully`)

  } catch (error) {
    console.error(`✗ Job ${jobId} failed:`, error)

    // Update job with error
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }
}

// Process all pending trigger files
async function processPendingJobs() {
  const triggersDir = join(process.cwd(), '..', '..', 'queue', 'triggers')

  // Ensure triggers directory exists
  if (!existsSync(triggersDir)) {
    await mkdir(triggersDir, { recursive: true })
  }

  const files = await readdir(triggersDir)
  const triggerFiles = files.filter(f => f.endsWith('.trigger'))

  if (triggerFiles.length === 0) {
    return
  }

  console.log(`\n📋 Found ${triggerFiles.length} pending job(s)`)

  for (const file of triggerFiles) {
    const triggerPath = join(triggersDir, file)
    const jobId = file.replace('.trigger', '')

    try {
      // Read trigger data
      const content = await readFile(triggerPath, 'utf-8')
      const triggerData = JSON.parse(content)

      // Check if job still exists and is in queued status
      const job = await prisma.videoJob.findUnique({
        where: { id: jobId }
      })

      if (!job || job.status !== 'queued') {
        console.log(`  Skipping ${jobId}: job not found or already processed`)
        await unlink(triggerPath)
        continue
      }

      // Process the job
      await processJob(jobId, triggerData)

      // Clean up trigger file
      await unlink(triggerPath)
      console.log(`  ✓ Cleaned up trigger file: ${file}`)

    } catch (error) {
      console.error(`✗ Error processing trigger ${file}:`, error)
      // Don't delete trigger file on error, allow retry
    }
  }
}

// Main service loop
async function main() {
  console.log('🚀 Starting Video Processor Service...')
  console.log(`📁 Working directory: ${process.cwd()}`)

  // Initialize ZAI SDK
  await initZAI()

  // Process any existing pending jobs
  await processPendingJobs()

  // Set up interval to check for new jobs
  const checkInterval = 3000 // 3 seconds

  console.log(`\n✓ Service ready, checking for jobs every ${checkInterval / 1000}s`)

  setInterval(async () => {
    await processPendingJobs()
  }, checkInterval)

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })
}

// Start the service
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
