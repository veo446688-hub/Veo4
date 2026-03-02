import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// Configure for manual testing
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Function to get MIME type from URL
function getMimeTypeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase()
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

// Function to convert URL to base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    console.log(`[TEST] Fetching image from: ${imageUrl}`)
    const response = await fetch(imageUrl, { 
      signal: AbortSignal.timeout(30000) 
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const blob = await response.blob()
    console.log(`[TEST] Image blob size: ${blob.size} bytes`)
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = getMimeTypeFromUrl(imageUrl)
    const dataUri = `data:${mimeType};base64,${base64}`
    console.log(`[TEST] Converted to base64: ${dataUri.length} characters`)
    
    return dataUri
  } catch (error) {
    console.error('[TEST] Error converting image URL to base64:', error)
    throw error
  }
}

// Function to poll task status
async function pollTaskUntilComplete(zai: any, taskId: string, maxPolls: number = 80): Promise<any> {
  let pollCount = 0
  const pollInterval = 5000

  console.log(`[TEST] Starting to poll task ${taskId}, max attempts: ${maxPolls}`)

  while (pollCount < maxPolls) {
    try {
      const result = await zai.async.result.query(taskId)
      
      if (pollCount % 10 === 0 || result.task_status !== 'PROCESSING') {
        console.log(`[TEST] Poll ${pollCount}/${maxPolls}: Task ${taskId} status: ${result.task_status}`)
      }

      if (result.task_status === 'SUCCESS') {
        const videoUrl = result.video_result?.[0]?.url ||
                        result.video_url ||
                        result.url ||
                        result.video

        if (!videoUrl) {
          throw new Error('Video URL not found')
        }

        console.log(`[TEST] Task ${taskId} completed. Video URL: ${videoUrl}`)
        return { success: true, url: videoUrl }
      }

      if (result.task_status === 'FAIL') {
        throw new Error(`Video generation task failed for task ${taskId}`)
      }

      pollCount++
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      if (pollCount >= maxPolls - 1) {
        console.error(`[TEST] Polling failed for task ${taskId}:`, error)
        throw error
      }
      pollCount++
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error(`Task polling timeout for task ${taskId}`)
}

export async function POST(request: NextRequest) {
  console.log('='.repeat(60))
  console.log('TEST: Manual job processing triggered')
  console.log('='.repeat(60))

  try {
    // Find ONE queued job (oldest first)
    console.log('[TEST] Fetching oldest queued job...')
    const job = await db.videoJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' }
    })

    if (!job) {
      console.log('[TEST] No queued jobs found')
      return NextResponse.json({
        success: true,
        message: 'No queued jobs to process',
        processed: 0
      })
    }

    console.log('-'.repeat(60))
    console.log(`[TEST] Processing job: ${job.id}`)
    console.log(`[TEST] Prompt: ${job.prompt}`)
    console.log(`[TEST] Image URL: ${job.imageUrl || 'None'}`)
    console.log(`[TEST] Quality: ${job.quality}, Duration: ${job.duration}s, FPS: ${job.fps}`)
    console.log(`[TEST] Resolution: ${job.resolution}`)
    console.log('-'.repeat(60))

    // Update job status to processing
    console.log(`[TEST] Updating job ${job.id} status to 'processing'...`)
    await db.videoJob.update({
      where: { id: job.id },
      data: { status: 'processing', progress: 30 }
    })
    console.log(`[TEST] Job ${job.id} updated to processing (30%)`)

    // Initialize ZAI SDK
    console.log('[TEST] Initializing ZAI SDK...')
    let zai: any
    try {
      zai = await ZAI.create()
      console.log('[TEST] ZAI SDK initialized successfully')
    } catch (sdkError) {
      console.error('[TEST] Failed to initialize ZAI SDK:', sdkError)
      throw new Error(`ZAI SDK initialization failed: ${sdkError instanceof Error ? sdkError.message : 'Unknown error'}`)
    }

    // Convert image URL to base64
    let base64Image: string | undefined

    if (job.imageUrl) {
      try {
        console.log('[TEST] Converting image URL to base64...')
        base64Image = await imageUrlToBase64(job.imageUrl)
        console.log('[TEST] Image successfully converted to base64')
      } catch (imageError) {
        console.error('[TEST] Failed to fetch image, falling back to text-to-video:', imageError)
        base64Image = undefined
      }
    } else {
      console.log('[TEST] No image URL, using text-to-video generation')
    }

    // Create video generation task
    const taskParams: any = {
      prompt: job.prompt,
      quality: job.quality as any,
      duration: job.duration as any,
      fps: job.fps as any,
      size: job.resolution as any
    }

    if (base64Image) {
      taskParams.image_url = base64Image
      console.log('[TEST] Creating image-to-video task')
    } else {
      console.log('[TEST] Creating text-to-video task')
    }

    console.log('[TEST] Creating video generation task with ZAI SDK...')
    const task = await zai.video.generations.create(taskParams)
    console.log(`[TEST] Video task created: ${task.id}`)

    // Update job with task ID
    console.log(`[TEST] Updating job ${job.id} with task ID...`)
    await db.videoJob.update({
      where: { id: job.id },
      data: { taskId: task.id, progress: 50 }
    })
    console.log(`[TEST] Job ${job.id} updated (50%)`)

    // Poll for results
    console.log('[TEST] Polling for video generation results...')
    const result = await pollTaskUntilComplete(zai, task.id, 80)

    console.log(`[TEST] Video generation completed! URL: ${result.url}`)

    // Update job with success
    console.log(`[TEST] Updating job ${job.id} to completed...`)
    await db.videoJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        videoUrl: result.url,
        completedAt: new Date()
      }
    })
    console.log(`[TEST] Job ${job.id} marked as completed (100%)`)
    console.log('✅ TEST: Job processed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Job processed successfully',
      jobId: job.id,
      videoUrl: result.url
    })

  } catch (error) {
    console.error('='.repeat(60))
    console.error('TEST: FATAL ERROR:', error)
    console.error('='.repeat(60))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
