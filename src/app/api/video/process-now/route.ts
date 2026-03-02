import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZAIClient } from '@/lib/zai-client'

// Configure for dynamic execution
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
    console.log(`[PROCESS-NOW] Fetching image from: ${imageUrl}`)
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(30000)
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const blob = await response.blob()
    console.log(`[PROCESS-NOW] Image blob size: ${blob.size} bytes`)
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = getMimeTypeFromUrl(imageUrl)
    const dataUri = `data:${mimeType};base64,${base64}`
    console.log(`[PROCESS-NOW] Converted to base64: ${dataUri.length} characters`)

    return dataUri
  } catch (error) {
    console.error('[PROCESS-NOW] Error converting image URL to base64:', error)
    throw error
  }
}

// Function to poll task status until completion
async function pollTaskUntilComplete(zai: any, taskId: string, maxPolls: number = 100): Promise<any> {
  let pollCount = 0
  const pollInterval = 5000 // 5 seconds

  console.log(`[PROCESS-NOW] Starting to poll task ${taskId}, max attempts: ${maxPolls}`)

  while (pollCount < maxPolls) {
    try {
      const result = await zai.async.result.query(taskId)

      if (pollCount % 10 === 0 || result.task_status !== 'PROCESSING') {
        console.log(`[PROCESS-NOW] Poll ${pollCount}/${maxPolls}: Task ${taskId} status: ${result.task_status}`)
      }

      if (result.task_status === 'SUCCESS') {
        // Extract video URL from result
        const videoUrl = result.video_result?.[0]?.url ||
                        result.video_url ||
                        result.url ||
                        result.video

        if (!videoUrl) {
          throw new Error('Video URL not found in successful response')
        }

        console.log(`[PROCESS-NOW] Task ${taskId} completed successfully. Video URL: ${videoUrl}`)
        return { success: true, url: videoUrl }
      }

      if (result.task_status === 'FAIL') {
        throw new Error(`Video generation task failed for task ${taskId}`)
      }

      // Still processing
      pollCount++

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      if (pollCount >= maxPolls - 1) {
        console.error(`[PROCESS-NOW] Polling failed for task ${taskId}:`, error)
        throw error
      }
      // Continue polling on transient errors
      pollCount++
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error(`Task polling timeout for task ${taskId}`)
}

// Main handler
export async function POST(request: NextRequest) {
  console.log('='.repeat(60))
  console.log('[PROCESS-NOW] Immediate job processing triggered')
  console.log('='.repeat(60))

  try {
    const body = await request.json()
    const { jobId } = body

    if (!jobId) {
      return NextResponse.json(
        { success: false, message: 'Job ID is required' },
        { status: 400 }
      )
    }

    console.log(`[PROCESS-NOW] Processing job: ${jobId}`)

    // Fetch the job
    const job = await db.videoJob.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      console.error(`[PROCESS-NOW] Job not found: ${jobId}`)
      return NextResponse.json(
        { success: false, message: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if job is already processed
    if (job.status === 'completed') {
      console.log(`[PROCESS-NOW] Job ${jobId} already completed`)
      return NextResponse.json({
        success: true,
        message: 'Job already completed',
        status: 'completed',
        videoUrl: job.videoUrl
      })
    }

    if (job.status === 'processing') {
      console.log(`[PROCESS-NOW] Job ${jobId} is already being processed`)
      return NextResponse.json({
        success: true,
        message: 'Job is already being processed',
        status: 'processing',
        progress: job.progress
      })
    }

    if (job.status === 'failed') {
      console.log(`[PROCESS-NOW] Job ${jobId} previously failed, retrying...`)
    }

    console.log(`[PROCESS-NOW] Job details:`, {
      id: job.id,
      prompt: job.prompt.substring(0, 50),
      imageUrl: job.imageUrl?.substring(0, 50),
      quality: job.quality,
      duration: job.duration,
      fps: job.fps,
      resolution: job.resolution
    })

    // Update job status to processing
    console.log(`[PROCESS-NOW] Updating job ${job.id} status to 'processing'...`)
    await db.videoJob.update({
      where: { id: job.id },
      data: { status: 'processing', progress: 20 }
    })

    // Initialize ZAI SDK
    console.log('[PROCESS-NOW] Initializing ZAI SDK...')
    let zai: any
    try {
      zai = await getZAIClient()
      console.log('[PROCESS-NOW] ✅ ZAI SDK initialized successfully')
    } catch (sdkError) {
      console.error('[PROCESS-NOW] ❌ Failed to initialize ZAI SDK:', sdkError)

      // Update job with error
      await db.videoJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: sdkError instanceof Error ? sdkError.message : 'ZAI SDK initialization failed'
        }
      })

      return NextResponse.json(
        {
          success: false,
          error: sdkError instanceof Error ? sdkError.message : 'ZAI SDK initialization failed',
          message: 'Video generation failed. Please ensure ZAI environment variables are configured in Vercel.'
        },
        { status: 500 }
      )
    }

    // Update progress
    await db.videoJob.update({
      where: { id: job.id },
      data: { progress: 30 }
    })

    // Convert image URL to base64 for AI processing
    let base64Image: string | undefined

    if (job.imageUrl) {
      try {
        console.log('[PROCESS-NOW] Converting image URL to base64...')
        base64Image = await imageUrlToBase64(job.imageUrl)
        console.log('[PROCESS-NOW] ✅ Image successfully converted to base64')
      } catch (imageError) {
        console.error('[PROCESS-NOW] Failed to fetch/convert image:', imageError)
        console.log('[PROCESS-NOW] Falling back to text-to-video generation')
        base64Image = undefined
      }
    } else {
      console.log('[PROCESS-NOW] No image URL, using text-to-video generation')
    }

    // Update progress
    await db.videoJob.update({
      where: { id: job.id },
      data: { progress: 40 }
    })

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
      console.log('[PROCESS-NOW] Creating image-to-video task')
    } else {
      console.log('[PROCESS-NOW] Creating text-to-video task')
    }

    console.log('[PROCESS-NOW] Task parameters:', {
      hasImage: !!base64Image,
      prompt: job.prompt.substring(0, 50),
      quality: job.quality,
      duration: job.duration,
      fps: job.fps,
      resolution: job.resolution
    })

    console.log('[PROCESS-NOW] Creating video generation task with ZAI SDK...')
    const task = await zai.video.generations.create(taskParams)
    console.log(`[PROCESS-NOW] ✅ Video task created: ${task.id}`)

    // Update job with external task ID and progress
    console.log(`[PROCESS-NOW] Updating job ${job.id} with task ID...`)
    await db.videoJob.update({
      where: { id: job.id },
      data: { taskId: task.id, progress: 50 }
    })
    console.log(`[PROCESS-NOW] Job ${job.id} updated (50%)`)

    // Poll for results
    console.log('[PROCESS-NOW] Polling for video generation results...')
    const result = await pollTaskUntilComplete(zai, task.id, 100)

    console.log(`[PROCESS-NOW] ✅ Video generation completed! URL: ${result.url}`)

    // Update job with success
    console.log(`[PROCESS-NOW] Updating job ${job.id} to completed...`)
    await db.videoJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        videoUrl: result.url,
        completedAt: new Date()
      }
    })
    console.log(`[PROCESS-NOW] ✅ Job ${job.id} marked as completed (100%)`)
    console.log('[PROCESS-NOW] ✅ Job processed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Video generated successfully',
      jobId: job.id,
      videoUrl: result.url
    })

  } catch (error) {
    console.error('[PROCESS-NOW] FATAL ERROR:', error)

    // Try to update job with error if we have a jobId
    try {
      const body = await request.clone().json()
      if (body.jobId) {
        await db.videoJob.update({
          where: { id: body.jobId },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    } catch (updateError) {
      // Ignore if we can't update
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
