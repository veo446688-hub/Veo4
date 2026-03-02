# Vercel Deployment Guide
# Image to Video AI Application

This guide will walk you through deploying your application to Vercel step-by-step.

## Prerequisites

✅ Code already pushed to GitHub: https://github.com/veo446688-hub/Veo4
✅ NeonDB database connection string ready
✅ Vercel account (free at vercel.com)

---

## Part 1: Deploy Main Next.js Application to Vercel

### Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Sign up with your GitHub account (recommended)
4. Complete the signup process

### Step 2: Import Your Repository

1. After logging in, click **"Add New..."** → **"Project"**
2. You'll see your GitHub repositories
3. Find and click on **"Veo4"** repository
4. Click **"Import"**

### Step 3: Configure Project Settings

Vercel will automatically detect Next.js settings. Verify:

**Framework Preset:** Next.js
```
Should be automatically detected as "Next.js"
```

**Root Directory:**
```
Leave as "./" (root of repository)
```

**Build Command:**
```
bun run build
```

**Output Directory:**
```
.next
```

**Install Command:**
```
bun install
```

### Step 4: Add Environment Variables

Scroll down to **"Environment Variables"** section and add:

**Variable 1: DATABASE_URL**
```
Name: DATABASE_URL
Value: postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
Environment: All (Production, Preview, Development)
```

**Click "Add"** after entering each variable.

### Step 5: Configure Project Name

In the **"Project Name"** field:
```
veo4-image-to-video-ai
```
(or any name you prefer - Vercel will suggest a unique URL)

### Step 6: Deploy

1. Review all settings
2. Click **"Deploy"** button at the bottom
3. Wait for the build to complete (2-5 minutes)
4. Once deployed, you'll see a success message with your live URL

**Your app will be live at:** `https://veo4-image-to-video-ai.vercel.app`

---

## Part 2: Handle Video Processor Service

The video processor is a background service that needs to run continuously. Vercel has different options:

### Option A: Use Vercel Cron Jobs (Recommended for Simplicity)

Vercel Cron Jobs can periodically run serverless functions to process queued jobs.

#### Step 1: Create a Cron Job Route

Create a new file in your project:

**File:** `src/app/api/cron/process-queue/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'
import { readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { tmpdir } from 'os'

// Configure Vercel Cron: Every 5 minutes
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Function to get MIME type
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop()
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

// Function to poll task status
async function pollTaskUntilComplete(zai: any, taskId: string, maxPolls: number = 60): Promise<any> {
  let pollCount = 0
  const pollInterval = 5000

  while (pollCount < maxPolls) {
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
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error('Task polling timeout')
}

export async function GET(request: NextRequest) {
  // Security check: Only allow Vercel cron
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find queued jobs
    const queuedJobs = await db.videoJob.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 3 // Process up to 3 jobs per run
    })

    if (queuedJobs.length === 0) {
      return NextResponse.json({ message: 'No queued jobs' })
    }

    const zai = await ZAI.create()

    for (const job of queuedJobs) {
      try {
        // Update status to processing
        await db.videoJob.update({
          where: { id: job.id },
          data: { status: 'processing', progress: 30 }
        })

        // Note: For Vercel deployment, we need to use stored image URLs
        // The image should be stored in a cloud storage like Vercel Blob or similar
        // For now, this is a simplified version

        // Create video generation task
        const task = await zai.video.generations.create({
          prompt: job.prompt,
          quality: job.quality as any,
          duration: job.duration as any,
          fps: job.fps as any,
          size: job.resolution as any
        })

        await db.videoJob.update({
          where: { id: job.id },
          data: { taskId: task.id, progress: 50 }
        })

        // Poll for results
        const result = await pollTaskUntilComplete(zai, task.id, 80)

        await db.videoJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            videoUrl: result.url,
            completedAt: new Date()
          }
        })

      } catch (error) {
        await db.videoJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }

    return NextResponse.json({
      message: `Processed ${queuedJobs.length} jobs`,
      processed: queuedJobs.length
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Step 2: Add Cron Secret to Environment Variables

In Vercel project settings, add:

```
Name: CRON_SECRET
Value: generate-a-random-string-here-like-abc123xyz
Environment: Production
```

#### Step 3: Configure Vercel Cron

Create or update `vercel.json` in your project root:

```json
{
  "crons": [{
    "path": "/api/cron/process-queue",
    "schedule": "*/5 * * * *"
  }]
}
```

### Option B: Deploy Video Processor to Railway (Recommended for Production)

For continuous background processing, deploy the video processor to Railway:

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `Veo4` repository
4. Set **Root Directory** to: `mini-services/video-processor`
5. Add environment variables:
   ```
   DATABASE_URL: postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
6. Click "Deploy"

### Option C: Use Vercel Edge Functions with Durable Objects

For advanced users, you can use Vercel's Edge Functions with a Durable Object for state management.

---

## Part 3: Configure Image Storage

Currently, images are stored locally. For Vercel deployment, use cloud storage:

### Option 1: Vercel Blob Storage

1. In Vercel dashboard, go to your project
2. Go to **"Storage"** tab
3. Click **"Create Database"** → **"Blob"**
4. Follow the setup instructions
5. Add `BLOB_READ_WRITE_TOKEN` to environment variables
6. Update your API route to use Vercel Blob:

**Update** `src/app/api/video/create/route.ts`:

```typescript
import { put } from '@vercel/blob'

// Inside your POST handler, replace local file save with:
const blob = await put(filename, buffer, {
  access: 'public',
})

const imageUrl = blob.url
```

### Option 2: Cloudflare R2 / AWS S3

Use any S3-compatible storage service and update the file upload logic accordingly.

---

## Part 4: Update Environment Variables in Vercel

After deploying, add all necessary environment variables:

Go to: **Project Settings** → **Environment Variables**

```
DATABASE_URL=postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
CRON_SECRET=your-random-secret-string
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token (if using Vercel Blob)
```

**Important:** Click "Redeploy" after adding/changing environment variables.

---

## Part 5: Test Your Deployment

### 1. Test Main Application

1. Visit your Vercel URL: `https://veo4-image-to-video-ai.vercel.app`
2. Try uploading an image
3. Check if the UI loads correctly
4. Submit a video generation request

### 2. Test Video Processing

**If using Cron Jobs:**
- Wait up to 5 minutes for the cron to run
- Check your Vercel logs: Dashboard → Your Project → Logs
- Verify jobs are being processed

**If using Railway:**
- Go to Railway dashboard
- Check video processor service logs
- Verify it's processing jobs

### 3. Check Database

1. Go to NeonDB dashboard
2. Open your database
3. Run: `SELECT * FROM "VideoJob" ORDER BY "createdAt" DESC LIMIT 10;`
4. Verify jobs are being created and updated

---

## Part 6: Monitor and Debug

### View Logs

**Vercel:**
- Dashboard → Your Project → "Logs" tab
- Filter by: Serverless Function, Build, Edge Function

**Railway (if using):**
- Dashboard → Your Service → "Logs" tab

### Common Issues

**Issue 1: Database Connection Error**
```
Solution: Verify DATABASE_URL is correct in Vercel environment variables
```

**Issue 2: Jobs Not Processing**
```
Solution: Check if video processor is running (Railway) or cron is configured
```

**Issue 3: Build Fails**
```
Solution: Check build logs in Vercel dashboard
Ensure all dependencies are in package.json
```

**Issue 4: Image Upload Fails**
```
Solution: Configure cloud storage (Vercel Blob or S3)
Update file upload logic
```

---

## Part 7: Custom Domain (Optional)

### Add Custom Domain

1. Go to Vercel project → **"Settings"** → **"Domains"**
2. Click **"Add"**
3. Enter your domain (e.g., `video.yourdomain.com`)
4. Follow DNS instructions provided by Vercel
5. Wait for SSL certificate (automatic)

---

## Part 8: Production Checklist

Before going live, ensure:

- [ ] DATABASE_URL is set in Vercel
- [ ] CRON_SECRET is set (if using cron jobs)
- [ ] BLOB_READ_WRITE_TOKEN is set (if using Vercel Blob)
- [ ] Video processor service is deployed (Railway/Render)
- [ ] Test image upload works
- [ ] Test video generation works
- [ ] Check database connections
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)
- [ ] Configure analytics (optional)
- [ ] Set up error tracking (Sentry, etc.)

---

## Part 9: Scaling Considerations

### Vercel Pro Plan

For production, consider Vercel Pro:
- Unlimited bandwidth
- Faster builds
- Team collaboration
- Priority support
- Advanced analytics

### Database Scaling

NeonDB autoscales, but monitor:
- Connection pooling
- Query performance
- Storage usage

### Video Processing

For high volume:
- Use Railway/Render for video processor
- Scale to multiple workers
- Implement proper job queue (Redis)
- Add CDN for video delivery

---

## Summary

### What You'll Have

✅ **Main App:** Deployed on Vercel (`https://veo4-image-to-video-ai.vercel.app`)
✅ **Database:** NeonDB (PostgreSQL)
✅ **Video Processor:** Railway or Vercel Cron Jobs
✅ **Image Storage:** Vercel Blob or S3
✅ **Custom Domain:** Optional

### Architecture

```
User → Vercel (Next.js App) → NeonDB
                      ↓
                Video Processor (Railway) → AI SDK → Video Storage
```

---

## Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Vercel Support:** https://vercel.com/support
- **NeonDB Docs:** https://neon.tech/docs
- **Project Issues:** Check logs in Vercel dashboard

---

**🎉 Your application is ready to deploy to Vercel!**

Follow the steps above, and your Image to Video AI app will be live in minutes.
