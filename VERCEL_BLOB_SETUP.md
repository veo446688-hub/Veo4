# 🔧 Fix Vercel Deployment - Vercel Blob Setup Guide

## The Problem

The error you encountered:
```
Error: ENOENT: no such file or directory, mkdir '/var/task/uploads'
```

This happens because **Vercel's serverless environment has a read-only filesystem**. You cannot create directories or save files locally on Vercel.

## The Solution

Use **Vercel Blob Storage** to store uploaded images. This is the official Vercel storage solution.

---

## Step 1: Set Up Vercel Blob Storage

### 1.1 Go to Vercel Dashboard

1. Log in to [vercel.com](https://vercel.com)
2. Go to your project (**veo4-video-ai** or your project name)
3. Click on the **"Storage"** tab in the left sidebar

### 1.2 Create a Blob Store

1. Click **"Create Database"** button
2. Select **"Blob"** from the options
3. Click **"Continue"**
4. Select your project (if not already selected)
5. Click **"Create"**

### 1.3 Get Your Blob Token

After creating the Blob store:

1. Vercel will automatically add the `BLOB_READ_WRITE_TOKEN` to your project's environment variables
2. You can see it in: **Settings** → **Environment Variables**

**Note:** You don't need to manually copy the token - Vercel adds it automatically!

---

## Step 2: Update Your Vercel Project

### 2.1 Redeploy Your Application

Since the code has been updated:

1. Go to your Vercel project
2. Click on **"Deployments"** tab
3. Find the latest deployment
4. Click the **"..."** menu (three dots)
5. Click **"Redeploy"**
6. Confirm by clicking **"Redeploy"**

This will deploy the new code with Vercel Blob support.

---

## Step 3: Verify Environment Variables

Make sure you have these 3 environment variables in Vercel:

Go to: **Settings** → **Environment Variables**

### Required Variables:

```
1. DATABASE_URL
   Value: postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   Environment: All

2. CRON_SECRET
   Value: ad97cac2316fad5cb34ae9b42af6c33b873ac7aa5b9a39237fb2a47e936d4fb1
   Environment: Production

3. BLOB_READ_WRITE_TOKEN
   Value: (auto-added by Vercel when you created Blob store)
   Environment: All
```

**Important:** If `BLOB_READ_WRITE_TOKEN` is missing, go back to Step 1 and create a Blob store.

---

## Step 4: Test the Fixed Application

### 4.1 Wait for Redeployment

Wait 2-3 minutes for the redeployment to complete.

### 4.2 Access Your App

Go to your Vercel URL (e.g., `https://veo4-video-ai.vercel.app`)

### 4.3 Upload an Image and Generate Video

1. Upload an image (JPG, PNG, WebP, etc.)
2. Enter a motion prompt (or click a preset)
3. Click **"Generate Video"**

**This should now work without errors!** 🎉

### 4.4 Check the Status

The job will be queued and processed by the cron job (runs every 5 minutes).

You can monitor progress in the right panel of the app.

---

## How It Works Now

### Before (Broken):
```
User uploads image → Try to save to /var/task/uploads → ❌ ERROR (read-only filesystem)
```

### After (Fixed):
```
User uploads image → Upload to Vercel Blob → Save Blob URL in database → ✅ SUCCESS
Cron job runs → Fetch image from Blob URL → Convert to base64 → Generate video → Save video URL
```

---

## What Changed in the Code

### 1. Added Vercel Blob Package
```bash
bun add @vercel/blob
```

### 2. Updated API Route (`/api/video/create`)

**Before:**
```javascript
// Try to save to local filesystem (doesn't work on Vercel)
await writeFile('/var/task/uploads/image.jpg', buffer)
```

**After:**
```javascript
// Upload to Vercel Blob (works perfectly on Vercel)
const blob = await put('images/image.jpg', file, { access: 'public' })
const imageUrl = blob.url
```

### 3. Updated Cron Job (`/api/cron/process-queue`)

**Before:**
```javascript
// Read from local filesystem
const imageBuffer = await readFile('/var/task/uploads/image.jpg')
```

**After:**
```javascript
// Fetch from Vercel Blob URL
const response = await fetch(imageUrl)
const blob = await response.blob()
const base64 = Buffer.from(blob).toString('base64')
```

---

## Troubleshooting

### Issue: "Storage not configured"

**Cause:** Vercel Blob store not created

**Solution:**
1. Go to **Storage** tab in Vercel
2. Click **"Create Database"**
3. Select **"Blob"**
4. Wait for `BLOB_READ_WRITE_TOKEN` to be added automatically

### Issue: "Failed to upload image to storage"

**Cause:** Blob store not properly configured or quota exceeded

**Solution:**
1. Check Vercel Storage tab
2. Verify Blob store is active
3. Check if you've exceeded free tier limits
4. Try creating a new Blob store

### Issue: "Failed to fetch image"

**Cause:** Image URL is invalid or expired

**Solution:**
1. Check the `imageUrl` in the database
2. Verify Blob store is working
3. Check Vercel logs for more details

### Issue: Jobs not processing

**Cause:** Cron job not configured or failing

**Solution:**
1. Go to **Cron Jobs** tab in Vercel
2. Verify cron is configured
3. Check if `CRON_SECRET` is set
4. Check cron job logs

---

## Monitoring Your Blob Storage

### View Stored Images:

1. Go to **Storage** tab in Vercel
2. Click on your Blob store
3. You'll see all uploaded images
4. You can delete old images to save space

### Check Usage:

- In the Blob store dashboard
- See storage usage
- See bandwidth usage
- Monitor costs

---

## Costs

### Vercel Blob Free Tier:
- **Storage:** 500 GB
- **Bandwidth:** 1 TB per month
- **Price:** Free! ✅

This is plenty for a typical image-to-video application.

---

## Summary

### What You Need to Do:

1. ✅ **Create Vercel Blob Store** (Storage tab → Create Database → Blob)
2. ✅ **Redeploy** (Deployments tab → Redeploy)
3. ✅ **Verify Environment Variables** (3 variables: DATABASE_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN)
4. ✅ **Test the App** (Upload image, enter prompt, generate video)

### What's Automatic:

- ✅ `BLOB_READ_WRITE_TOKEN` added automatically when you create Blob store
- ✅ Code already updated to use Vercel Blob
- ✅ Cron job configured to fetch from Blob URLs

---

## Architecture After Fix

```
User uploads image
    ↓
Upload to Vercel Blob (cloud storage)
    ↓
Save Blob URL to NeonDB database
    ↓
Cron job runs every 5 minutes
    ↓
Fetch image from Blob URL
    ↓
Convert to base64
    ↓
Generate video with AI
    ↓
Save video URL to database
    ↓
User sees and downloads video!
```

---

## Next Steps

After setting up Vercel Blob:

1. ✅ Test the app thoroughly
2. ✅ Upload multiple images
3. ✅ Check that videos are generated
4. ✅ Monitor Blob storage usage
5. ✅ Set up custom domain (optional)
6. ✅ Add analytics (optional)

---

## Need Help?

### Vercel Blob Documentation:
https://vercel.com/docs/storage/vercel-blob

### Vercel Storage Guide:
https://vercel.com/docs/storage

### Check Your Vercel Logs:
- Go to your project
- Click **"Logs"** tab
- See real-time errors and events

---

## ✅ Quick Checklist

- [ ] Created Vercel Blob store (Storage → Create Database → Blob)
- [ ] Redeployed the application (Deployments → Redeploy)
- [ ] Verified 3 environment variables (DATABASE_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN)
- [ ] Tested uploading an image
- [ ] Tested generating a video
- [ ] Checked that job processes successfully
- [ ] Verified video appears in the app

---

## 🎉 You're Done!

After completing these steps, your Image to Video AI app will work perfectly on Vercel!

**The key takeaway:** Use Vercel Blob for storage - don't try to save files locally on Vercel!

---

**Start now:**
1. Go to Vercel project → Storage tab
2. Create Blob store
3. Redeploy
4. Test! 🚀
