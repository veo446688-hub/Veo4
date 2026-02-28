# Deployment Information

## Latest Deployment

**Date:** 2025-01-20
**Version:** 0.3.1
**Platform:** Vercel
**Status:** Triggering automatic redeploy

## Changes in This Version

### v0.3.1 (2025-01-20)

**Purpose:** Fix JSON parsing errors and file size limit issues

**Changes:**
- Added proper error handling for non-JSON responses
- Reduced max file size from 50MB to 4MB (Vercel limit)
- Added client-side file size validation
- Better error messages for upload failures
- Fixed JSON parsing in status polling
- Updated UI to reflect 4MB limit
- Returns proper JSON for all error responses

**Bug Fixes:**
- Fixed "Unexpected token 'R'" JSON parsing error
- Added content-type checking before parsing JSON
- Graceful handling of HTML error responses
- Better error messages displayed to users

## Deployment Instructions

### For Vercel Deployment:

1. **Create Vercel Blob Store** (if not already created)
   - Go to Vercel Dashboard → Your Project → Storage tab
   - Click "Create Database" → Select "Blob"
   - Click "Create"

2. **Verify Environment Variables**
   - DATABASE_URL ✅
   - CRON_SECRET ✅
   - BLOB_READ_WRITE_TOKEN (auto-added by Blob store) ✅

3. **Wait for Automatic Redeploy**
   - Vercel detects this push
   - Automatically builds and deploys
   - Takes 2-5 minutes

## Important Notes

### File Size Limit
- **Maximum file size: 4 MB**
- This is due to Vercel's request size limit
- Users will see a clear error if they try to upload larger files
- Client-side validation prevents upload attempts

### Error Handling
- All API responses now return proper JSON
- Non-JSON responses are handled gracefully
- Clear error messages shown to users
- Console logs for debugging

## Features

- ✅ Image upload with Vercel Blob storage (max 4MB)
- ✅ AI video generation with motion styles
- ✅ Real-time progress tracking
- ✅ Cron job for automatic processing (every 5 minutes)
- ✅ Video preview and download
- ✅ Rate limiting and security
- ✅ Proper error handling and user feedback

## Status

**Current Status:** Pushing to GitHub to trigger Vercel redeploy

---

**Note:** This file is updated with each deployment to track changes.
