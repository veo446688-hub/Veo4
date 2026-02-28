# Image to Video AI - Scalable Web Application

A production-ready web application that converts uploaded images into AI-generated video clips using the z-ai-web-dev-sdk.

## Architecture Overview

### Frontend (Next.js 16 + React)
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4 with shadcn/ui components
- **State Management**: React hooks for client state
- **Features**:
  - Drag-and-drop image upload
  - Image preview
  - Motion style prompt input with presets
  - Video settings (duration, FPS, quality, resolution)
  - Real-time progress tracking
  - Video preview and download

### Backend (Next.js API Routes)
- **API Endpoints**:
  - `POST /api/video/create` - Create video generation job
  - `GET /api/video/status/[id]` - Check job status
  - `GET /api/uploads/[...path]` - Serve uploaded files

### Background Processing (Mini-Service)
- **Location**: `mini-services/video-processor/`
- **Port**: Independent service (no external port needed)
- **Technology**: Bun + TypeScript
- **Functionality**:
  - Monitors queue directory for new jobs
  - Processes jobs using z-ai-web-dev-sdk
  - Updates database with progress and results
  - Handles errors and retries

### Database (Prisma + SQLite)
- **Schema**: `prisma/schema.prisma`
- **Model**: VideoJob
  - Job status tracking
  - Progress monitoring
  - Result storage
  - Error handling

## Key Features

### 1. Image Processing
- **Supported Formats**: JPG, PNG, WebP, BMP, TIFF, GIF
- **File Size Limit**: 50MB
- **Automatic Validation**: File type and size validation
- **Secure Storage**: Files stored in `uploads/images/`

### 2. Video Generation
- **AI Model**: z-ai-web-dev-sdk video generation
- **Motion Styles**:
  - Cinematic Pan
  - Subtle Breathing
  - Dramatic Storm
  - Floating Effect
  - Zoom In
  - Parallax Motion
  - Wind Motion
  - Time Lapse
- **Custom Prompts**: User can specify any motion style

### 3. Video Settings
- **Duration**: 3-10 seconds
- **Frame Rate**: 24-60 FPS
- **Quality Mode**: Speed or Quality
- **Resolution**:
  - 1024x1024 (Square)
  - 768x1344 (Portrait)
  - 1344x768 (Landscape)
  - 1920x1080 (Full HD)

### 4. Queue Management
- **Asynchronous Processing**: Jobs processed in background
- **Queue System**: File-based trigger system
- **Status Tracking**: Real-time status updates
- **Progress Monitoring**: Percentage-based progress

### 5. Security
- **Rate Limiting**: 5 requests per minute per IP
- **File Validation**: Type and size validation
- **Path Sanitization**: Prevents directory traversal
- **Error Handling**: Comprehensive error handling

## Project Structure

```
my-project/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── video/
│   │   │   │   ├── create/
│   │   │   │   │   └── route.ts          # Job creation API
│   │   │   │   └── status/
│   │   │   │       └── [id]/
│   │   │   │           └── route.ts      # Job status API
│   │   │   └── uploads/
│   │   │       └── [...path]/
│   │   │           └── route.ts          # File serving API
│   │   ├── page.tsx                       # Main UI component
│   │   ├── layout.tsx                     # Root layout
│   │   └── globals.css                    # Global styles
│   ├── components/
│   │   └── ui/                            # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts                          # Prisma client
│   │   ├── utils.ts                       # Utility functions
│   │   └── rate-limit.ts                  # Rate limiter
│   └── hooks/
│       └── use-toast.ts                   # Toast hook
├── mini-services/
│   └── video-processor/
│       ├── index.ts                       # Main processor
│       ├── package.json                   # Service dependencies
│       └── prisma/
│           └── schema.prisma              # Database schema
├── prisma/
│   └── schema.prisma                      # Database schema
├── uploads/
│   └── images/                            # Uploaded images
├── queue/
│   └── triggers/                          # Job trigger files
└── db/
    └── custom.db                          # SQLite database
```

## How It Works

### 1. User Uploads Image
- User selects or drops an image on the upload area
- Frontend validates file type and size
- Image preview is displayed

### 2. User Configures Video Settings
- User enters or selects a motion style prompt
- User adjusts duration, FPS, quality, and resolution
- User clicks "Generate Video"

### 3. Job Creation
- Frontend sends image and settings to `/api/video/create`
- API validates input and applies rate limiting
- Image is saved to `uploads/images/`
- Job record is created in database
- Trigger file is created in `queue/triggers/`
- Job ID is returned to frontend

### 4. Background Processing
- Video processor service detects new trigger file
- Reads image and converts to base64
- Creates video generation task via z-ai-web-dev-sdk
- Polls for task completion
- Updates database with progress
- Stores video URL when complete

### 5. Status Polling
- Frontend polls `/api/video/status/[id]` every 3 seconds
- Progress is displayed to user
- When status is "completed", video is shown
- User can preview and download video

## API Documentation

### POST /api/video/create
Create a new video generation job.

**Request**:
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - `image`: File (required)
  - `prompt`: String (required)
  - `duration`: Number (3-10)
  - `fps`: Number (24-60)
  - `quality`: String ("speed" or "quality")
  - `resolution`: String (e.g., "1024x1024")

**Response** (200):
```json
{
  "success": true,
  "jobId": "clxxx...",
  "status": "queued"
}
```

**Error** (429):
```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later.",
  "resetAt": 1234567890
}
```

### GET /api/video/status/[id]
Check the status of a video generation job.

**Request**:
- Method: GET
- Parameters: `id` (job ID)

**Response** (200):
```json
{
  "success": true,
  "status": "processing",
  "progress": 50,
  "videoUrl": null,
  "error": null
}
```

### GET /api/uploads/[...path]
Serve uploaded files.

**Request**:
- Method: GET
- Parameters: `path` (file path)

**Response**: File content with appropriate Content-Type header

## Database Schema

### VideoJob Model
```prisma
model VideoJob {
  id            String   @id @default(cuid())
  status        String   @default("queued") // queued, processing, completed, failed
  progress      Int      @default(0)
  prompt        String
  duration      Int
  fps           Int
  quality       String
  resolution    String
  imageUrl      String?
  videoUrl      String?
  taskId        String?  // External AI task ID
  errorMessage  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  completedAt   DateTime?
}
```

## Environment Variables

Required environment variables:
- `DATABASE_URL`: SQLite database connection string

## Starting the Application

### Development
The dev server and video processor service are started automatically:
- Next.js dev server runs on port 3000
- Video processor service runs in background

### Manual Start

1. Start Next.js dev server:
```bash
bun run dev
```

2. Start video processor service (in a separate terminal):
```bash
cd mini-services/video-processor
bun index.ts
```

## Deployment Considerations

### Scaling
- **Multiple Workers**: Can run multiple video processor instances
- **Load Balancing**: Use queue system for job distribution
- **Database**: Can migrate to PostgreSQL for better performance
- **File Storage**: Can migrate to S3 or cloud storage

### Monitoring
- **Job Status**: Monitor VideoJob table
- **Error Tracking**: Log errors from video processor
- **Performance Metrics**: Track processing times

### Security
- **Authentication**: Add user authentication
- **Authorization**: Implement user-specific quotas
- **File Scanning**: Add virus scanning for uploads
- **CORS**: Configure CORS for API access

## Future Enhancements

1. **Advanced Image Processing**:
   - Automatic image enhancement
   - Depth map estimation
   - Content detection (faces, objects, text)

2. **Video Enhancement**:
   - Post-processing filters
   - Audio generation
   - Multi-scene videos

3. **User Features**:
   - User accounts and history
   - Video library management
   - Sharing and collaboration

4. **Performance**:
   - GPU acceleration
   - Caching layer
   - CDN for video delivery

5. **AI Models**:
   - Model selection interface
   - Custom model training
   - Style transfer options

## Troubleshooting

### Video Processor Not Starting
- Check that Prisma client is generated: `bun run db:generate`
- Verify DATABASE_URL is set
- Check logs: `tail -f video-processor.log`

### Jobs Not Processing
- Verify video processor service is running
- Check queue/triggers directory for stuck files
- Review video processor logs for errors

### Rate Limiting Issues
- Check rate-limit.ts configuration
- Verify IP detection headers
- Monitor rate-limit-map for entries

### Database Issues
- Run `bun run db:push` to sync schema
- Check database file permissions
- Verify Prisma client generation

## License

This project uses the following technologies:
- Next.js 16 - MIT License
- z-ai-web-dev-sdk - See SDK license
- Prisma - Apache 2.0 License
- shadcn/ui - MIT License

## Support

For issues and questions:
1. Check this README
2. Review code comments
3. Check browser console for frontend errors
4. Check dev.log and video-processor.log for backend errors
