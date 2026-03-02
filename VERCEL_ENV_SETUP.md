# Vercel Environment Variables Setup Guide

This guide explains how to set up the required environment variables in Vercel to enable video generation.

## Required Environment Variables

### 1. Database
- **Name**: `DATABASE_URL`
- **Description**: PostgreSQL connection string for NeonDB
- **How to get**: From NeonDB dashboard → "Connection Details" → "Connection String"
- **Example**: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

### 2. Vercel Blob Storage
- **Name**: `BLOB_READ_WRITE_TOKEN`
- **Description**: Token for Vercel Blob storage (used for image uploads)
- **How to get**:
  1. Go to Vercel dashboard → Storage → Blob
  2. Create or select your Blob store
  3. Copy the "BLOB_READ_WRITE_TOKEN"
- **Example**: `vercel_blob_your_token_here`

### 3. ZAI SDK Configuration (CRITICAL for Video Generation)
These are required for the video generation to work:

- **Name**: `ZAI_BASE_URL`
- **Description**: Base URL for ZAI API
- **How to get**: From your ZAI service provider/SDK documentation
- **Example**: `https://api.zai.example.com`

- **Name**: `ZAI_API_KEY`
- **Description**: API key for ZAI service
- **How to get**: From your ZAI service provider dashboard
- **Example**: `zai_api_key_xxxxxxxxxxxx`

- **Name**: `ZAI_CHAT_ID` (Optional)
- **Description**: Chat ID if required by your ZAI service
- **How to get**: From your ZAI service provider
- **Default**: Leave empty if not required

- **Name**: `ZAI_USER_ID` (Optional)
- **Description**: User ID if required by your ZAI service
- **How to get**: From your ZAI service provider
- **Default**: Leave empty if not required

## How to Set Environment Variables in Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Click on "Settings" tab
3. Click on "Environment Variables"
4. Add each variable:
   - Click "Add New"
   - Enter the name (e.g., `ZAI_BASE_URL`)
   - Enter the value
   - Select the environments (Production, Preview, Development)
   - Click "Save"
5. Repeat for all required variables
6. **Important**: After adding variables, you must redeploy your application:
   - Go to "Deployments" tab
   - Click the three dots (...) on the latest deployment
   - Click "Redeploy"

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variables
vercel env add DATABASE_URL
vercel env add BLOB_READ_WRITE_TOKEN
vercel env add ZAI_BASE_URL
vercel env add ZAI_API_KEY
vercel env add ZAI_CHAT_ID
vercel env add ZAI_USER_ID

# Redeploy
vercel --prod
```

### Option 3: Via Vercel Project Settings File

1. Create or edit `.vercel/project.json` in your project root:
```json
{
  "env": {
    "DATABASE_URL": {
      "value": "your_database_url_here"
    },
    "BLOB_READ_WRITE_TOKEN": {
      "value": "your_blob_token_here"
    },
    "ZAI_BASE_URL": {
      "value": "https://api.zai.example.com"
    },
    "ZAI_API_KEY": {
      "value": "your_zai_api_key_here"
    },
    "ZAI_CHAT_ID": {
      "value": ""
    },
    "ZAI_USER_ID": {
      "value": ""
    }
  }
}
```

2. Commit and push to GitHub (Note: **Do not commit actual API keys to public repositories!**)
3. Vercel will automatically deploy with these settings

## Troubleshooting

### Issue: "Video generation stuck at 10%"

**Cause**: ZAI SDK is not properly configured.

**Solution**:
1. Check if all ZAI environment variables are set in Vercel
2. Verify the `ZAI_BASE_URL` and `ZAI_API_KEY` are correct
3. Check Vercel function logs for specific error messages
4. Redeploy after adding/updating environment variables

**How to check logs**:
1. Go to Vercel dashboard → Deployments
2. Click on your latest deployment
3. Click on "Functions" tab
4. Look for `/api/cron/process-queue` logs
5. Search for "ZAI Client" to see initialization errors

### Issue: "Configuration file not found or invalid"

**Cause**: ZAI SDK cannot find configuration.

**Solution**: The code now creates a temporary config file from environment variables. Ensure:
- All ZAI environment variables are set
- Environment variables are set for all environments (Production, Preview, Development)
- You have redeployed after adding the variables

### Issue: Jobs failing with "ZAI SDK initialization failed"

**Cause**: Missing or incorrect environment variables.

**Solution**:
1. Verify each environment variable is set
2. Check for typos in variable names
3. Ensure API key is valid and not expired
4. Test API credentials outside the application if possible

## Verification

After setting up environment variables:

1. **Check Environment Variables in Vercel**:
   - Settings → Environment Variables
   - Verify all required variables are present
   - Check they're set for the correct environment

2. **Redeploy the Application**:
   - Deployments → Redeploy

3. **Test Video Generation**:
   - Upload an image
   - Provide a JSON prompt
   - Click "Generate Video"
   - Monitor progress - it should go beyond 10%

4. **Check Logs**:
   - Deployments → Functions → `/api/cron/process-queue`
   - Look for "ZAI SDK initialized successfully"

## Security Best Practices

1. **Never commit actual API keys** to version control
2. Use different API keys for development and production
3. Rotate API keys regularly
4. Use Vercel's environment variable encryption
5. Limit API key permissions to minimum required
6. Monitor API usage for unusual activity

## Getting ZAI Credentials

If you don't have ZAI API credentials:

1. Contact your ZAI service provider
2. Sign up for a ZAI account
3. Generate an API key from the dashboard
4. Note down the base URL for the API
5. Add these to your Vercel environment variables

## Support

If you continue to experience issues:

1. Check Vercel function logs for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure you have a valid ZAI API subscription/plan
4. Contact ZAI support if API credentials are not working

## Quick Checklist

Before deploying, ensure you have:

- [ ] `DATABASE_URL` from NeonDB
- [ ] `BLOB_READ_WRITE_TOKEN` from Vercel Blob
- [ ] `ZAI_BASE_URL` from your ZAI provider
- [ ] `ZAI_API_KEY` from your ZAI provider
- [ ] `ZAI_CHAT_ID` (if required, otherwise leave empty)
- [ ] `ZAI_USER_ID` (if required, otherwise leave empty)
- [ ] All variables set for Production environment
- [ ] Application redeployed after adding variables
- [ ] Tested video generation after deployment

## What Changed in This Fix

The code now includes:

1. **ZAI Client Utility** (`src/lib/zai-client.ts`):
   - Dynamically creates ZAI configuration from environment variables
   - Handles missing configuration with clear error messages
   - Caches ZAI instance for better performance

2. **Updated API Routes**:
   - `/api/cron/process-queue` now uses the new ZAI client
   - `/api/test/process-job` now uses the new ZAI client
   - Better error handling and job status updates

3. **Improved Error Messages**:
   - Clear instructions when configuration is missing
   - Specific environment variable names that need to be set
   - Better logging for debugging

This fix allows video generation to work in Vercel's serverless environment without requiring a configuration file to exist on the filesystem.
