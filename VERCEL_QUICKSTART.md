# 🚀 Quick Start: Connect to Vercel

## Step-by-Step Guide (5-10 minutes)

---

## Step 1: Create Vercel Account (2 minutes)

1. Go to **[vercel.com](https://vercel.com)**
2. Click **"Sign Up"**
3. Sign up with **GitHub** (recommended)
4. Complete the signup

---

## Step 2: Import Your Repository (1 minute)

1. After login, click **"Add New..."** → **"Project"**
2. Find **"Veo4"** in your repositories
3. Click **"Import"**

---

## Step 3: Configure Settings (2 minutes)

Vercel will auto-detect these. Verify:

```
Framework Preset: Next.js
Root Directory: ./
Build Command: bun run build
Output Directory: .next
Install Command: bun install
```

---

## Step 4: Add Environment Variables (CRITICAL)

Scroll to **"Environment Variables"** section and add:

**Variable 1: DATABASE_URL**
```
Name: DATABASE_URL
Value: postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

Select: All environments (Production, Preview, Development)
Click: Add
```

**Variable 2: CRON_SECRET**
```
Name: CRON_SECRET
Value: your-super-secret-random-string-12345

Select: Production only
Click: Add
```

**💡 Generate a random secret here:** https://www.uuidgenerator.net/api/guid

---

## Step 5: Deploy (3-5 minutes)

1. Set **Project Name**: `veo4-video-ai` (or your preferred name)
2. Click **"Deploy"** button
3. Wait for build to complete
4. You'll see: **"Congratulations!"** with your URL

**Your app will be live at:**
```
https://veo4-video-ai.vercel.app
```

---

## Step 6: Test Your App (1 minute)

1. Click the provided URL
2. Try uploading an image
3. Enter a motion prompt
4. Click "Generate Video"

✅ If it works, you're live!

---

## 🎯 Important Notes

### Video Processing

For the background video processor, you have 2 options:

#### Option A: Use Vercel Cron Jobs (Simple)
- Already configured in your code
- Runs every 5 minutes automatically
- Processes queued jobs
- Works out of the box

#### Option B: Deploy to Railway (Better for Production)
1. Go to **[railway.app](https://railway.app)**
2. New Project → Deploy from GitHub
3. Select `Veo4` repo
4. Set **Root Directory**: `mini-services/video-processor`
5. Add `DATABASE_URL` environment variable
6. Deploy

### Image Storage

Currently uses local storage. For production:

**Option 1: Vercel Blob (Recommended)**
1. In Vercel dashboard → **"Storage"** → **"Create Database"**
2. Choose **"Blob"**
3. Add `BLOB_READ_WRITE_TOKEN` to environment variables
4. Update upload code (see VERCEL_DEPLOYMENT.md)

**Option 2: Keep Local for Now**
- Works for testing
- Not recommended for production
- Files will be lost on redeploy

---

## 📊 Monitor Your Deployment

### View Logs
1. Go to Vercel dashboard
2. Click your project
3. Go to **"Logs"** tab
4. See real-time logs

### Check Cron Jobs
1. In Vercel dashboard → **"Cron Jobs"** tab
2. See execution history
3. Check if jobs are running

### Check Database
1. Go to **[NeonDB Console](https://console.neon.tech)**
2. Open your database
3. Run: `SELECT * FROM "VideoJob" ORDER BY "createdAt" DESC LIMIT 10;`

---

## 🐛 Common Issues & Solutions

### Issue: "Database connection error"
**Solution:**
- Check DATABASE_URL in Vercel environment variables
- Make sure it's set for ALL environments
- Click "Redeploy" after changing

### Issue: "Build failed"
**Solution:**
- Check build logs in Vercel
- Ensure `bun` is in `package.json` scripts
- Check for TypeScript errors

### Issue: "Jobs not processing"
**Solution:**
- Check Cron Jobs tab in Vercel
- Verify CRON_SECRET is set
- Check logs for errors

### Issue: "Image upload fails"
**Solution:**
- For now, this is expected in Vercel (local storage)
- Set up Vercel Blob or S3 for production
- Or test with text-only prompts

---

## 🔄 Update Your Code

If you make changes locally:

```bash
# Add changes
git add .

# Commit
git commit -m "your message"

# Push
git push origin main
```

Vercel will **automatically redeploy** when you push! 🚀

---

## 📱 Custom Domain (Optional)

1. Vercel dashboard → **"Settings"** → **"Domains"**
2. Click **"Add"**
3. Enter your domain (e.g., `video.yourdomain.com`)
4. Follow DNS instructions
5. Wait ~5 minutes for SSL

---

## ✅ Deployment Checklist

Before going live:

- [ ] ✅ Code pushed to GitHub
- [ ] ⬜ Vercel account created
- [ ] ⬜ Repository imported to Vercel
- [ ] ⬜ DATABASE_URL added to environment variables
- [ ] ⬜ CRON_SECRET added to environment variables
- [ ] ⬜ First deployment successful
- [ ] ⬜ Tested image upload
- [ ] ⬜ Tested video generation
- [ ] ⬜ Checked logs for errors
- [ ] ⬜ Verified database connections

---

## 📚 Additional Resources

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Vercel Cron Jobs:** https://vercel.com/docs/cron-jobs
- **NeonDB Docs:** https://neon.tech/docs

---

## 🎉 You're Ready!

Follow these steps and your Image to Video AI app will be live on Vercel in minutes!

**Need more details?** Check `VERCEL_DEPLOYMENT.md` for comprehensive documentation.

---

**🚀 Start deploying now: https://vercel.com/new**
