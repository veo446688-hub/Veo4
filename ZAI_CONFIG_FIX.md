# 🚨 CRITICAL: ZAI SDK Configuration Required

## The Problem

The error you're seeing:
```
Failed to initialize ZAI SDK: Error: Configuration file not found or invalid.
Please create .z-ai-config in your project, home directory, or /etc.
```

This means the **z-ai-web-dev-sdk cannot initialize** because it requires API credentials.

---

## 🔧 What I Did

I've created a `.z-ai-config` file with placeholder values at:
```
/home/z/my-project/.z-ai-config
```

**Current content:**
```json
{
  "baseUrl": "YOUR_API_BASE_URL_HERE",
  "apiKey": "YOUR_API_KEY_HERE",
  "chatId": "",
  "userId": ""
}
```

---

## ⚠️ Important Note About API Keys

The API key you provided (`AIzaSyCYP9jdDbCenRWyZr7bpl8M73wsPccp00k`) is a **Google Gemini API key**.

**However**, this application uses the **z-ai-web-dev-sdk**, which is a **completely different AI service** with its own API credentials.

---

## 🎯 What You Need to Do

### Option 1: Get z-ai-web-dev-sdk Credentials (Required)

You need to obtain the correct API credentials for the **z-ai-web-dev-sdk** service:

1. **Contact the service provider** to get:
   - `baseUrl` - The API endpoint URL (must include `/v1` prefix)
   - `apiKey` - Your API key for the z-ai service

2. **Update the `.z-ai-config` file:**
   ```json
   {
     "baseUrl": "https://api.z-ai-service.com/v1",
     "apiKey": "your-actual-z-ai-api-key-here",
     "chatId": "",
     "userId": ""
   }
   ```

### Option 2: Check Your Environment

This project seems to be set up in a development environment that may have the credentials configured elsewhere. Check:
- Environment variables
- Deployment configuration
- Project documentation
- Your development team

---

## 📋 Configuration File Format

The `.z-ai-config` file must be valid JSON with this structure:

```json
{
  "baseUrl": "YOUR_API_BASE_URL_HERE",
  "apiKey": "YOUR_API_KEY_HERE",
  "chatId": "OPTIONAL_CHAT_ID",
  "userId": "OPTIONAL_USER_ID"
}
```

**Important:**
- `baseUrl` should include `/v1` prefix (e.g., `https://api.example.com/v1`)
- `apiKey` is your API key for the z-ai service
- `chatId` and `userId` are optional

---

## 🔍 Where to Find the Credentials

### Check These Locations:

1. **Environment Variables:**
   ```bash
   env | grep -i zai
   env | grep -i api
   ```

2. **Project Documentation:**
   ```bash
   find . -name "*.md" | xargs grep -i "api\|config\|credential"
   ```

3. **Deployment Configuration:**
   - Vercel Dashboard → Settings → Environment Variables
   - Check for ZAI_API_KEY or similar

4. **Team Documentation:**
   - Ask your team lead or devops
   - Check internal documentation
   - Check service provider's dashboard

---

## 🚀 After You Get the Credentials

### Step 1: Update .z-ai-config

Edit `/home/z/my-project/.z-ai-config`:

```json
{
  "baseUrl": "https://your-actual-api-endpoint.com/v1",
  "apiKey": "your-actual-api-key-here",
  "chatId": "",
  "userId": ""
}
```

### Step 2: Test Locally

```bash
# Test the configuration
bun run dev
```

Then try processing a job via the `/test` page.

### Step 3: Deploy to Vercel

Add the credentials to Vercel environment variables:
- Go to Vercel Dashboard → Settings → Environment Variables
- Add:
  - `ZAI_BASE_URL` - Your API base URL
  - `ZAI_API_KEY` - Your API key

Then redeploy the application.

---

## 📝 About Google Gemini API

The API key you provided:
```
AIzaSyCYP9jdDbCenRWyZr7bpl8M73wsPccp00k
```

This is a **Google Gemini API key**, which is for:
- Google's Gemini AI models
- Text generation
- Chat applications
- Image understanding
- **NOT** video generation

The z-ai-web-dev-sdk is a **different service** that specializes in:
- Video generation
- Image-to-video conversion
- Async video processing

**These are two separate services with different APIs and credentials.**

---

## 🤔 What If You Want to Use Gemini Instead?

If you want to use Google Gemini API instead, we would need to:

1. **Completely rewrite the video generation logic**
2. **Use a different approach** (Gemini doesn't generate videos directly)
3. **Integrate with a different video generation service**

This would be a significant rewrite and might not give you the same video generation quality.

---

## 📞 Getting Help

### To Get z-ai-web-dev-sdk Credentials:

1. **Check if you have access** to the z-ai service
2. **Contact the service provider**
3. **Check your organization's API dashboard**
4. **Ask your development team**

### To Debug Further:

1. Check the SDK documentation
2. Look for any existing API keys in your environment
3. Contact the person who set up this project

---

## ✅ Summary

**Problem:** ZAI SDK needs `.z-ai-config` with API credentials

**What I Did:**
- ✅ Created `.zai-config.example` (pushed to GitHub)
- ✅ Created `.z-ai-config` locally (with placeholders)

**What You Need to Do:**
1. Get the correct z-ai-web-dev-sdk credentials
2. Update `/home/z/my-project/.z-ai-config` with:
   - Your actual `baseUrl`
   - Your actual `apiKey`
3. Test the configuration
4. Deploy to Vercel with credentials

**Important:** The Google Gemini API key you provided is for a different service and won't work with this SDK.

---

## 📁 Files Created

```
/home/z/my-project/.z-ai-config.example  → Template (in .gitignore)
/home/z/my-project/.z-ai-config           → Actual config (not in gitignore)
```

---

**Please obtain the correct z-ai-web-dev-sdk credentials and update the config file to fix the issue!** 🔧
