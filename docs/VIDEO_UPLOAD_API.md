# Video Upload API Documentation

## Overview

This document provides comprehensive guidance for frontend developers implementing video upload functionality for **Moments** and **Stories** (YouTube-style).

### Key Features
- **Max Duration**: 10 minutes (600 seconds)
- **Max File Size**: 1GB (1024MB)
- **Supported Formats**: MP4, MOV, AVI, WebM, 3GP, M4V
- **Auto Thumbnails**: Generated server-side
- **Streaming Upload**: Memory-efficient, no client-side chunking required

---

## How Video Upload Works

### Simple Flow Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDEO UPLOAD PROCESS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   FRONTEND (Your App)                         BACKEND (Our Server)           │
│   ═══════════════════                         ════════════════════           │
│                                                                              │
│   1. User picks video                                                        │
│          │                                                                   │
│          ▼                                                                   │
│   2. Validate locally ◄─── Check: size < 1GB, duration < 10 min             │
│          │                                                                   │
│          ▼                                                                   │
│   3. Send FormData ─────────────────────────► 4. Receive & stream to cloud  │
│      (multipart/form-data)                           │                       │
│                                                      ▼                       │
│                                               5. Validate duration           │
│                                                  (using ffprobe)             │
│                                                      │                       │
│                                                      ▼                       │
│                                               6. Generate thumbnail          │
│                                                  (using ffmpeg)              │
│                                                      │                       │
│                                                      ▼                       │
│   8. Display video ◄──────────────────────── 7. Return video URL + metadata │
│      in your app                                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Explanation

| Step | Where | What Happens |
|------|-------|--------------|
| **1** | Frontend | User selects a video from their device (camera roll, gallery, or records new) |
| **2** | Frontend | Your app validates the video BEFORE uploading (check file size & duration) |
| **3** | Frontend | Send the video as `FormData` with `multipart/form-data` content type |
| **4** | Backend | Server receives the video and streams it directly to cloud storage (DigitalOcean Spaces) |
| **5** | Backend | Server validates video duration using `ffprobe` (if too long, video is deleted and error returned) |
| **6** | Backend | Server generates a thumbnail image from the video at 1-second mark using `ffmpeg` |
| **7** | Backend | Server returns the video URL, thumbnail URL, and metadata (duration, dimensions, size) |
| **8** | Frontend | Your app displays the video using the returned URLs |

### For Moments vs Stories

| Feature | Moments | Stories |
|---------|---------|---------|
| **Create** | First create moment (text), then add video | Create with video in one request |
| **Endpoint** | `PUT /api/v1/moments/:id/video` | `POST /api/v1/stories/video` |
| **Flow** | Two-step process | One-step process |
| **Video Limit** | 1 video per moment | 1 video per story |

### What You Get Back

When upload succeeds, you receive:
```javascript
{
  video: {
    url: "https://cdn.../video.mp4",      // Use this to play the video
    thumbnail: "https://cdn.../thumb.jpg", // Use this as preview image
    duration: 45.5,                        // Duration in seconds
    width: 1080,                           // Video width in pixels
    height: 1920,                          // Video height in pixels
    mimeType: "video/mp4",                 // File type
    fileSize: 15728640                     // Size in bytes
  }
}
```

---

## Table of Contents
1. [Get Upload Configuration](#1-get-upload-configuration)
2. [Moments Video API](#2-moments-video-api)
3. [Stories Video API](#3-stories-video-api)
4. [Frontend Implementation Guide](#4-frontend-implementation-guide)
5. [Error Handling](#5-error-handling)
6. [Best Practices](#6-best-practices)

---

## 1. Get Upload Configuration

Before uploading, fetch the server's video constraints for client-side validation.

### Moments Config
```
GET /api/v1/moments/video-config
```

### Stories Config
```
GET /api/v1/stories/video-config
```

### Response
```json
{
  "success": true,
  "data": {
    "video": {
      "maxDuration": 600,
      "maxDurationFormatted": "10:00",
      "maxSize": 1073741824,
      "maxSizeMB": 1024,
      "maxSizeGB": 1,
      "allowedTypes": [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
        "video/3gpp",
        "video/x-m4v"
      ],
      "allowedExtensions": [".mp4", ".mov", ".avi", ".webm", ".3gp", ".m4v"],
      "recommendedFormat": "video/mp4",
      "recommendedCodec": "H.264",
      "recommendedResolution": {
        "maxWidth": 1080,
        "maxHeight": 1920,
        "aspectRatios": ["9:16", "16:9", "1:1", "4:5"]
      }
    },
    "image": {
      "maxSize": 10485760,
      "maxSizeMB": 10,
      "maxImagesPerMoment": 10,
      "allowedTypes": ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
      "allowedExtensions": [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    }
  }
}
```

---

## 2. Moments Video API

### 2.1 Upload Video to Moment

Upload a video to an existing moment.

```
PUT /api/v1/moments/:momentId/video
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Request Body (FormData)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `video` | File | Yes | Video file (max 1GB, max 10 min) |

#### cURL Example
```bash
curl -X PUT \
  'https://api.example.com/api/v1/moments/64abc123def456/video' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'video=@/path/to/video.mp4'
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "_id": "64abc123def456",
    "video": {
      "url": "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/moments/videos/moment-1234567890-abc123.mp4",
      "thumbnail": "https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/moments/videos/moment-1234567890-abc123-thumb.jpg",
      "duration": 45.5,
      "width": 1080,
      "height": 1920,
      "mimeType": "video/mp4",
      "fileSize": 15728640
    },
    "mediaType": "video"
  },
  "message": "Video uploaded successfully"
}
```

### 2.2 Delete Video from Moment

```
DELETE /api/v1/moments/:momentId/video
Authorization: Bearer <token>
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "_id": "64abc123def456",
    "mediaType": "text"
  },
  "message": "Video deleted successfully"
}
```

### 2.3 Get Moment (includes video)

```
GET /api/v1/moments/:momentId
```

#### Response with Video
```json
{
  "success": true,
  "data": {
    "_id": "64abc123def456",
    "title": "My Video Moment",
    "description": "Check out this cool video!",
    "user": {
      "_id": "64user123",
      "name": "John Doe",
      "images": ["..."],
      "imageUrls": ["..."]
    },
    "images": [],
    "imageUrls": [],
    "video": {
      "url": "https://cdn.example.com/video.mp4",
      "thumbnail": "https://cdn.example.com/video-thumb.jpg",
      "duration": 45.5,
      "width": 1080,
      "height": 1920,
      "mimeType": "video/mp4",
      "fileSize": 15728640
    },
    "mediaType": "video",
    "likeCount": 10,
    "commentCount": 5,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 3. Stories Video API

### 3.1 Create Video Story

Create a new story with a video.

```
POST /api/v1/stories/video
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Request Body (FormData)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `video` | File | Yes | Video file (max 1GB, max 10 min) |
| `text` | String | No | Optional text overlay |
| `backgroundColor` | String | No | Background color (default: #000000) |
| `textColor` | String | No | Text color (default: #ffffff) |
| `privacy` | String | No | `public`, `friends`, `close_friends` (default: friends) |

#### cURL Example
```bash
curl -X POST \
  'https://api.example.com/api/v1/stories/video' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'video=@/path/to/video.mp4' \
  -F 'text=Having a great day!' \
  -F 'privacy=friends'
```

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "_id": "64story789",
    "user": {
      "_id": "64user123",
      "name": "John Doe",
      "images": ["..."],
      "imageUrls": ["..."]
    },
    "mediaUrls": ["https://cdn.example.com/story-video.mp4"],
    "mediaUrl": "https://cdn.example.com/story-video.mp4",
    "mediaType": "video",
    "videoMetadata": {
      "duration": 15.2,
      "thumbnail": "https://cdn.example.com/story-video-thumb.jpg",
      "width": 1080,
      "height": 1920,
      "mimeType": "video/mp4",
      "fileSize": 5242880
    },
    "thumbnail": "https://cdn.example.com/story-video-thumb.jpg",
    "text": "Having a great day!",
    "backgroundColor": "#000000",
    "textColor": "#ffffff",
    "privacy": "friends",
    "expiresAt": "2024-01-16T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 3.2 Get Stories Feed (includes video metadata)

```
GET /api/v1/stories/feed
Authorization: Bearer <token>
```

#### Response
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "64user123",
      "user": {
        "_id": "64user123",
        "name": "John Doe",
        "imageUrls": ["..."]
      },
      "stories": [
        {
          "_id": "64story789",
          "mediaUrl": "https://cdn.example.com/story-video.mp4",
          "mediaType": "video",
          "thumbnail": "https://cdn.example.com/story-video-thumb.jpg",
          "videoMetadata": {
            "duration": 15.2,
            "width": 1080,
            "height": 1920
          },
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ],
      "hasUnviewed": 1
    }
  ]
}
```

---

## 4. Frontend Implementation Guide

### 4.1 React Native / iOS / Android

#### Video Picker Configuration
```javascript
// React Native with react-native-image-picker
import { launchImageLibrary } from 'react-native-image-picker';

const pickVideo = async () => {
  const result = await launchImageLibrary({
    mediaType: 'video',
    videoQuality: 'high',
    durationLimit: 600, // 10 minutes max
  });

  if (result.assets?.[0]) {
    const video = result.assets[0];

    // Validate before upload
    if (video.duration > 600) {
      alert('Video must be under 10 minutes');
      return;
    }

    if (video.fileSize > 1024 * 1024 * 1024) {
      alert('Video must be under 1GB');
      return;
    }

    return video;
  }
};
```

#### Upload with Progress
```javascript
const uploadVideoToMoment = async (momentId, videoUri, onProgress) => {
  const formData = new FormData();
  formData.append('video', {
    uri: videoUri,
    type: 'video/mp4',
    name: 'video.mp4',
  });

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/moments/${momentId}/video`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
        // For progress tracking with XMLHttpRequest
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data;
  } catch (error) {
    console.error('Video upload error:', error);
    throw error;
  }
};
```

#### Upload with XMLHttpRequest (Progress Support)
```javascript
const uploadWithProgress = (momentId, videoFile, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('video', {
      uri: videoFile.uri,
      type: videoFile.type || 'video/mp4',
      name: videoFile.fileName || 'video.mp4',
    });

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(JSON.parse(xhr.responseText).error));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('PUT', `${API_BASE_URL}/api/v1/moments/${momentId}/video`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};
```

### 4.2 Video Duration Validation (Client-Side)

```javascript
// React Native
import { getVideoMetaData } from 'react-native-compressor';

const validateVideoDuration = async (videoUri) => {
  const metadata = await getVideoMetaData(videoUri);

  if (metadata.duration > 600) {
    throw new Error(`Video is ${Math.ceil(metadata.duration)}s. Maximum is 600s (10 minutes).`);
  }

  return metadata;
};

// Web (HTML5)
const getVideoDuration = (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => reject(new Error('Invalid video file'));
    video.src = URL.createObjectURL(file);
  });
};
```

### 4.3 Video Compression (Recommended)

For better upload performance, compress videos before uploading:

```javascript
// React Native with react-native-compressor
import { Video } from 'react-native-compressor';

const compressVideo = async (videoUri) => {
  const compressed = await Video.compress(videoUri, {
    compressionMethod: 'auto',
    maxSize: 1080, // Max dimension
    bitrate: 2000000, // 2 Mbps
  });

  return compressed;
};
```

### 4.4 Video Player Component

```jsx
// React Native Video Player
import Video from 'react-native-video';

const VideoMoment = ({ moment }) => {
  const [isPaused, setIsPaused] = useState(true);

  if (moment.mediaType !== 'video' || !moment.video?.url) {
    return null;
  }

  return (
    <View>
      {/* Thumbnail overlay when paused */}
      {isPaused && moment.video.thumbnail && (
        <Image
          source={{ uri: moment.video.thumbnail }}
          style={styles.thumbnail}
        />
      )}

      <Video
        source={{ uri: moment.video.url }}
        style={styles.video}
        paused={isPaused}
        resizeMode="contain"
        onPress={() => setIsPaused(!isPaused)}
        repeat
      />

      {/* Duration badge */}
      <View style={styles.durationBadge}>
        <Text>{formatDuration(moment.video.duration)}</Text>
      </View>
    </View>
  );
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
```

---

## 5. Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common Error Codes

| Status | Error | Description | Client Action |
|--------|-------|-------------|---------------|
| 400 | `Video duration (X seconds) exceeds maximum of 600 seconds (10 minutes)` | Video too long | Trim video or show duration limit |
| 400 | `Video size exceeds maximum limit of 1024MB` | File too large | Compress video |
| 400 | `Invalid video format. Allowed: MP4, MOV, AVI, WebM, 3GP, M4V` | Wrong format | Convert to MP4 |
| 400 | `Please upload a video file` | No file sent | Check FormData |
| 403 | `Not authorized to upload video to this moment` | Not owner | Check ownership |
| 404 | `Moment not found with id of X` | Invalid ID | Verify moment exists |
| 500 | `Video processing service unavailable` | ffmpeg not installed | Contact backend team |

### Error Handling Example
```javascript
const handleVideoUpload = async (momentId, video) => {
  try {
    const result = await uploadVideoToMoment(momentId, video.uri);
    return result;
  } catch (error) {
    const message = error.message || 'Upload failed';

    if (message.includes('duration')) {
      Alert.alert('Video Too Long', 'Please select a video under 10 minutes.');
    } else if (message.includes('size') || message.includes('1024MB') || message.includes('1GB')) {
      Alert.alert('File Too Large', 'Please compress your video or select a smaller file.');
    } else if (message.includes('format')) {
      Alert.alert('Invalid Format', 'Please use MP4, MOV, or WebM format.');
    } else if (message.includes('authorized')) {
      Alert.alert('Permission Denied', 'You can only upload to your own moments.');
    } else {
      Alert.alert('Upload Failed', message);
    }

    throw error;
  }
};
```

---

## 6. Best Practices

### 6.1 Pre-Upload Validation
Always validate on the client before uploading to save bandwidth and provide instant feedback:

```javascript
const validateVideo = async (video) => {
  const errors = [];

  // Check duration
  if (video.duration > 600) {
    errors.push(`Video is ${Math.ceil(video.duration)}s (max 600s / 10 minutes)`);
  }

  // Check file size
  if (video.fileSize > 1024 * 1024 * 1024) {
    errors.push(`Video is ${(video.fileSize / 1024 / 1024).toFixed(1)}MB (max 1GB)`);
  }

  // Check format
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
  if (!allowedTypes.includes(video.type)) {
    errors.push('Please use MP4, MOV, or WebM format');
  }

  return errors;
};
```

### 6.2 Upload Progress UI
```jsx
const UploadProgressBar = ({ progress, status }) => (
  <View style={styles.container}>
    <View style={[styles.progressBar, { width: `${progress}%` }]} />
    <Text style={styles.text}>
      {status === 'uploading' && `Uploading... ${progress}%`}
      {status === 'processing' && 'Processing video...'}
      {status === 'complete' && 'Upload complete!'}
    </Text>
  </View>
);
```

### 6.3 Retry Logic
```javascript
const uploadWithRetry = async (fn, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry validation errors
      if (error.message.includes('duration') ||
          error.message.includes('format') ||
          error.message.includes('authorized')) {
        throw error;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError;
};
```

### 6.4 Thumbnail Display
Use the server-generated thumbnail for video previews in feeds:

```jsx
const MomentCard = ({ moment }) => (
  <View style={styles.card}>
    {moment.mediaType === 'video' ? (
      <View>
        <Image
          source={{ uri: moment.video?.thumbnail }}
          style={styles.thumbnail}
        />
        <View style={styles.playButton}>
          <PlayIcon />
        </View>
        <View style={styles.duration}>
          <Text>{formatDuration(moment.video?.duration)}</Text>
        </View>
      </View>
    ) : (
      <Image source={{ uri: moment.imageUrls?.[0] }} style={styles.image} />
    )}
  </View>
);
```

### 6.5 Caching Config
Cache the video config to avoid repeated API calls:

```javascript
let cachedConfig = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const getVideoConfig = async () => {
  if (cachedConfig && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedConfig;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/moments/video-config`);
  cachedConfig = await response.json();
  cacheTime = Date.now();

  return cachedConfig;
};
```

---

## Quick Reference

### Moments Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/moments/video-config` | Get upload constraints |
| PUT | `/api/v1/moments/:id/video` | Upload video |
| DELETE | `/api/v1/moments/:id/video` | Delete video |

### Stories Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/stories/video-config` | Get upload constraints |
| POST | `/api/v1/stories/video` | Create video story |

### Video Constraints
| Constraint | Value |
|------------|-------|
| Max Duration | 600 seconds (10 minutes) |
| Max File Size | 1 GB (1024 MB) |
| Allowed Formats | MP4, MOV, AVI, WebM, 3GP, M4V |
| Recommended Format | MP4 (H.264) |
| Max Resolution | 1080 x 1920 |

---

## Changelog

- **v1.1.0** - YouTube-style video upload limits
  - Increased duration limit to 10 minutes (600 seconds)
  - Increased file size limit to 1GB (1024MB)
  - Updated file type validation for all video formats

- **v1.0.0** - Initial video upload support for Moments and Stories
  - Streaming upload to S3/Spaces
  - 3-minute duration limit with server-side validation
  - Auto-generated thumbnails
  - Video metadata in API responses
