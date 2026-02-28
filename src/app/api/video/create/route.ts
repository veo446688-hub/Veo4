import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// Supported image types
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/gif']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  console.log('API: /api/video/create called')

  try {
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

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', 'images')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const ext = path.extname(image.name) || '.jpg'
    const filename = `img_${timestamp}_${randomStr}${ext}`
    const filepath = path.join(uploadDir, filename)

    // Save image file
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

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
        imageUrl: `/uploads/images/${filename}`,
      }
    })
    console.log('API: Job created:', job.id)

    // Notify the background processing service (via a simple trigger file)
    const triggerDir = path.join(process.cwd(), 'queue', 'triggers')
    if (!existsSync(triggerDir)) {
      await mkdir(triggerDir, { recursive: true })
    }
    const triggerFile = path.join(triggerDir, `${job.id}.trigger`)
    await writeFile(triggerFile, JSON.stringify({
      jobId: job.id,
      imageFile: filename,
      prompt: prompt.trim(),
      duration,
      fps,
      quality,
      resolution
    }))
    console.log('API: Trigger file created:', triggerFile)

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status
    })

  } catch (error) {
    console.error('Error creating video job:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
