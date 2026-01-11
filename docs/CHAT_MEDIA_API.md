# Chat Media API Documentation

## Overview

This document provides comprehensive guidance for frontend developers implementing media messaging features including **video messages**, **voice messages**, **image attachments**, and **location sharing**.

### Key Features
- **Video Messages**: Max 3 minutes, auto-thumbnail generation
- **Voice Messages**: Server-side duration extraction, waveform support
- **Image Attachments**: Standard image uploads
- **Location Sharing**: Coordinates with address lookup

---

## Table of Contents
1. [Get Media Configuration](#1-get-media-configuration)
2. [Video Messages](#2-video-messages)
3. [Voice Messages](#3-voice-messages)
4. [Image/Document Attachments](#4-imagedocument-attachments)
5. [Location Messages](#5-location-messages)
6. [Frontend Implementation Guide](#6-frontend-implementation-guide)
7. [Error Handling](#7-error-handling)
8. [Socket Events](#8-socket-events)

---

## 1. Get Media Configuration

Fetch media upload constraints before uploading.

```
GET /api/v1/messages/video-config
```

### Response
```json
{
  "success": true,
  "data": {
    "video": {
      "maxDuration": 180,
      "maxDurationFormatted": "3:00",
      "maxSize": 104857600,
      "maxSizeMB": 100,
      "allowedTypes": ["video/mp4", "video/quicktime", "video/webm"],
      "allowedExtensions": [".mp4", ".mov", ".webm"],
      "recommendedFormat": "video/mp4",
      "recommendedCodec": "H.264"
    },
    "voice": {
      "maxDuration": 300,
      "maxSize": 26214400,
      "allowedTypes": ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav"],
      "allowedExtensions": [".mp3", ".m4a", ".ogg", ".webm", ".wav"]
    }
  }
}
```

---

## 2. Video Messages

### 2.1 Send Video Message

Send a video message with auto-generated thumbnail.

```
POST /api/v1/messages/video
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Request Body (FormData)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `video` | File | Yes | Video file (max 100MB, max 3 min) |
| `receiver` | String | Yes | Receiver's user ID |

#### cURL Example
```bash
curl -X POST \
  'https://api.example.com/api/v1/messages/video' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'video=@/path/to/video.mp4' \
  -F 'receiver=64abc123def456'
```

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "_id": "64msg789xyz",
    "sender": {
      "_id": "64user123",
      "name": "John Doe",
      "images": ["..."]
    },
    "receiver": {
      "_id": "64abc123def456",
      "name": "Jane Smith",
      "images": ["..."]
    },
    "messageType": "media",
    "media": {
      "url": "https://cdn.example.com/messages/videos/video-123.mp4",
      "type": "video",
      "thumbnail": "https://cdn.example.com/messages/videos/video-123-thumb.jpg",
      "mimeType": "video/mp4",
      "fileSize": 15728640,
      "duration": 45.5,
      "dimensions": {
        "width": 1080,
        "height": 1920
      }
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 3. Voice Messages

### 3.1 Send Voice Message

Send a voice message. Duration is automatically extracted server-side if not provided.

```
POST /api/v1/messages/voice
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Request Body (FormData)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `voice` | File | Yes | Audio file (max 25MB) |
| `receiver` | String | Yes | Receiver's user ID |
| `duration` | Number | No | Duration in seconds (auto-extracted if not provided) |
| `waveform` | Array/String | No | Waveform amplitude data (0-1 values) |

#### cURL Example
```bash
curl -X POST \
  'https://api.example.com/api/v1/messages/voice' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'voice=@/path/to/audio.m4a' \
  -F 'receiver=64abc123def456' \
  -F 'waveform=[0.1,0.3,0.5,0.8,0.4,0.2]'
```

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "_id": "64msg456abc",
    "sender": {
      "_id": "64user123",
      "name": "John Doe",
      "images": ["..."]
    },
    "receiver": {
      "_id": "64abc123def456",
      "name": "Jane Smith",
      "images": ["..."]
    },
    "messageType": "voice",
    "media": {
      "url": "https://cdn.example.com/voice/audio-123.m4a",
      "type": "voice",
      "mimeType": "audio/mp4",
      "fileSize": 524288,
      "duration": 12.5,
      "waveform": [0.1, 0.3, 0.5, 0.8, 0.4, 0.2]
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 4. Image/Document Attachments

### 4.1 Send Message with Attachment

Send a text message with an image or document attachment.

```
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Request Body (FormData)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attachment` | File | No | Image/document file (max 10MB) |
| `message` | String | Conditional | Text message (required if no attachment) |
| `receiver` | String | Yes | Receiver's user ID |
| `replyTo` | String | No | Message ID to reply to |

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "_id": "64msg789",
    "sender": { "_id": "64user123", "name": "John Doe" },
    "receiver": { "_id": "64abc123", "name": "Jane Smith" },
    "message": "Check out this photo!",
    "media": {
      "url": "https://cdn.example.com/messages/image-123.jpg",
      "type": "image",
      "mimeType": "image/jpeg",
      "fileSize": 1048576,
      "fileName": "photo.jpg"
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 5. Location Messages

### 5.1 Send Location Message

Share your location with another user.

```
POST /api/v1/messages
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "receiver": "64abc123def456",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "San Francisco, CA",
    "placeName": "Union Square"
  }
}
```

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "_id": "64msg456",
    "sender": { "_id": "64user123", "name": "John Doe" },
    "receiver": { "_id": "64abc123", "name": "Jane Smith" },
    "media": {
      "type": "location",
      "location": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "address": "San Francisco, CA",
        "placeName": "Union Square"
      }
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 6. Frontend Implementation Guide

### 6.1 React Native Video Message

```javascript
import { launchImageLibrary } from 'react-native-image-picker';

const sendVideoMessage = async (receiverId) => {
  // Pick video
  const result = await launchImageLibrary({
    mediaType: 'video',
    videoQuality: 'high',
    durationLimit: 180, // 3 minutes max
  });

  if (!result.assets?.[0]) return;
  const video = result.assets[0];

  // Validate
  if (video.duration > 180) {
    Alert.alert('Error', 'Video must be under 3 minutes');
    return;
  }

  // Upload
  const formData = new FormData();
  formData.append('video', {
    uri: video.uri,
    type: video.type || 'video/mp4',
    name: video.fileName || 'video.mp4',
  });
  formData.append('receiver', receiverId);

  try {
    const response = await fetch(`${API_URL}/api/v1/messages/video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    return data.data;
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

### 6.2 Voice Message with Recording

```javascript
import { Audio } from 'expo-av';

const [recording, setRecording] = useState(null);
const [isRecording, setIsRecording] = useState(false);

const startRecording = async () => {
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') return;

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  setRecording(recording);
  setIsRecording(true);
};

const stopAndSendRecording = async (receiverId) => {
  setIsRecording(false);
  await recording.stopAndUnloadAsync();

  const uri = recording.getURI();
  const { durationMillis } = await recording.getStatusAsync();

  // Create FormData
  const formData = new FormData();
  formData.append('voice', {
    uri,
    type: 'audio/m4a',
    name: 'voice.m4a',
  });
  formData.append('receiver', receiverId);
  formData.append('duration', Math.round(durationMillis / 1000));

  const response = await fetch(`${API_URL}/api/v1/messages/voice`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  return response.json();
};
```

### 6.3 Video Message Player Component

```jsx
import Video from 'react-native-video';

const VideoMessage = ({ message }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { media } = message;

  if (media?.type !== 'video') return null;

  return (
    <View style={styles.videoContainer}>
      {/* Thumbnail when not playing */}
      {!isPlaying && media.thumbnail && (
        <TouchableOpacity onPress={() => setIsPlaying(true)}>
          <Image source={{ uri: media.thumbnail }} style={styles.thumbnail} />
          <View style={styles.playOverlay}>
            <PlayIcon size={48} color="white" />
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.duration}>
              {formatDuration(media.duration)}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Video player when playing */}
      {isPlaying && (
        <Video
          source={{ uri: media.url }}
          style={styles.video}
          controls
          resizeMode="contain"
          onEnd={() => setIsPlaying(false)}
        />
      )}
    </View>
  );
};
```

### 6.4 Voice Message Player with Waveform

```jsx
const VoiceMessage = ({ message, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { media } = message;

  const playVoice = async () => {
    const sound = new Audio.Sound();
    await sound.loadAsync({ uri: media.url });

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded) {
        setProgress(status.positionMillis / status.durationMillis);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setProgress(0);
        }
      }
    });

    setIsPlaying(true);
    await sound.playAsync();
  };

  return (
    <View style={[styles.voiceMessage, isOwn && styles.ownMessage]}>
      <TouchableOpacity onPress={isPlaying ? null : playVoice}>
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </TouchableOpacity>

      {/* Waveform visualization */}
      <View style={styles.waveform}>
        {(media.waveform || []).map((amplitude, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              { height: amplitude * 30 },
              progress > i / media.waveform.length && styles.waveformPlayed
            ]}
          />
        ))}
      </View>

      <Text style={styles.duration}>
        {formatDuration(media.duration)}
      </Text>
    </View>
  );
};
```

---

## 7. Error Handling

### Common Error Codes

| Status | Error | Description | Client Action |
|--------|-------|-------------|---------------|
| 400 | `Video duration exceeds maximum of 180 seconds` | Video too long | Trim video |
| 400 | `Video size exceeds maximum limit of 100MB` | File too large | Compress video |
| 400 | `Receiver and voice file are required` | Missing fields | Check FormData |
| 403 | `Cannot send message to this user` | User blocked | Show blocked message |
| 403 | `Message limit reached` | Daily limit exceeded | Show limit info |
| 404 | `Receiver not found` | Invalid user ID | Verify receiver |

### Error Handler Example

```javascript
const handleMediaSendError = (error) => {
  const message = error.message || error.error || 'Send failed';

  if (message.includes('duration')) {
    Alert.alert('Video Too Long', 'Videos must be under 3 minutes');
  } else if (message.includes('size') || message.includes('100MB')) {
    Alert.alert('File Too Large', 'Please compress your video');
  } else if (message.includes('blocked')) {
    Alert.alert('Cannot Send', 'You cannot message this user');
  } else if (message.includes('limit')) {
    Alert.alert('Limit Reached', 'You have reached your daily message limit');
  } else {
    Alert.alert('Send Failed', message);
  }
};
```

---

## 8. Socket Events

### Incoming Media Messages

Listen for new media messages in real-time.

```javascript
// Video message received
socket.on('newVideoMessage', (data) => {
  const { message, duration, thumbnail } = data;
  // Add to chat, show notification
});

// Voice message received
socket.on('newVoiceMessage', (data) => {
  const { message, duration } = data;
  // Add to chat, show notification
});

// General new message (includes image/location)
socket.on('newMessage', (data) => {
  const { message, hasMedia, mediaType } = data;
  // Handle based on mediaType
});
```

### Socket Event Payloads

**newVideoMessage**
```json
{
  "message": { /* full message object */ },
  "duration": 45.5,
  "thumbnail": "https://cdn.example.com/thumb.jpg"
}
```

**newVoiceMessage**
```json
{
  "message": { /* full message object */ },
  "duration": 12.5
}
```

---

## Quick Reference

### Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/messages/video-config` | Get media upload constraints |
| POST | `/api/v1/messages/video` | Send video message |
| POST | `/api/v1/messages/voice` | Send voice message |
| POST | `/api/v1/messages` | Send text/image/location message |

### Media Constraints

| Type | Max Size | Max Duration | Formats |
|------|----------|--------------|---------|
| Video | 100 MB | 3 minutes | MP4, MOV, WebM |
| Voice | 25 MB | 5 minutes | MP3, M4A, OGG, WAV |
| Image | 10 MB | - | JPG, PNG, GIF, WebP |
| Document | 50 MB | - | PDF, DOC, etc. |

### Response Media Object

```json
{
  "media": {
    "url": "https://cdn.example.com/file.mp4",
    "type": "video|voice|image|document|location",
    "thumbnail": "string (video only)",
    "mimeType": "string",
    "fileSize": 12345,
    "duration": 45.5,
    "dimensions": { "width": 1080, "height": 1920 },
    "waveform": [0.1, 0.3, 0.5],
    "location": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "address": "San Francisco, CA"
    }
  }
}
```

---

## Changelog

- **v1.1.0** - Added video message support with thumbnails and duration validation
- **v1.0.1** - Improved voice messages with server-side duration extraction
- **v1.0.0** - Initial chat media implementation
