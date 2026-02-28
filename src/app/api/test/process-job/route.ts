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
    const response = await fetch(imageUrl, { 
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

// Function to poll task status
async function pollTaskUntilComplete(zai: any, taskId: string, maxPolls: number = 80): Promise<any> {
  let pollCount = 0
  const pollInterval = 5000

  while (pollCount < maxPolls) {
    try {
      const result = await zai.async.result.query(taskId)

      if (result.task_status === 'SUCCESS') {
        const videoUrl = result.video_result?.[0]?.url ||
                        result.video_url ||
                        result.url ||
                        result.video

        if (!videoUrl) {
          throw new Error('Video URL not found')
        }

        return { success: true, url: videoUrl }
      }

      if (result.task_status === 'FAIL') {
        throw new Error('Video generation task failed')
      }

      pollCount++
      console.log(`Test: Poll ${pollCount}/${maxPolls} for task ${taskId}: ${result.task_status}`)
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      if (pollCount >= maxPolls - 1) {
        throw error
      }
      pollCount++
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error('Task polling timeout')
}

export async function POST(request: NextRequest) {
  console.log('Test: Manual job processing triggered')

  try {
    // Find ONE queued job (oldest first)
    console.log('Test: Fetching oldest queued job...')
    const job = await db.videoJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' }
    })

    if (!job) {
      console.log('Test: No queued jobs found')
      return NextResponse.json({
        success: true,
        message: 'No queued jobs to process',
        processed: 0
      })
    }

    console.log(`Test: Processing job ${job.id}`)
    console.log(`Test: Job details:`, {
      id: job.id,
      prompt: job.prompt,
      hasImageUrl: !!job.imageUrl,
      quality: job.quality,
      duration: job.duration,
      fps: job.fps,
      resolution: job.resolution
    })

    // Update job status to processing
    await db.videoJob.update({
      where: { id: job.id },
      data: { status: 'processing', progress: 30 }
    })
    console.log(`Test: Job ${job.id} status updated to processing`)

    // Initialize ZAI SDK
    console.log('Test: Initializing ZAI SDK...')
    const zai = await ZAI.create()
    console.log('Test: ZAI SDK initialized successfully')

    // Convert image URL to base64
    let base64Image: string | undefined

    if (job.imageUrl) {
      console.log(`Test: Fetching image from ${job.imageUrl}`)
      try {
        base64Image = await imageUrlToBase64(job.imageUrl)
        console.log(`Test: Image converted to base64 (${base64Image.length} chars)`)
      } catch (imageError) {
        console.error(`Test: Failed to fetch image, falling back to text-to-video:`, imageError)
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

    if (base64Image) {
      taskParams.image_url = base64Image
      console.log('Test: Using image-to-video generation')
    } else {
      console.log('Test: Using text-to-video generation (no image)')
    }

    console.log(`Test: Creating video task...`)
    const task = await zai.video.generations.create(taskParams)
    console.log(`Test: Created video task ${task.id}`)

    // Update job with task ID
    await db.videoJob.update({
      where: { id: job.id },
      data: { taskId: task.id, progress: 50 }
    })

    // Poll for results
    console.log(`Test: Polling for video generation...`)
    const result = await pollTaskUntilComplete(zai, task.id, 80)

    console.log(`Test: Video generation completed: ${result.url}`)

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

    console.log(`Test: Job ${job.id} completed successfully`)

    return NextResponse.json({
      success: true,
      message: 'Job processed successfully',
      jobId: job.id,
      videoUrl: result.url
    })

  } catch (error) {
    console.error('Test: Error processing job:', error)

    // If we have a job ID, update it as failed
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    
    if (jobId) {
      try {
        await db.videoJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      } catch (updateError) {
        console.error('Test: Failed to update job status:', updateError)
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
