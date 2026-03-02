import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZAIClient } from '@/lib/zai-client'

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
    console.log(`Fetching image from: ${imageUrl}`)
    const response = await fetch(imageUrl, { 
      signal: AbortSignal.timeout(30000) 
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const blob = await response.blob()
    console.log(`Image blob size: ${blob.size} bytes`)
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = getMimeTypeFromUrl(imageUrl)
    const dataUri = `data:${mimeType};base64,${base64}`
    console.log(`Converted to base64: ${dataUri.length} characters`)
    
    return dataUri
  } catch (error) {
    console.error('Error converting image URL to base64:', error)
    throw error
  }
}

// Function to poll task status until completion
async function pollTaskUntilComplete(zai: any, taskId: string, maxPolls: number = 80): Promise<any> {
  let pollCount = 0
  const pollInterval = 5000 // 5 seconds

  console.log(`Starting to poll task ${taskId}, max attempts: ${maxPolls}`)

  while (pollCount < maxPolls) {
    try {
      const result = await zai.async.result.query(taskId)
      
      if (pollCount % 10 === 0 || result.task_status !== 'PROCESSING') {
        console.log(`Poll ${pollCount}/${maxPolls}: Task ${taskId} status: ${result.task_status}`)
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

        console.log(`Task ${taskId} completed successfully. Video URL: ${videoUrl}`)
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
        console.error(`Polling failed for task ${taskId}:`, error)
        throw error
      }
      // Continue polling on transient errors
      pollCount++
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error(`Task polling timeout for task ${taskId}`)
}

// Main handler - removed CRON_SECRET requirement for testing
export async function GET(request: NextRequest) {
  console.log('='.repeat(60))
  console.log('CRON JOB: Starting job processing...')
  console.log('='.repeat(60))

  try {
    // Find queued jobs
    console.log('Fetching queued jobs from database...')
    const queuedJobs = await db.videoJob.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 1 // Process 1 job at a time for stability
    })

    console.log(`Found ${queuedJobs.length} queued job(s)`)

    if (queuedJobs.length === 0) {
      console.log('No queued jobs to process. Exiting.')
      return NextResponse.json({
        success: true,
        message: 'No queued jobs to process',
        processed: 0
      })
    }

    // Initialize ZAI SDK using the utility function
    console.log('Initializing ZAI SDK...')
    let zai: any
    try {
      zai = await getZAIClient()
      console.log('ZAI SDK initialized successfully')
    } catch (sdkError) {
      console.error('Failed to initialize ZAI SDK:', sdkError)

      // Update all queued jobs with configuration error
      for (const job of queuedJobs) {
        await db.videoJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: sdkError instanceof Error ? sdkError.message : 'ZAI SDK initialization failed'
          }
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: sdkError instanceof Error ? sdkError.message : 'ZAI SDK initialization failed'
        },
        { status: 500 }
      )
    }

    let processedCount = 0
    let failedCount = 0

    for (const job of queuedJobs) {
      console.log('-'.repeat(60))
      console.log(`Processing job: ${job.id}`)
      console.log(`Prompt: ${job.prompt}`)
      console.log(`Image URL: ${job.imageUrl || 'None'}`)
      console.log(`Quality: ${job.quality}, Duration: ${job.duration}s, FPS: ${job.fps}`)
      console.log('-'.repeat(60))

      try {
        // Update job status to processing
        console.log(`Updating job ${job.id} status to 'processing'...`)
        await db.videoJob.update({
          where: { id: job.id },
          data: { status: 'processing', progress: 30 }
        })
        console.log(`Job ${job.id} status updated to processing (30%)`)

        // Convert image URL to base64 for AI processing
        let base64Image: string | undefined

        if (job.imageUrl) {
          try {
            console.log('Converting image URL to base64...')
            base64Image = await imageUrlToBase64(job.imageUrl)
            console.log('Image successfully converted to base64')
          } catch (imageError) {
            console.error('Failed to fetch/convert image:', imageError)
            console.log('Falling back to text-to-video generation')
            base64Image = undefined
          }
        } else {
          console.log('No image URL, using text-to-video generation')
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
          console.log('Creating image-to-video task')
        } else {
          console.log('Creating text-to-video task')
        }

        console.log('Task parameters:', {
          hasImage: !!base64Image,
          prompt: job.prompt.substring(0, 50),
          quality: job.quality,
          duration: job.duration,
          fps: job.fps,
          resolution: job.resolution
        })

        console.log('Creating video generation task with ZAI SDK...')
        const task = await zai.video.generations.create(taskParams)
        console.log(`Video task created: ${task.id}`)

        // Update job with external task ID
        console.log(`Updating job ${job.id} with task ID...`)
        await db.videoJob.update({
          where: { id: job.id },
          data: { taskId: task.id, progress: 50 }
        })
        console.log(`Job ${job.id} updated (50%)`)

        // Poll for results
        console.log('Polling for video generation results...')
        const result = await pollTaskUntilComplete(zai, task.id, 80)

        console.log(`Video generation completed! URL: ${result.url}`)

        // Update job with success
        console.log(`Updating job ${job.id} to completed...`)
        await db.videoJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            videoUrl: result.url,
            completedAt: new Date()
          }
        })
        console.log(`Job ${job.id} marked as completed (100%)`)
        console.log('✅ Job processed successfully!')

        processedCount++

      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error)
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.log(`Updating job ${job.id} to failed...`)

        // Update job with error
        await db.videoJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: errorMessage
          }
        })
        console.log(`Job ${job.id} marked as failed`)

        failedCount++
      }
    }

    console.log('='.repeat(60))
    console.log(`Cron Job Completed - Processed: ${processedCount}, Failed: ${failedCount}`)
    console.log('='.repeat(60))

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} jobs successfully, ${failedCount} failed`,
      processed: processedCount,
      failed: failedCount,
      total: queuedJobs.length
    })

  } catch (error) {
    console.error('='.repeat(60))
    console.error('FATAL ERROR in cron job:', error)
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

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  console.log('Cron job triggered via POST request')
  return GET(request)
}
