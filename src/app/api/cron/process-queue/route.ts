import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// Configure for Vercel Cron Jobs
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Function to poll task status until completion
async function pollTaskUntilComplete(zai: any, taskId: string, maxPolls: number = 60): Promise<any> {
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
      console.log(`Cron: Poll ${pollCount}/${maxPolls} for task ${taskId}: ${result.task_status}`)

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
    const queuedJobs = await db.videoJob.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 2 // Process up to 2 jobs per cron run to avoid timeouts
    })

    if (queuedJobs.length === 0) {
      console.log('Cron: No queued jobs found')
      return NextResponse.json({
        success: true,
        message: 'No queued jobs to process',
        processed: 0
      })
    }

    console.log(`Cron: Found ${queuedJobs.length} queued job(s)`)

    // Initialize ZAI SDK
    const zai = await ZAI.create()

    let processedCount = 0
    let failedCount = 0

    for (const job of queuedJobs) {
      console.log(`Cron: Processing job ${job.id}`)

      try {
        // Update job status to processing
        await db.videoJob.update({
          where: { id: job.id },
          data: { status: 'processing', progress: 30 }
        })

        // Create video generation task
        // Note: For image-to-video, we would need to fetch the image from cloud storage
        // For now, this handles text-to-video generation
        const task = await zai.video.generations.create({
          prompt: job.prompt,
          quality: job.quality as any,
          duration: job.duration as any,
          fps: job.fps as any,
          size: job.resolution as any
        })

        console.log(`Cron: Created video task ${task.id}`)

        // Update job with external task ID
        await db.videoJob.update({
          where: { id: job.id },
          data: { taskId: task.id, progress: 50 }
        })

        // Poll for results
        const result = await pollTaskUntilComplete(zai, task.id, 80)

        console.log(`Cron: Job ${job.id} completed successfully`)

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
