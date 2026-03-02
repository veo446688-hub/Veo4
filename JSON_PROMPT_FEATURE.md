# JSON Prompt Feature for Image-to-Video Generation

## Overview

This document describes the new JSON prompt feature that allows users to provide structured, detailed prompts for AI-powered image-to-video generation.

## What's New

### 1. JSON-Based Prompt Input

The prompt section now accepts JSON format instead of plain text. This allows for more structured and detailed control over video generation parameters.

### 2. JSON Validation

- Real-time JSON validation as you type
- Clear error messages for invalid JSON
- Visual feedback with red border when JSON is invalid
- Ensures JSON contains either "prompt" or "description" field

### 3. Example Prompts

Four pre-built JSON examples are provided:

#### Cinematic Pan
```json
{
  "prompt": "Smooth cinematic pan movement across the scene",
  "motion_style": "cinematic",
  "camera_movement": "pan_left_to_right",
  "speed": "slow",
  "atmosphere": "dramatic and professional",
  "camera_settings": {
    "stabilization": true,
    "smooth_transition": true
  }
}
```

#### Subtle Breathing
```json
{
  "prompt": "Gentle breathing motion, subtle and organic movement",
  "motion_style": "subtle",
  "camera_movement": "slight_zoom_breath",
  "speed": "very_slow",
  "atmosphere": "calm and peaceful",
  "camera_settings": {
    "stabilization": true,
    "smooth_transition": true
  }
}
```

#### Dramatic Storm
```json
{
  "prompt": "Dynamic storm movement with dramatic energy",
  "motion_style": "dramatic",
  "camera_movement": "dynamic_shake",
  "speed": "fast",
  "atmosphere": "intense and powerful",
  "camera_settings": {
    "stabilization": false,
    "dynamic_movement": true
  }
}
```

#### Floating Effect
```json
{
  "prompt": "Dreamy floating sensation, weightless and ethereal",
  "motion_style": "dreamy",
  "camera_movement": "gentle_float",
  "speed": "slow",
  "atmosphere": "ethereal and magical",
  "camera_settings": {
    "stabilization": true,
    "smooth_transition": true
  }
}
```

### 4. Quick Actions

- **Random Example Button**: Loads a random JSON example into the textarea
- **Click on Example Card**: Loads that specific example into the textarea
- **Copy Button**: Copies example JSON to clipboard (appears on hover)
- **Real-time Validation**: Validates JSON as you type

## JSON Schema

The JSON prompt supports the following fields (all optional except prompt or description):

### Required Fields
- `prompt` (string): Main description of the motion/video
- OR `description` (string): Alternative to prompt field

### Optional Fields
- `motion_style` (string): Style of motion (e.g., "cinematic", "subtle", "dramatic", "dreamy")
- `camera_movement` (string): Type of camera movement (e.g., "pan_left_to_right", "slight_zoom_breath")
- `speed` (string): Speed of motion (e.g., "slow", "very_slow", "fast")
- `atmosphere` (string): Overall mood/atmosphere (e.g., "dramatic", "calm", "intense")
- `camera_settings` (object): Additional camera settings
  - `stabilization` (boolean): Enable/disable video stabilization
  - `smooth_transition` (boolean): Enable smooth transitions
  - `dynamic_movement` (boolean): Enable dynamic movement

## How It Works

### Frontend (User Interface)

1. User uploads an image
2. User either:
   - Types their own JSON prompt manually
   - Clicks on an example card to load a pre-built JSON
   - Clicks "Random Example" to load a random example
3. Real-time JSON validation ensures correct format
4. User can copy examples to clipboard for custom editing

### Backend (API Processing)

1. API receives the JSON prompt along with image and settings
2. Parses the JSON and extracts parameters
3. Enriches the main prompt with additional parameters:
   - Combines prompt with motion_style, camera_movement, speed, and atmosphere
   - Creates a detailed, comprehensive prompt for the AI
4. Stores the enriched prompt in the database
5. Cron job processes the job using the enriched prompt

### Example Enrichment

**Input JSON:**
```json
{
  "prompt": "Smooth cinematic pan movement",
  "motion_style": "cinematic",
  "camera_movement": "pan_left_to_right",
  "speed": "slow",
  "atmosphere": "dramatic"
}
```

**Enriched Prompt (sent to AI):**
```
Smooth cinematic pan movement, with cinematic motion style, using pan_left_to_right camera movement, at slow speed, in a dramatic atmosphere
```

## Video Download

The download button remains functional and allows users to:
- Download the generated video in real-time after completion
- Videos are saved as MP4 files with format: `generated-video-{job-id}.mp4`
- Direct download from the video URL

## Benefits

1. **Structured Control**: JSON format provides structured control over video parameters
2. **Better AI Understanding**: Enriched prompts give AI more context and detail
3. **Quick Start**: Pre-built examples help users get started quickly
4. **Flexibility**: Users can customize examples or create their own JSON
5. **Validation**: Real-time validation prevents errors before submission
6. **Consistency**: Standardized JSON format ensures consistent results

## Usage Tips

1. **Start with Examples**: Use the pre-built examples as a starting point
2. **Customize**: Modify examples to match your specific needs
3. **Be Descriptive**: Use detailed descriptions in the "prompt" field
4. **Combine Parameters**: Mix and match motion_style, camera_movement, and atmosphere
5. **Validate Before Submit**: Ensure JSON is valid before clicking generate
6. **Test Different Speeds**: Experiment with different speed settings for varied results

## Deployment

All changes have been:
- ✅ Committed to Git
- ✅ Pushed to GitHub: https://github.com/veo446688-hub/veo4
- ✅ Ready for automatic Vercel deployment

## Version

- Version: 1.0.0
- Release Date: [Current Date]
- Commit: 5a8097b
