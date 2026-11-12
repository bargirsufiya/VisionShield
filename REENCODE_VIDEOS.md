# Video Re-encoding for Browser Compatibility

The demo videos may have codec issues (e.g., H.265/HEVC). Re-encode all videos to **H.264 + AAC** for guaranteed browser playback.

## Prerequisites
```powershell
# Install FFmpeg
winget install ffmpeg
# Or download from https://ffmpeg.org/
```

## Re-encode All Videos (Recommended)

Run from the VisionShield project root:

```powershell
# Demo Foundry Pipeline (46MB → ~30MB, H.264)
ffmpeg -i "frontend\public\videos\demo_foundry_pipeline.mp4" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p "frontend\public\videos\demo_foundry_pipeline_fixed.mp4"

# Foundry Process 2min (86MB → ~50MB, H.264)
ffmpeg -i "frontend\public\videos\foundry_process_2min.mp4" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p "frontend\public\videos\foundry_process_2min_fixed.mp4"

# Cam2 (627MB → ~80MB, H.264) 
ffmpeg -i "frontend\public\videos\cam2.mp4" -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p "frontend\public\videos\cam2_fixed.mp4"

# CamA1 (4GB → ~150MB, H.264)
ffmpeg -i "frontend\public\videos\cama1.mp4" -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p "frontend\public\videos\cama1_fixed.mp4"
```

## Quick Test - Re-encode Just the Demo Videos First

```powershell
# Test with demo videos first
ffmpeg -i "frontend\public\videos\demo_foundry_pipeline.mp4" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p "frontend\public\videos\demo_foundry_pipeline_fixed.mp4"

ffmpeg -i "frontend\public\videos\foundry_process_2min.mp4" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p "frontend\public\videos\foundry_process_2min_fixed.mp4"
```

## After Re-encoding

Update `frontend/src/config/videos.js`:
```javascript
export const FOUNDRY_VIDEOS = [
  {
    id: 'demo_foundry_pipeline',
    title: 'Foundry Pipeline Demo',
    description: 'Complete foundry process pipeline demonstration',
    src: '/videos/demo_foundry_pipeline_fixed.mp4',  // ← Updated
    duration: '3:20',
  },
  {
    id: 'foundry_process_2min',
    title: 'Foundry Process (2 min)',
    description: 'Condensed foundry process overview - 2 minutes',
    src: '/videos/foundry_process_2min_fixed.mp4',  // ← Updated
    duration: '2:00',
  },
  {
    id: 'cctv_cam2',
    title: 'CCTV Camera 2 - Furnace Area',
    description: 'Live furnace monitoring feed from Camera 2',
    src: '/videos/cam2_fixed.mp4',  // ← Updated
    duration: '10:15',
  },
  {
    id: 'cctv_cama1',
    title: 'CCTV Camera A1 - Pouring Station',
    description: 'Metal pouring station monitoring from Camera A1',
    src: '/videos/cama1_fixed.mp4',  // ← Updated
    duration: '15:30',
  },
];
```

## Key FFmpeg Options for Browser Compatibility
| Option | Purpose |
|--------|---------|
| `-c:v libx264` | H.264 video codec (universal browser support) |
| `-pix_fmt yuv420p` | Pixel format required for browser playback |
| `-crf 23` | Quality (18-28, lower = better, 23 = default) |
| `-c:a aac -b:a 128k` | AAC audio (universal browser support) |
| `-movflags +faststart` | Moves moov atom to start for streaming |

## Debug Video Issues
To check what codec a video uses:
```powershell
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt -of csv=p=0 "frontend\public\videos\demo_foundry_pipeline.mp4"
```

Expected output for browser-compatible video:
```
h264,yuv420p
```

If you see `hevc` or `yuv422p` or `yuv444p`, it won't play in most browsers.