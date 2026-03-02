'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Video, Download, Loader2, CheckCircle, XCircle, Play, RefreshCw, FileImage, Sparkles, Clock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type JobStatus = 'idle' | 'uploading' | 'queued' | 'processing' | 'completed' | 'failed'

interface VideoJob {
  id: string
  status: JobStatus
  progress: number
  videoUrl?: string
  error?: string
  imageUrl?: string
}

export default function ImageToVideoPage() {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState([5])
  const [fps, setFps] = useState([30])
  const [quality, setQuality] = useState('quality')
  const [resolution, setResolution] = useState('1024x1024')
  const [job, setJob] = useState<VideoJob | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      processFile(file)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const processFile = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/gif']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, PNG, WebP, BMP, TIFF, GIF)')
      return
    }

    // Validate file size (max 4 MB for Vercel)
    const maxSize = 4 * 1024 * 1024
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      alert(`File is too large (${sizeMB} MB). Please upload an image smaller than 4 MB.`)
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleGenerateVideo = async () => {
    console.log('Generate Video button clicked')

    if (!imageFile) {
      console.error('No image file uploaded')
      alert('Please upload an image first')
      return
    }

    if (!prompt.trim()) {
      console.error('No prompt entered')
      alert('Please enter a motion style prompt')
      return
    }

    // Check file size (Vercel has a 4.5 MB request limit)
    const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB to be safe
    if (imageFile.size > MAX_FILE_SIZE) {
      const sizeMB = (imageFile.size / (1024 * 1024)).toFixed(2)
      alert(`File is too large (${sizeMB} MB). Please upload an image smaller than 4 MB.`)
      return
    }

    console.log('Starting video generation:', {
      imageFile: imageFile.name,
      fileSize: (imageFile.size / 1024 / 1024).toFixed(2) + ' MB',
      imageType: imageFile.type,
      prompt: prompt,
      duration: duration[0],
      fps: fps[0],
      quality,
      resolution
    })

    try {
      setJob({
        id: '',
        status: 'uploading',
        progress: 0
      })

      // Upload image and create video generation task
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('prompt', prompt)
      formData.append('duration', duration[0].toString())
      formData.append('fps', fps[0].toString())
      formData.append('quality', quality)
      formData.append('resolution', resolution)

      console.log('Sending request to /api/video/create')

      const uploadResponse = await fetch('/api/video/create', {
        method: 'POST',
        body: formData,
      })

      console.log('Response status:', uploadResponse.status)

      if (!uploadResponse.ok) {
        // Try to get error details, handle non-JSON responses
        let errorMessage = 'Failed to upload image'
        try {
          const contentType = uploadResponse.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const error = await uploadResponse.json()
            errorMessage = error.message || error.error || errorMessage
          } else {
            const errorText = await uploadResponse.text()
            errorMessage = errorText || errorMessage
          }
        } catch (e) {
          const errorText = await uploadResponse.text()
          errorMessage = errorText || errorMessage
        }
        console.error('Upload failed:', errorMessage)
        throw new Error(errorMessage)
      }

      let jobId: string
      try {
        const response = await uploadResponse.json()
        jobId = response.jobId || response.id
        if (!jobId) {
          throw new Error('No job ID returned from server')
        }
      } catch (e) {
        console.error('Failed to parse response:', e)
        const errorText = await uploadResponse.text()
        throw new Error(`Invalid response from server: ${errorText}`)
      }
      console.log('Job created:', jobId)

      setJob({
        id: jobId,
        status: 'queued',
        progress: 10,
        imageUrl: imagePreview
      })

      // Start polling for job status
      console.log('Starting job status polling')
      pollJobStatus(jobId)
    } catch (error) {
      console.error('Video generation error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start video generation'
      alert(errorMessage)
      setJob({
        id: '',
        status: 'failed',
        progress: 0,
        error: errorMessage
      })
    }
  }

  const pollJobStatus = async (jobId: string) => {
    console.log('Polling job status for:', jobId)
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/video/status/${jobId}`)
        console.log('Status check response:', response.status)

        if (!response.ok) {
          clearInterval(pollInterval)
          let errorMessage = 'Failed to check job status'
          try {
            const errorText = await response.text()
            errorMessage = errorText || errorMessage
          } catch (e) {
            // Ignore text parsing errors
          }
          throw new Error(errorMessage)
        }

        let data: any
        try {
          data = await response.json()
        } catch (e) {
          console.error('Failed to parse status response:', e)
          clearInterval(pollInterval)
          throw new Error('Invalid response from server')
        }
        console.log('Job status data:', data)

        if (data.status === 'processing') {
          setJob(prev => prev ? {
            ...prev,
            status: 'processing',
            progress: Math.min(data.progress || 50, 90)
          } : null)
        } else if (data.status === 'completed') {
          console.log('Job completed successfully:', data.videoUrl)
          clearInterval(pollInterval)
          setJob(prev => prev ? {
            ...prev,
            status: 'completed',
            progress: 100,
            videoUrl: data.videoUrl
          } : null)
        } else if (data.status === 'failed') {
          console.error('Job failed:', data.error)
          clearInterval(pollInterval)
          setJob(prev => prev ? {
            ...prev,
            status: 'failed',
            error: data.error || 'Video generation failed'
          } : null)
        }
      } catch (error) {
        clearInterval(pollInterval)
        setJob(prev => prev ? {
          ...prev,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to check job status'
        } : null)
      }
    }, 3000)
  }

  const handleDownload = async () => {
    if (job?.videoUrl) {
      try {
        const response = await fetch(job.videoUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `generated-video-${job.id}.mp4`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (error) {
        console.error('Download failed:', error)
        alert('Failed to download video')
      }
    }
  }

  const handleReset = () => {
    setImageFile(null)
    setImagePreview('')
    setPrompt('')
    setJob(null)
    setDuration([5])
    setFps([30])
    setQuality('quality')
    setResolution('1024x1024')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const motionStyles = [
    { label: 'Cinematic Pan', prompt: 'Smooth cinematic pan movement across the scene' },
    { label: 'Subtle Breathing', prompt: 'Gentle breathing motion, subtle and organic movement' },
    { label: 'Dramatic Storm', prompt: 'Dynamic storm movement with dramatic energy' },
    { label: 'Floating Effect', prompt: 'Dreamy floating sensation, weightless and ethereal' },
    { label: 'Zoom In', prompt: 'Slow and steady zoom into the main subject' },
    { label: 'Parallax Motion', prompt: 'Parallax depth effect with layered movement' },
    { label: 'Wind Motion', prompt: 'Natural wind effect, elements gently swaying' },
    { label: 'Time Lapse', prompt: 'Time lapse effect, accelerated movement' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl shadow-lg">
                <Video className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                Image to Video AI
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
              Transform your images into stunning AI-generated videos with cinematic motion effects
            </p>
          </motion.div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Upload and Settings */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-violet-600" />
                  Upload Image
                </CardTitle>
                <CardDescription>
                  Supports JPG, PNG, WebP, BMP, TIFF, GIF (Max 4MB)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Area */}
                <div
                  className={`relative border-3 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                    ${dragActive ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20' : 'border-slate-300 dark:border-slate-700 hover:border-violet-400'}
                    ${imagePreview ? 'p-4' : 'p-8'}
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-64 mx-auto rounded-lg shadow-md"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="gap-1">
                  <FileImage className="w-3 h-3" />
                  {imageFile?.name.slice(0, 20)}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                  Drop your image here
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                  or click to browse
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Motion Style Prompt */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="prompt" className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-600" />
              Motion Style Prompt
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const randomStyle = motionStyles[Math.floor(Math.random() * motionStyles.length)]
                setPrompt(randomStyle.prompt)
              }}
              className="h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Random
            </Button>
          </div>
          <Textarea
            id="prompt"
            placeholder="Describe the motion style (e.g., 'Cinematic pan across the scene', 'Gentle breathing motion')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-none border-slate-300 dark:border-slate-700 focus:border-violet-500"
          />
          <div className="flex flex-wrap gap-2">
            {motionStyles.slice(0, 4).map((style) => (
              <Badge
                key={style.label}
                variant={prompt === style.prompt ? "default" : "outline"}
                className="cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/30"
                onClick={() => setPrompt(style.prompt)}
              >
                {style.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Video Settings */}
        <div className="space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            Video Settings
          </Label>

          {/* Duration */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="duration" className="text-sm font-medium">
                Duration
              </Label>
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {duration[0]} seconds
              </Badge>
            </div>
            <Slider
              id="duration"
              min={3}
              max={10}
              step={1}
              value={duration}
              onValueChange={setDuration}
              className="py-4"
            />
          </div>

          {/* FPS */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="fps" className="text-sm font-medium">
                Frame Rate
              </Label>
              <Badge variant="outline">
                {fps[0]} FPS
              </Badge>
            </div>
            <Slider
              id="fps"
              min={24}
              max={60}
              step={6}
              value={fps}
              onValueChange={setFps}
              className="py-4"
            />
          </div>

          {/* Quality and Resolution */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quality" className="text-sm font-medium">
                Quality Mode
              </Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger id="quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="speed">Speed (Faster)</SelectItem>
                  <SelectItem value="quality">Quality (Better)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution" className="text-sm font-medium">
                Resolution
              </Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger id="resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1024">1024x1024 (Square)</SelectItem>
                  <SelectItem value="768x1344">768x1344 (Portrait)</SelectItem>
                  <SelectItem value="1344x768">1344x768 (Landscape)</SelectItem>
                  <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleGenerateVideo}
            disabled={!imageFile || !prompt.trim() || (job && job.status !== 'completed' && job.status !== 'failed')}
            className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-semibold h-11"
          >
            {job?.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Video
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={job?.status === 'uploading' || job?.status === 'queued' || job?.status === 'processing'}
            className="h-11"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  </motion.div>

  {/* Right Column - Preview and Results */}
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay: 0.2 }}
  >
    <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-xl h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5 text-fuchsia-600" />
          Video Preview
        </CardTitle>
        <CardDescription>
          Preview and download your generated video
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {!job ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 rounded-xl flex items-center justify-center"
            >
              <div className="text-center space-y-3">
                <div className="w-20 h-20 mx-auto bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <Video className="w-10 h-10 text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">
                    No video generated yet
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                    Upload an image and click generate
                  </p>
                </div>
              </div>
            </motion.div>
          ) : job.status === 'processing' || job.status === 'queued' || job.status === 'uploading' ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="aspect-square bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/20 dark:to-fuchsia-900/20 rounded-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 animate-pulse" />
                <div className="relative text-center space-y-4">
                  <Loader2 className="w-16 h-16 text-violet-600 dark:text-violet-400 animate-spin mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                      {job.status === 'uploading' ? 'Uploading...' : job.status === 'queued' ? 'Queued...' : 'Generating Video...'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                      This may take a few minutes
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Progress</span>
                  <span className="font-medium text-violet-600 dark:text-violet-400">{job.progress}%</span>
                </div>
                <Progress value={job.progress} className="h-2" />
              </div>
            </motion.div>
          ) : job.status === 'completed' && job.videoUrl ? (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video
                  src={job.videoUrl}
                  controls
                  className="w-full aspect-video"
                  autoPlay
                  loop
                />
              </div>
              <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-300">
                  Video generated successfully!
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleDownload}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold h-11"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Video
              </Button>
            </motion.div>
          ) : job.status === 'failed' ? (
            <motion.div
              key="failed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="aspect-square bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto bg-red-200 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-700 dark:text-red-300">
                      Generation Failed
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2 px-4">
                      {job.error || 'An error occurred during video generation'}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  </motion.div>
</div>

{/* Features Section */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.3 }}
  className="mt-12"
>
  <div className="text-center mb-8">
    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
      Powerful AI Video Generation
    </h2>
    <p className="text-slate-600 dark:text-slate-400">
      Advanced features for professional results
    </p>
  </div>
  <div className="grid md:grid-cols-3 gap-6">
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="pt-6">
        <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-violet-600" />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
          AI-Powered Motion
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Advanced diffusion models generate realistic motion from any image
        </p>
      </CardContent>
    </Card>
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="pt-6">
        <div className="w-12 h-12 bg-fuchsia-100 dark:bg-fuchsia-900/30 rounded-lg flex items-center justify-center mb-4">
          <Video className="w-6 h-6 text-fuchsia-600" />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
          Multiple Formats
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Support for all major image formats with automatic optimization
        </p>
      </CardContent>
    </Card>
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="pt-6">
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-4">
          <Zap className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
          Fast Processing
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          GPU-accelerated inference with intelligent queue management
        </p>
      </CardContent>
    </Card>
  </div>
</motion.div>

{/* Footer */}
<footer className="mt-16 text-center text-sm text-slate-500 dark:text-slate-500 pb-4">
  <p>Powered by AI • Transform images into stunning videos</p>
</footer>
</div>
    </div>
  )
}
