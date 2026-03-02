# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-12

### Added
- **JSON Prompt Support**
  - Frontend now accepts JSON format prompts instead of plain text
  - Real-time JSON validation with visual feedback
  - Error messages for invalid JSON format
  - JSON must contain either "prompt" or "description" field

- **Example Prompts**
  - Cinematic Pan example with panning motion
  - Subtle Breathing example with gentle motion
  - Dramatic Storm example with dynamic energy
  - Floating Effect example with dreamy motion
  - Click-to-load functionality for all examples
  - Copy-to-clipboard for examples (hover to reveal)
  - Random example generator button

- **Backend Enhancements**
  - JSON parsing and validation in API
  - Prompt enrichment with motion parameters
  - Extracts: motion_style, camera_movement, speed, atmosphere
  - Creates comprehensive AI prompts from JSON
  - Enhanced logging for JSON parameters

- **UI Improvements**
  - Code-styled textarea with monospace font
  - Larger textarea (8 rows) for better JSON editing
  - Example cards with hover effects
  - Copy button appears on hover over examples
  - Red border indicator for invalid JSON
  - Alert component for JSON validation errors

- **Download Functionality**
  - Maintained existing download button functionality
  - Real-time video download after generation
  - Downloads as MP4 with job ID in filename

### Changed
- Prompt label from "Motion Style Prompt" to "JSON Prompt"
- Prompt icon changed from Sparkles to Code
- "Random" button renamed to "Random Example"
- Removed simple text badges (replaced with example cards)
- Increased textarea rows from 3 to 8 for better JSON editing

### Technical Details
- Added `useToast` hook for copy notifications
- Added `jsonError` state for validation
- Added `copied` state for copy feedback
- Added `exampleJsonPrompts` array with 4 pre-built examples
- Added `handleLoadExample` function to load examples
- Added `handleCopyExample` function for clipboard copy
- Added `validateJson` function for real-time validation
- Enhanced `handleGenerateVideo` with JSON validation

### Deployment
- All changes committed to Git
- Pushed to GitHub repository
- Vercel will automatically redeploy

### Repository
- GitHub: https://github.com/veo446688-hub/veo4
- Commit: 5a8097b
