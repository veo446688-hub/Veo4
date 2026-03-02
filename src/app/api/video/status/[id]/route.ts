import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch job from database
    const job = await db.videoJob.findUnique({
      where: { id }
    })

    if (!job) {
      return NextResponse.json(
        { success: false, message: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      status: job.status,
      progress: job.progress,
      videoUrl: job.videoUrl,
      error: job.errorMessage
    })

  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
