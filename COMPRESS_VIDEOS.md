# Video Compression Commands for VisionShield

Run these commands in PowerShell or Command Prompt from the VisionShield project root:

## Prerequisites
- Install FFmpeg: `winget install ffmpeg` or download from https://ffmpeg.org/

## Compress Large CCTV Videos

### Cam2 (Furnace Area) - 627 MB → ~50-80 MB
```powershell
ffmpeg -i "frontend\public\videos\cam2.mp4" -vcodec libx264 -crf 28 -preset fast -acodec aac -b:a 128k -movflags +faststart "frontend\public\videos\cam2_compressed.mp4"
```

### CamA1 (Pouring Station) - 4 GB → ~100-150 MB
```powershell
ffmpeg -i "frontend\public\videos\cama1.mp4" -vcodec libx264 -crf 28 -preset fast -acodec aac -b:a 128k -movflags +faststart "frontend\public\videos\cama1_compressed.mp4"
```

## Quick Compression (Lower Quality, Smaller Size)
```powershell
# Cam2 - Very small (~20-30 MB)
ffmpeg -i "frontend\public\videos\cam2.mp4" -vcodec libx264 -crf 32 -preset fast -vf "scale=1280:720" -acodec aac -b:a 96k -movflags +faststart "frontend\public\videos\cam2_small.mp4"

# CamA1 - Very small (~50-80 MB)
ffmpeg -i "frontend\public\videos\cama1.mp4" -vcodec libx264 -crf 32 -preset fast -vf "scale=1280:720" -acodec aac -b:a 96k -movflags +faststart "frontend\public\videos\cama1_small.mp4"
```

## After Compression
Update `frontend/src/config/videos.js` to use compressed versions:
```javascript
{
  id: 'cctv_cam2',
  title: 'CCTV Camera 2 - Furnace Area',
  src: '/videos/cam2_compressed.mp4',  // or cam2_small.mp4
  duration: '10:15',
},
{
  id: 'cctv_cama1',
  title: 'CCTV Camera A1 - Pouring Station',
  src: '/videos/cama1_compressed.mp4',  // or cama1_small.mp4
  duration: '15:30',
},
```

## Current Video Sizes (Before Compression)
| File | Size | Recommended Action |
|------|------|-------------------|
| demo_foundry_pipeline.mp4 | 46 MB | ✅ Good as-is |
| foundry_process_2min.mp4 | 86 MB | ✅ Good as-is |
| cam2.mp4 | 627 MB | ⚠️ Compress |
| cama1.mp4 | 4 GB | ⚠️ Compress |

## FFmpeg Options Explained
- `-crf 28` : Quality (18-28 good, lower = better quality, 28 = web optimized)
- `-preset fast` : Encoding speed (ultrafast, fast, medium, slow)
- `-vf "scale=1280:720"` : Resize to 720p for web
- `-movflags +faststart` : Enable streaming (moov atom at start)
- `-acodec aac -b:a 128k` : Audio codec and bitrate