# BanaTalk Learning System - Frontend Implementation Guide

## Overview

This document provides frontend developers with all the necessary information to implement the new language learning features in the BanaTalk mobile app. The learning system includes gamification (XP, levels, streaks, badges), vocabulary with spaced repetition, structured lessons, quizzes, and daily/weekly challenges.

---

## Table of Contents

1. [API Base URL](#api-base-url)
2. [Authentication](#authentication)
3. [Learning Progress](#learning-progress)
4. [Vocabulary System](#vocabulary-system)
5. [Lessons](#lessons)
6. [Quizzes](#quizzes)
7. [Achievements](#achievements)
8. [Challenges](#challenges)
9. [Data Models](#data-models)
10. [Real-time Events](#real-time-events)
11. [UI Components Needed](#ui-components-needed)
12. [XP Rewards Reference](#xp-rewards-reference)

---

## API Base URL

All endpoints are prefixed with:
```
/api/v1/learning
```

---

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Learning Progress

### Get User Progress
```http
GET /api/v1/learning/progress
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "user": "userId",
    "totalXP": 1250,
    "level": 8,
    "currentStreak": 5,
    "longestStreak": 12,
    "streakFreezes": 2,
    "dailyXP": 45,
    "weeklyXP": 320,
    "dailyGoal": 50,
    "weeklyGoal": 300,
    "dailyGoalProgress": 0.9,
    "weeklyGoalProgress": 1.07,
    "daysCompletedThisWeek": 5,
    "lastActivityDate": "2024-01-15T10:30:00Z",
    "stats": {
      "totalMessages": 245,
      "messagesInTargetLanguage": 180,
      "correctionsGiven": 32,
      "correctionsReceived": 28,
      "correctionsAccepted": 25,
      "lessonsCompleted": 15,
      "quizzesTaken": 5,
      "vocabularyLearned": 120,
      "vocabularyMastered": 45,
      "timeSpentLearning": 3600
    },
    "weeklyRank": 42,
    "allTimeRank": 156,
    "levelInfo": {
      "current": 8,
      "xpForCurrent": 1225,
      "xpForNext": 1600,
      "progress": 0.067,
      "xpNeeded": 350
    }
  }
}
```

### Get Leaderboard
```http
GET /api/v1/learning/progress/leaderboard?type=weekly&language=es&limit=50
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| type | string | weekly | `weekly` or `allTime` |
| language | string | null | Filter by target language |
| limit | number | 50 | Max results (max 100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "user": {
          "_id": "...",
          "name": "John",
          "profilePicture": "url",
          "learningStats": { "level": 15 }
        },
        "xp": 1250,
        "level": 15
      }
    ],
    "userPosition": {
      "rank": 42,
      "xp": 320,
      "level": 8
    },
    "total": 1500
  }
}
```

### Get/Update Daily Goals
```http
GET /api/v1/learning/progress/daily-goals
PUT /api/v1/learning/progress/daily-goals
```

**PUT Body:**
```json
{
  "dailyGoal": 100,
  "weeklyGoal": 500
}
```

**Goal Presets:**
| Level | Daily XP | Weekly XP |
|-------|----------|-----------|
| Casual | 20 | 100 |
| Regular | 50 | 300 |
| Serious | 100 | 600 |
| Intense | 150 | 1000 |

---

## Vocabulary System

The vocabulary system uses Spaced Repetition (SRS) for optimal learning.

### Get Vocabulary List
```http
GET /api/v1/learning/vocabulary?language=es&srsLevel=0-5&limit=50&offset=0
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| language | string | Filter by language |
| srsLevel | string | Filter by SRS level (e.g., "0-3", "5-9") |
| search | string | Search in word/translation |
| tags | string | Comma-separated tags |
| limit | number | Results per page (default 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "word": "hola",
      "translation": "hello",
      "language": "es",
      "pronunciation": "OH-lah",
      "partOfSpeech": "interjection",
      "exampleSentence": "Hola, como estas?",
      "exampleTranslation": "Hello, how are you?",
      "srsLevel": 3,
      "nextReview": "2024-01-16T09:00:00Z",
      "reviewCount": 5,
      "correctCount": 4,
      "tags": ["greetings", "basics"],
      "notes": "Very common greeting",
      "context": {
        "source": "conversation",
        "conversationId": "...",
        "messageId": "..."
      }
    }
  ],
  "pagination": {
    "total": 120,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Add Vocabulary Word
```http
POST /api/v1/learning/vocabulary
```

**Body:**
```json
{
  "word": "hola",
  "translation": "hello",
  "language": "es",
  "pronunciation": "OH-lah",
  "partOfSpeech": "interjection",
  "exampleSentence": "Hola, como estas?",
  "exampleTranslation": "Hello, how are you?",
  "tags": ["greetings", "basics"],
  "notes": "User note here",
  "context": {
    "source": "conversation",
    "conversationId": "convId",
    "messageId": "msgId"
  }
}
```

### Get Words Due for Review
```http
GET /api/v1/learning/vocabulary/review?language=es&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dueWords": [...],
    "totalDue": 15,
    "reviewSession": {
      "estimatedMinutes": 5,
      "xpPotential": 15
    }
  }
}
```

### Submit Review Result
```http
POST /api/v1/learning/vocabulary/:id/review
```

**Body:**
```json
{
  "correct": true,
  "responseTime": 2500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vocabulary": {
      "_id": "...",
      "srsLevel": 4,
      "nextReview": "2024-01-20T09:00:00Z"
    },
    "xpEarned": 1,
    "mastered": false,
    "message": "Great! Next review in 4 days"
  }
}
```

### Get Vocabulary Statistics
```http
GET /api/v1/learning/vocabulary/stats?language=es
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 120,
    "mastered": 45,
    "learning": 60,
    "new": 15,
    "dueToday": 12,
    "byLanguage": {
      "es": 80,
      "ja": 40
    },
    "bySrsLevel": {
      "0": 15,
      "1": 20,
      "2": 25,
      "3": 15,
      "9": 45
    },
    "reviewStreak": 5,
    "averageAccuracy": 0.85
  }
}
```

### SRS Level Reference
| Level | Interval | Status |
|-------|----------|--------|
| 0 | Same day | New |
| 1 | 1 day | Learning |
| 2 | 2 days | Learning |
| 3 | 4 days | Learning |
| 4 | 1 week | Known |
| 5 | 2 weeks | Known |
| 6 | 1 month | Known |
| 7 | 2 months | Known |
| 8 | 4 months | Known |
| 9 | 1 year | Mastered |

---

## Lessons

### Get Lessons Curriculum
```http
GET /api/v1/learning/lessons?language=es&level=A1&category=grammar
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| language | string | Required - target language |
| level | string | CEFR level: A1, A2, B1, B2, C1, C2 |
| category | string | grammar, vocabulary, conversation, etc. |
| unit | number | Unit number |

**Response:**
```json
{
  "success": true,
  "data": {
    "lessons": [
      {
        "_id": "...",
        "title": "Greetings and Introductions",
        "slug": "greetings-and-introductions-es",
        "description": "Learn basic greetings",
        "language": "es",
        "level": "A1",
        "category": "conversation",
        "topic": "Greetings",
        "icon": "hand-wave",
        "estimatedMinutes": 10,
        "xpReward": 20,
        "isPremium": false,
        "unit": {
          "number": 1,
          "name": "Basics"
        },
        "orderInUnit": 1,
        "userProgress": {
          "status": "completed",
          "completedAt": "2024-01-10T15:30:00Z",
          "score": 95,
          "perfectScore": true
        }
      }
    ],
    "units": [
      {
        "number": 1,
        "name": "Basics",
        "lessonsCount": 5,
        "completedCount": 3
      }
    ],
    "userStats": {
      "totalCompleted": 15,
      "currentLevel": "A2"
    }
  }
}
```

### Get Recommended Lessons
```http
GET /api/v1/learning/lessons/recommended?language=es&limit=5
```

Returns personalized lesson recommendations based on user progress.

### Get Single Lesson
```http
GET /api/v1/learning/lessons/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Greetings and Introductions",
    "description": "Learn basic greetings",
    "language": "es",
    "level": "A1",
    "category": "conversation",
    "introduction": "In this lesson, you will learn...",
    "content": [
      {
        "type": "text",
        "title": "Common Greetings",
        "body": "Hola - Hello\nBuenos dias - Good morning...",
        "order": 1
      },
      {
        "type": "example",
        "title": "Example Dialogue",
        "body": "Hola, me llamo Juan.",
        "translation": "Hello, my name is Juan.",
        "order": 2
      },
      {
        "type": "audio",
        "title": "Listen and Repeat",
        "audioUrl": "https://...",
        "order": 3
      },
      {
        "type": "tip",
        "title": "Cultural Note",
        "body": "In Spanish-speaking countries...",
        "order": 4
      }
    ],
    "exercises": [
      {
        "type": "multiple_choice",
        "question": "What does 'Hola' mean?",
        "options": [
          { "text": "Goodbye", "isCorrect": false },
          { "text": "Hello", "isCorrect": true },
          { "text": "Thank you", "isCorrect": false },
          { "text": "Please", "isCorrect": false }
        ],
        "points": 10,
        "order": 1
      },
      {
        "type": "fill_blank",
        "question": "Complete: Buenos _____ (Good morning)",
        "correctAnswer": "dias",
        "acceptedAnswers": ["dias", "días"],
        "hint": "Think about the time of day",
        "points": 10,
        "order": 2
      },
      {
        "type": "translation",
        "question": "Translate: My name is Maria",
        "correctAnswer": "Me llamo Maria",
        "acceptedAnswers": ["Me llamo Maria", "Mi nombre es Maria"],
        "points": 15,
        "order": 3
      },
      {
        "type": "matching",
        "question": "Match the greetings",
        "pairs": [
          { "left": "Good morning", "right": "Buenos dias" },
          { "left": "Good night", "right": "Buenas noches" }
        ],
        "points": 20,
        "order": 4
      },
      {
        "type": "ordering",
        "question": "Arrange the words correctly",
        "scrambledItems": ["llamo", "Me", "Juan"],
        "correctOrder": ["Me", "llamo", "Juan"],
        "points": 15,
        "order": 5
      }
    ],
    "xpReward": 20,
    "perfectBonus": 5,
    "estimatedMinutes": 10,
    "userProgress": null
  }
}
```

### Start Lesson
```http
POST /api/v1/learning/lessons/:id/start
```

Creates a lesson progress record and returns the lesson content.

### Submit Lesson
```http
POST /api/v1/learning/lessons/:id/submit
```

**Body:**
```json
{
  "answers": [
    { "exerciseIndex": 0, "answer": "Hello" },
    { "exerciseIndex": 1, "answer": "dias" },
    { "exerciseIndex": 2, "answer": "Me llamo Maria" },
    { "exerciseIndex": 3, "answer": [["Good morning", "Buenos dias"], ["Good night", "Buenas noches"]] },
    { "exerciseIndex": 4, "answer": ["Me", "llamo", "Juan"] }
  ],
  "timeSpent": 480
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 95,
    "totalPoints": 70,
    "earnedPoints": 65,
    "xpEarned": 25,
    "perfectScore": false,
    "results": [
      { "exerciseIndex": 0, "correct": true, "points": 10 },
      { "exerciseIndex": 1, "correct": true, "points": 10 },
      { "exerciseIndex": 2, "correct": true, "points": 15 },
      { "exerciseIndex": 3, "correct": true, "points": 20 },
      { "exerciseIndex": 4, "correct": false, "points": 0, "correctAnswer": ["Me", "llamo", "Juan"] }
    ],
    "newLevel": null,
    "achievementsUnlocked": []
  }
}
```

---

## Quizzes

### Get Available Quizzes
```http
GET /api/v1/learning/quizzes?language=es&type=placement
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| language | string | Target language |
| type | string | placement, assessment, practice |
| level | string | CEFR level for practice quizzes |

### Submit Quiz
```http
POST /api/v1/learning/quizzes/:id/submit
```

**Body:**
```json
{
  "answers": [
    { "questionIndex": 0, "answer": "B" },
    { "questionIndex": 1, "answer": "hablo" }
  ],
  "timeSpent": 900
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "xpEarned": 30,
    "determinedLevel": "A2",
    "results": [...],
    "recommendations": [
      "Focus on verb conjugations",
      "Practice listening exercises"
    ]
  }
}
```

---

## Achievements

### Get All Achievements
```http
GET /api/v1/learning/achievements
```

**Response:**
```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "_id": "...",
        "name": "First Steps",
        "description": "Complete your first lesson",
        "category": "beginner",
        "icon": "footprints",
        "xpReward": 10,
        "rarity": "common",
        "requirement": {
          "type": "lessons_completed",
          "value": 1
        },
        "userProgress": {
          "unlocked": true,
          "unlockedAt": "2024-01-05T10:30:00Z",
          "progress": 1,
          "percentage": 100
        }
      },
      {
        "_id": "...",
        "name": "Word Collector",
        "description": "Save 100 vocabulary words",
        "category": "vocabulary",
        "icon": "book",
        "xpReward": 50,
        "rarity": "rare",
        "requirement": {
          "type": "vocabulary_saved",
          "value": 100
        },
        "userProgress": {
          "unlocked": false,
          "progress": 45,
          "percentage": 45
        }
      }
    ],
    "stats": {
      "total": 42,
      "unlocked": 12,
      "percentage": 28.6
    },
    "byCategory": {
      "beginner": { "total": 5, "unlocked": 5 },
      "vocabulary": { "total": 8, "unlocked": 2 },
      "lessons": { "total": 10, "unlocked": 3 },
      "streaks": { "total": 7, "unlocked": 1 },
      "social": { "total": 6, "unlocked": 1 },
      "milestones": { "total": 6, "unlocked": 0 }
    }
  }
}
```

### Achievement Categories
| Category | Description |
|----------|-------------|
| beginner | First-time accomplishments |
| vocabulary | Vocabulary milestones |
| lessons | Lesson completion milestones |
| streaks | Streak achievements |
| social | Conversation/correction related |
| milestones | XP and level milestones |

---

## Challenges

### Get Active Challenges
```http
GET /api/v1/learning/challenges
```

**Response:**
```json
{
  "success": true,
  "data": {
    "daily": [
      {
        "_id": "...",
        "title": "Message Master",
        "description": "Send 10 messages in your target language",
        "type": "daily",
        "category": "messaging",
        "requirement": {
          "type": "send_target_messages",
          "value": 10
        },
        "xpReward": 50,
        "icon": "message",
        "difficulty": "easy",
        "startsAt": "2024-01-15T00:00:00Z",
        "endsAt": "2024-01-16T00:00:00Z",
        "userProgress": {
          "currentProgress": 6,
          "completed": false,
          "percentage": 60
        }
      }
    ],
    "weekly": [
      {
        "_id": "...",
        "title": "Weekly Warrior",
        "description": "Earn 500 XP this week",
        "type": "weekly",
        "category": "mixed",
        "requirement": {
          "type": "earn_xp",
          "value": 500
        },
        "xpReward": 200,
        "bonusReward": {
          "type": "streak_freeze",
          "value": 1
        },
        "icon": "trophy",
        "difficulty": "medium",
        "userProgress": {
          "currentProgress": 320,
          "completed": false,
          "percentage": 64
        }
      }
    ],
    "special": []
  }
}
```

### Challenge Types
| Type | Duration | XP Range |
|------|----------|----------|
| daily | 24 hours | 30-100 |
| weekly | 7 days | 150-300 |
| special | Varies | 200-500 |

### Challenge Categories
- `messaging` - Send messages
- `vocabulary` - Add/review vocabulary
- `lessons` - Complete lessons
- `corrections` - Give/accept corrections
- `social` - Talk to partners
- `streak` - Maintain streaks
- `mixed` - Various activities

---

## Data Models

### User.learningStats (embedded in User model)
```typescript
interface LearningStats {
  currentStreak: number;
  longestStreak: number;
  totalXP: number;
  level: number;
  proficiencyLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  lessonsCompleted: number;
  vocabularyCount: number;
  vocabularyMastered: number;
  quizzesTaken: number;
  averageQuizScore: number;
  lastActivityDate: Date;
}
```

### User.learningPreferences (embedded in User model)
```typescript
interface LearningPreferences {
  dailyGoal: 20 | 50 | 100 | 150;
  reminderEnabled: boolean;
  reminderTime: string; // "09:00"
  soundEffects: boolean;
  hapticFeedback: boolean;
}
```

### Level Calculation
```javascript
// XP to Level
const level = Math.floor(Math.sqrt(totalXP / 25)) + 1;

// XP required for level
const xpForLevel = (level) => Math.pow(level - 1, 2) * 25;

// Progress to next level
const xpForCurrent = xpForLevel(level);
const xpForNext = xpForLevel(level + 1);
const progress = (totalXP - xpForCurrent) / (xpForNext - xpForCurrent);
```

---

## Real-time Events

The following socket events are emitted for real-time updates:

### XP Earned
```javascript
socket.on('xp_earned', (data) => {
  // data: { xp: 5, reason: 'message_target_language', newTotal: 1255, newLevel: null }
});
```

### Level Up
```javascript
socket.on('level_up', (data) => {
  // data: { newLevel: 9, previousLevel: 8, totalXP: 1650 }
});
```

### Achievement Unlocked
```javascript
socket.on('achievement_unlocked', (data) => {
  // data: { achievement: { name, icon, description, xpReward }, xpEarned: 50 }
});
```

### Streak Update
```javascript
socket.on('streak_update', (data) => {
  // data: { currentStreak: 6, longestStreak: 12, streakIncreased: true }
});
```

### Challenge Progress
```javascript
socket.on('challenge_progress', (data) => {
  // data: { challengeId, title, currentProgress, required, completed, xpEarned }
});
```

---

## UI Components Needed

### Progress Dashboard
- XP progress bar with level indicator
- Daily/weekly goal progress rings
- Streak counter with flame icon
- Quick stats grid (messages, lessons, vocabulary)

### Vocabulary Screen
- Word cards with flip animation for review
- SRS level indicator (color-coded)
- Search and filter options
- "Add from conversation" button
- Review session mode with progress bar

### Lessons Browser
- Unit/lesson tree view
- Lesson cards with completion status
- Progress indicators per unit
- Recommended lessons section
- Lock icons for premium content

### Lesson Player
- Content sections (text, examples, tips)
- Exercise components:
  - Multiple choice (radio buttons)
  - Fill in blank (text input)
  - Translation (text input with hints)
  - Matching (drag and drop)
  - Word ordering (drag and drop)
- Progress bar
- Submit button
- Results screen with animations

### Achievements Gallery
- Grid view with achievement cards
- Locked/unlocked states
- Progress indicators for locked
- Category tabs
- Unlock animation

### Challenges Screen
- Daily challenges section
- Weekly challenge card
- Progress bars
- Countdown timers
- Reward previews

### Leaderboard
- User ranking list
- Weekly/All-time tabs
- User's position highlight
- Avatar, name, XP display

### Notifications (In-App)
- XP earned toast
- Level up celebration modal
- Achievement unlocked modal
- Streak reminder
- Challenge completed toast

---

## XP Rewards Reference

| Activity | XP |
|----------|-----|
| Message in target language | 2 |
| Message in any language | 1 |
| Give correction | 5 |
| Accept correction | 3 |
| Complete lesson | 20 |
| Perfect lesson bonus | +5 |
| Complete quiz | 30 |
| Review vocabulary | 1 |
| Master vocabulary word | 10 |
| Daily goal complete | 20 |
| Weekly goal complete | 50 |
| Daily challenge | 30-100 |
| Weekly challenge | 150-300 |

### Streak Multiplier
| Streak Days | Multiplier |
|-------------|------------|
| 1-6 | 1.0x |
| 7-13 | 1.1x |
| 14-29 | 1.2x |
| 30-59 | 1.3x |
| 60-89 | 1.4x |
| 90+ | 1.5x |

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:
- 400: Bad request (validation error)
- 401: Unauthorized
- 403: Forbidden (premium content)
- 404: Not found
- 500: Server error

---

## Testing Endpoints

For development/testing:

```bash
# Seed achievements
node seeds/achievements.js

# Seed challenges
node seeds/challenges.js

# Seed lessons
node seeds/lessons.js
```

---

## Notes for Implementation

1. **Caching**: Consider caching leaderboard data and user progress locally to reduce API calls.

2. **Offline Support**: Vocabulary reviews could be queued locally and synced when online.

3. **Animations**: Use engaging animations for XP gains, level ups, and achievement unlocks to enhance gamification.

4. **Push Notifications**: The backend sends push notifications for:
   - Vocabulary review reminders (9 AM, 7 PM)
   - Streak at risk reminders (8 PM)
   - Challenge completion reminders

5. **Sound Effects**: If `learningPreferences.soundEffects` is true, play appropriate sounds for correct/incorrect answers, level ups, etc.

6. **Haptic Feedback**: If `learningPreferences.hapticFeedback` is true, provide haptic feedback on iOS/Android for interactions.
