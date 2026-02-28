import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// Configure for Vercel Cron Jobs
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

// Function to convert URL to base64 (for image-to-video)
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl, { 
      // Increase timeout for large images
      signal: AbortSignal.timeout(30000) 
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = getMimeTypeFromUrl(imageUrl)

    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('Error converting image URL to base64:', error)
    throw error
  }
}

// Function to poll task status until completion
async function pollTaskUntilComplete(zai: any, taskId: string, maxPolls: number = 80): Promise<any> {
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
      if (pollCount % 10 === 0) { // Log every 10 polls
        console.log(`Cron: Poll ${pollCount}/${maxPolls} for task ${taskId}: ${result.task_status}`)
      }

      // Wait before next poll
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

export async function GET(request: NextRequest) {
  // Security check: Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('Cron: Unauthorized access attempt')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  console.log('Cron: Starting job processing...')

  try {
    // Find queued jobs
    console.log('Cron: Fetching queued jobs from database...')
    const queuedJobs = await db.videoJob.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 1 // Process 1 job at a time to avoid timeouts
    })

    console.log(`Cron: Found ${queuedJobs.length} queued job(s)`)

    if (queuedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No queued jobs to process',
        processed: 0
      })
    }

    // Initialize ZAI SDK
    console.log('Cron: Initializing ZAI SDK...')
    const zai = await ZAI.create()
    console.log('Cron: ZAI SDK initialized successfully')

    let processedCount = 0
    let failedCount = 0

    for (const job of queuedJobs) {
      console.log(`Cron: Processing job ${job.id}`)
      console.log(`Cron: Job details:`, {
        id: job.id,
        prompt: job.prompt.substring(0, 50),
        hasImageUrl: !!job.imageUrl,
        quality: job.quality,
        duration: job.duration
      })

      try {
        // Update job status to processing
        await db.videoJob.update({
          where: { id: job.id },
          data: { status: 'processing', progress: 30 }
        })
        console.log(`Cron: Job ${job.id} status updated to processing`)

        // Convert image URL to base64 for AI processing
        let base64Image: string | undefined

        if (job.imageUrl) {
          console.log(`Cron: Fetching image from ${job.imageUrl}`)
          try {
            base64Image = await imageUrlToBase64(job.imageUrl)
            console.log(`Cron: Image converted to base64 (${base64Image.length} chars)`)
          } catch (imageError) {
            console.error(`Cron: Failed to fetch/convert image:`, imageError)
            // Fall back to text-to-video if image fetch fails
            console.log(`Cron: Falling back to text-to-video generation`)
          }
        }

        // Create video generation task
        const taskParams: any = {
          prompt: job.prompt,
          quality: job.quality as any,
          duration: job.duration as any,
          fps: job.fps as any,
          size: job.resolution as any
        }

        // Add image if we successfully converted it
        if (base64Image) {
          taskParams.image_url = base64Image
        }

        console.log(`Cron: Creating video task with params:`, {
          hasImage: !!base64Image,
          prompt: job.prompt.substring(0, 50),
          quality: job.quality,
          duration: job.duration,
          fps: job.fps,
          resolution: job.resolution
        })

        const task = await zai.video.generations.create(taskParams)

        console.log(`Cron: Created video task ${task.id}`)

        // Update job with external task ID
        await db.videoJob.update({
          where: { id: job.id },
          data: { taskId: task.id, progress: 50 }
        })
        console.log(`Cron: Job ${job.id} updated with task ID ${task.id}`)

        // Poll for results
        console.log(`Cron: Starting to poll for video generation results...`)
        const result = await pollTaskUntilComplete(zai, task.id, 80)

        console.log(`Cron: Job ${job.id} completed successfully, video URL: ${result.url}`)

        // Update job with success
        await db.videoJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            videoUrl: result.url,
            completedAt: new Date()
          }
        })
        console.log(`Cron: Job ${job.id} marked as completed`)

        processedCount++

      } catch (error) {
        console.error(`Cron: Job ${job.id} failed:`, error)
        
        // Update job with error
        await db.videoJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
        console.log(`Cron: Job ${job.id} marked as failed`)

        failedCount++
      }
    }

    console.log(`Cron: Completed - Processed: ${processedCount}, Failed: ${failedCount}`)

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} jobs successfully, ${failedCount} failed`,
      processed: processedCount,
      failed: failedCount,
      total: queuedJobs.length
    })

  } catch (error) {
    console.error('Cron: Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}
