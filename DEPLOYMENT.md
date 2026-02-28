# Deployment Guide - Image to Video AI Application

This guide will help you deploy the Image to Video AI application to production.

## Prerequisites

- Node.js 18+ or Bun runtime
- GitHub account with access to veo446688-hub/Veo4 repository
- NeonDB account with PostgreSQL database
- z-ai-web-dev-sdk credentials

## Database Setup

The application is configured to use NeonDB (PostgreSQL). The database schema has already been pushed to NeonDB.

**Connection String**:
```
postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Environment Variables

Create a `.env` file in your project root:

```env
DATABASE_URL="postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

## Pushing Code to GitHub

The code has been committed locally but needs to be pushed to GitHub. Here's how to do it:

### Option 1: Using GitHub CLI (Recommended)

If you have GitHub CLI installed:

```bash
# Authenticate with GitHub
gh auth login

# Push to GitHub
git push -u origin main
```

### Option 2: Using Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `repo` scope
3. Use the token to push:

```bash
# Set up remote with token (replace YOUR_TOKEN with your actual token)
git remote set-url origin https://YOUR_TOKEN@github.com/veo446688-hub/Veo4.git

# Push to GitHub
git push -u origin main
```

### Option 3: Using SSH

If you have SSH keys set up:

```bash
# Switch to SSH URL
git remote set-url origin git@github.com:veo446688-hub/Veo4.git

# Push to GitHub
git push -u origin main
```

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/veo446688-hub/Veo4.git
cd Veo4
```

### 2. Install Dependencies

```bash
# Install main project dependencies
bun install

# Install mini-service dependencies
cd mini-services/video-processor
bun install
cd ../..
```

### 3. Set Up Environment Variables

Create `.env` file in project root and `mini-services/video-processor/.env`:

```env
DATABASE_URL="postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### 4. Generate Prisma Client

```bash
bunx prisma generate
cd mini-services/video-processor
bunx prisma generate
cd ../..
```

### 5. Run Database Migrations (if needed)

```bash
DATABASE_URL="postgresql://neondb_owner:npg_6qenWCkja0pI@ep-round-scene-ai2geall-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" bunx prisma db push
```

### 6. Start Services

**Terminal 1 - Next.js Dev Server:**
```bash
bun run dev
```

**Terminal 2 - Video Processor Service:**
```bash
cd mini-services/video-processor
bun index.ts
```

The application will be available at `http://localhost:3000`

## Production Deployment

### Deploying to Vercel (Recommended)

1. **Push Code to GitHub**
   - Follow the steps in "Pushing Code to GitHub" section above

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository

3. **Configure Environment Variables**
   - Add `DATABASE_URL` with your NeonDB connection string
   - Add any other required environment variables

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your Next.js application

5. **Deploy Video Processor Service**
   - You'll need to deploy the video processor as a separate service
   - Consider using Railway, Render, or a VPS

### Deploying to Railway

**For Main Application:**

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add environment variables:
   - `DATABASE_URL`: Your NeonDB connection string
4. Deploy

**For Video Processor Service:**

1. Create a separate Railway service
2. Use the `mini-services/video-processor` directory as root
3. Add environment variables:
   - `DATABASE_URL`: Your NeonDB connection string
4. Deploy as a background worker

### Deploying to Render

**Main Application (Web Service):**

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure:
   - Build Command: `bun install && bun run build`
   - Start Command: `bun start`
4. Add environment variables:
   - `DATABASE_URL`: Your NeonDB connection string

**Video Processor Service (Background Worker):**

1. Create a new Background Worker on Render
2. Use the same repository
3. Set Working Directory to `mini-services/video-processor`
4. Configure:
   - Build Command: `bun install`
   - Start Command: `bun index.ts`
5. Add environment variables:
   - `DATABASE_URL`: Your NeonDB connection string

## Monitoring and Logs

### Check Application Logs

- **Vercel**: Dashboard → Your Project → Logs
- **Railway**: Dashboard → Your Service → Logs
- **Render**: Dashboard → Your Service → Logs

### Database Monitoring

- Go to your NeonDB dashboard
- Monitor connection usage, query performance, and storage

### Video Processor Logs

The video processor service outputs logs to:
- Console/STDOUT
- Can be configured to log to a file for debugging

## Scaling Considerations

### Database Scaling

NeonDB automatically scales, but consider:
- Connection pooling
- Query optimization
- Indexing for VideoJob table

### Video Processing Scaling

To handle more video generation requests:

1. **Multiple Workers**: Deploy multiple instances of the video processor service
2. **Queue System**: Implement Redis or a message queue (RabbitMQ, SQS)
3. **Load Balancing**: Use a load balancer to distribute requests

### File Storage

Currently using local file storage. For production:
- Migrate to S3, Cloudflare R2, or similar
- Implement CDN for faster video delivery
- Add file cleanup for old uploads

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **Rate Limiting**: Already implemented, but consider adjusting limits
3. **File Validation**: Ensure proper file type and size checking
4. **CORS**: Configure CORS for your domain
5. **HTTPS**: Always use HTTPS in production
6. **Authentication**: Add user authentication if needed
7. **Input Validation**: Validate all user inputs

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
DATABASE_URL="your-connection-string" bunx prisma db push
```

### Video Processor Not Starting

- Check Prisma client is generated: `bunx prisma generate`
- Verify DATABASE_URL is set correctly
- Check logs for error messages

### Build Failures

- Ensure all dependencies are installed: `bun install`
- Check Node.js/Bun version compatibility
- Review build logs in your deployment platform

### Jobs Not Processing

- Verify video processor service is running
- Check database for stuck jobs
- Review video processor logs
- Ensure queue directory has proper permissions

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Regularly update dependencies
2. **Monitor Database**: Check database size and performance
3. **Clean Up Old Files**: Remove old uploaded images and videos
4. **Review Logs**: Check for errors and warnings
5. **Backup Database**: NeonDB provides automatic backups

### Updating the Application

1. Make changes locally
2. Test thoroughly
3. Commit changes: `git commit -m "description"`
4. Push to GitHub: `git push origin main`
5. Deployment platform will auto-deploy

## Support

For issues or questions:
- Check the main README.md
- Review logs in your deployment platform
- Check NeonDB dashboard for database issues
- Review z-ai-web-dev-sdk documentation

## License

This project uses the following technologies:
- Next.js 16 - MIT License
- z-ai-web-dev-sdk - See SDK license
- Prisma - Apache 2.0 License
- shadcn/ui - MIT License
