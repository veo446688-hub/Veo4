import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// Supported image types
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/gif']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  console.log('API: /api/video/create called')

  try {
    // Check if Vercel Blob is configured
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (!blobToken) {
      console.error('API: BLOB_READ_WRITE_TOKEN not configured')
      return NextResponse.json(
        { success: false, message: 'Storage not configured. Please set up Vercel Blob.' },
        { status: 500 }
      )
    }

    // Rate limiting based on IP address
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    console.log('API: Request from IP:', ip)

    const rateLimitResult = rateLimit(ip, 5, 60000) // 5 requests per minute

    if (!rateLimitResult.allowed) {
      console.log('API: Rate limit exceeded for IP:', ip)
      return NextResponse.json(
        {
          success: false,
          message: 'Rate limit exceeded. Please try again later.',
          resetAt: rateLimitResult.resetAt
        },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const image = formData.get('image') as File
    const prompt = formData.get('prompt') as string
    const duration = parseInt(formData.get('duration') as string)
    const fps = parseInt(formData.get('fps') as string)
    const quality = formData.get('quality') as string
    const resolution = formData.get('resolution') as string

    console.log('API: Received request:', {
      hasImage: !!image,
      imageType: image?.type,
      imageSize: image?.size,
      prompt: prompt?.substring(0, 50),
      duration,
      fps,
      quality,
      resolution
    })

    // Validate required fields
    if (!image) {
      return NextResponse.json(
        { success: false, message: 'Image is required' },
        { status: 400 }
      )
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, message: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!SUPPORTED_TYPES.includes(image.type)) {
      return NextResponse.json(
        { success: false, message: 'Unsupported image type. Supported types: JPEG, PNG, WebP, BMP, TIFF, GIF' },
        { status: 400 }
      )
    }

    // Validate file size
    if (image.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    // Validate parameters
    if (duration < 3 || duration > 10) {
      return NextResponse.json(
        { success: false, message: 'Duration must be between 3 and 10 seconds' },
        { status: 400 }
      )
    }

    if (fps < 24 || fps > 60) {
      return NextResponse.json(
        { success: false, message: 'FPS must be between 24 and 60' },
        { status: 400 }
      )
    }

    if (quality !== 'speed' && quality !== 'quality') {
      return NextResponse.json(
        { success: false, message: 'Quality must be either "speed" or "quality"' },
        { status: 400 }
      )
    }

    // Upload image to Vercel Blob
    console.log('API: Uploading image to Vercel Blob')

    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const ext = image.name.split('.').pop() || 'jpg'
    const filename = `images/${timestamp}_${randomStr}.${ext}`

    try {
      const blob = await put(filename, image, {
        access: 'public',
      })

      console.log('API: Image uploaded to Blob:', blob.url)
    } catch (blobError) {
      console.error('API: Failed to upload to Blob:', blobError)
      return NextResponse.json(
        { success: false, message: 'Failed to upload image to storage' },
        { status: 500 }
      )
    }

    const imageUrl = `https://${process.env.BLOB_STORE_ID || 'your-blob-store'}.public.blob.vercel-storage.com/${filename}`

    // Create job record in database
    console.log('API: Creating job in database')
    const job = await db.videoJob.create({
      data: {
        status: 'queued',
        progress: 0,
        prompt: prompt.trim(),
        duration,
        fps,
        quality,
        resolution,
        imageUrl: imageUrl,
      }
    })
    console.log('API: Job created:', job.id)

    // Note: For Vercel deployment, we don't create trigger files
    // Instead, the cron job will pick up queued jobs from the database
    console.log('API: Job queued for processing by cron')

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status
    })

  } catch (error) {
    console.error('Error creating video job:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
