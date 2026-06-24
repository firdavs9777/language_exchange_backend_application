# Exam Study Feature Design
**Date:** June 24, 2026  
**Feature:** AI-powered language exam preparation within BananaTalk  
**Status:** Design Review

---

## Overview

"Exam Study" is a new tab within the BananaTalk app's AI section that provides structured, AI-powered preparation for major language proficiency exams across 8 languages. Users select a language, choose an exam (e.g., IELTS for English), then practice specific sections with AI-generated and pre-built questions, receive real-time feedback, track progress, and follow AI-generated study plans.

---

## Goals & Success Criteria

- Enable users to prepare for language proficiency exams within BananaTalk
- Leverage OpenAI for question evaluation and personalized study plans
- Support 8 major languages and their popular exams
- Provide intuitive progression: Language → Exam → Section → Practice → Progress
- Hybrid content approach: pre-built authentic questions + AI-generated variety

---

## Data Model & Collections

### Hierarchical Structure
```
Language (English, Spanish, French, German, Chinese, Korean, Japanese, Italian)
├── Exam (IELTS, TOEFL, TOEIC, Cambridge, DELE, DELF, TestDaF, HSK, TOPIK, JLPT, CELI)
    ├── Section (Reading, Writing, Speaking, Listening, Vocabulary)
        └── Question (practice questions with metadata)
```

### Collections Schema

**`languages`**
```javascript
{
  _id: ObjectId,
  name: String,           // "English", "Spanish", etc.
  code: String,           // "en", "es", "fr", "de", "zh", "ko", "ja", "it"
  icon: String,           // emoji or image URL
  active: Boolean,        // feature flag
  createdAt: Date
}
```

**`exams`**
```javascript
{
  _id: ObjectId,
  name: String,           // "IELTS", "TOEFL", etc.
  languageId: ObjectId,   // ref to languages
  description: String,
  sections: [String],     // ["reading", "writing", "speaking", "listening", "vocabulary"]
  durationMinutes: Number,
  scoringType: String,    // "band" for IELTS, "score" for TOEFL
  maxScore: Number,
  active: Boolean,
  createdAt: Date
}
```

**`exam_sections`**
```javascript
{
  _id: ObjectId,
  examId: ObjectId,       // ref to exams
  sectionName: String,    // "Reading", "Writing", etc.
  sectionType: String,    // enum: reading, writing, speaking, listening, vocabulary
  description: String,
  durationMinutes: Number,
  questionCount: Number,  // target questions for this section
  createdAt: Date
}
```

**`exam_questions`**
```javascript
{
  _id: ObjectId,
  examId: ObjectId,
  sectionId: ObjectId,
  questionText: String,
  questionType: String,   // "multiple-choice", "essay", "speaking-prompt", "fill-blank"
  correctAnswer: String,  // for multiple-choice; null for essays/speaking
  options: [String],      // for multiple-choice
  audioUrl: String,       // for listening/speaking sections
  imageUrl: String,       // for visual questions
  explanation: String,    // why the answer is correct
  difficulty: String,     // "easy", "medium", "hard"
  source: String,         // "builtin" or "ai-generated"
  createdAt: Date,
  updatedAt: Date
}
```

**`user_exam_progress`**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  examId: ObjectId,
  sectionId: ObjectId,
  questionsAttempted: Number,
  questionsCorrect: Number,
  totalScore: Number,
  sectionScores: {
    reading: Number,
    writing: Number,
    speaking: Number,
    listening: Number,
    vocabulary: Number
  },
  lastAttemptedQuestionId: ObjectId,
  lastUpdated: Date
}
```

**`user_study_plans`**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  examId: ObjectId,
  targetScore: Number,
  targetExamDate: Date,
  createdAt: Date,
  plan: {
    milestones: [
      {
        week: Number,
        focus: String,        // "Improve reading speed", etc.
        tasks: [String],
        estimatedHours: Number
      }
    ],
    dailyLessons: [
      {
        date: Date,
        section: String,
        topic: String,
        estimatedMinutes: Number
      }
    ]
  },
  status: String            // "active", "completed", "abandoned"
}
```

**`ai_evaluation_cache`** (optional optimization)
```javascript
{
  _id: ObjectId,
  questionId: ObjectId,
  userAnswer: String,       // hash of answer for quick lookup
  score: Number,
  feedback: String,
  evaluatedAt: Date,
  ttl: 7776000              // 90 days; auto-cleanup
}
```

---

## User Flow

### Step 1: Language Selection
- User opens "Exam Study" tab
- Sees 8 language cards with icons/names
- Taps English → proceeds to exam selection

### Step 2: Exam Selection
- Shows exams available for selected language
- Example for English: IELTS, TOEFL, TOEIC, Cambridge
- Each exam displays: name, description, estimated prep time, section count
- User selects IELTS → exam dashboard

### Step 3: Exam Dashboard
- **Header:** Exam name, overall progress bar
- **Sections grid:** Reading, Writing, Speaking, Listening, Vocabulary
- **Quick actions:** 
  - "Take Full Mock Test" (future)
  - "Start Study Plan" (AI-generated)
  - "View Progress" (analytics)
  - "Continue Practice" (last attempted section)

### Step 4: Section Practice
- User taps "Reading"
- Sees list of 10-20 practice questions (mix of pre-built + AI-generated)
- User attempts question
- For multiple-choice: instant feedback + explanation
- For essays/speaking: AI evaluates → score + detailed feedback
- Progress saved automatically

### Step 5: Progress & Analytics
- View dashboard shows:
  - Score trends across sections
  - Weak areas identified by AI
  - Time spent per section
  - Recommendation: "Focus on vocabulary, you scored 65% vs 78% average"

### Step 6: AI Study Plan
- User taps "Start Study Plan"
- Inputs: target score + exam date
- AI generates personalized plan with:
  - Weekly milestones
  - Daily lessons tailored to weak areas
  - Estimated prep hours
- User can follow plan or choose custom practice

---

## API Endpoints

### Content Retrieval

**GET `/api/exam-study/languages`**
- Response: Array of all active languages
- Used by: Language selection screen

**GET `/api/exam-study/languages/:languageId/exams`**
- Response: Exams available for a language
- Used by: Exam selection screen

**GET `/api/exam-study/exams/:examId/sections`**
- Response: Sections within an exam
- Used by: Dashboard

**GET `/api/exam-study/sections/:sectionId/questions`**
- Query params: `?limit=10&difficulty=medium&source=builtin`
- Response: Practice questions for a section
- Supports filtering by difficulty and source

### Practice & Evaluation

**POST `/api/exam-study/questions/:questionId/submit-answer`**
- Body: `{ userAnswer: String, timeSpent: Number }`
- Returns: `{ score: Number, feedback: String, explanation: String, isCorrect: Boolean }`
- AI evaluates essays/speaking; instant feedback for multiple-choice
- Saves progress to `user_exam_progress`

**GET `/api/exam-study/users/:userId/exams/:examId/progress`**
- Returns: Detailed progress for user in an exam
- Includes: section scores, weak areas, overall trend

### Study Plans

**POST `/api/exam-study/users/:userId/exams/:examId/generate-study-plan`**
- Body: `{ targetScore: Number, examDate: Date }`
- AI analyzes user's current performance gaps
- Generates personalized plan with milestones
- Returns: `{ plan: StudyPlan, estimatedHours: Number }`

**GET `/api/exam-study/users/:userId/study-plans/:planId`**
- Returns: User's current study plan with progress

---

## AI Integration Points

### 1. Question Generation
- **When:** User exhausts pre-built questions or requests variety
- **How:** OpenAI generates new questions matching exam style + difficulty
- **Stored:** As `source: "ai-generated"` in `exam_questions`
- **Cost:** ~$0.02-0.05 per question (cached after first generation)

### 2. Answer Evaluation
- **Essay questions:** OpenAI evaluates against rubric (grammar, vocabulary, structure, coherence)
- **Speaking prompts:** User records audio → sent to OpenAI (or Whisper for transcription first)
- **Multiple-choice:** Instant feedback (no AI needed)
- **Cache:** Similar answers cached to reduce API costs

### 3. Study Plan Generation
- **Input:** User's weak areas + target score + exam date
- **Process:** AI creates weekly milestones, daily lessons tailored to gaps
- **Output:** Structured study plan stored in `user_study_plans`

### 4. Recommendations
- **Trigger:** After user completes 5+ questions in a section
- **AI generates:** Next focus areas, tips, similar weaknesses seen in other users (privacy-safe)

---

## Launch Strategy

### Phase 1 (MVP) — Weeks 1-4
- **Languages:** English, Spanish, Korean
- **Exams:** 1 exam per language (IELTS, DELE, TOPIK)
- **Sections:** Reading + Writing only
- **Content:** ~15-20 pre-built questions per section; AI fills gaps
- **Features:** Practice questions, instant AI feedback, progress tracking
- **Testing:** Unit tests for AI evaluation; integration tests for flow

### Phase 2 — Weeks 5-8
- All 8 languages, full exam coverage
- Speaking + Listening sections (audio integration)
- Advanced analytics & weak-area detection
- AI study plan generation
- Mock test mode (timed full exams)

### Phase 3 — Future
- Leaderboards / social competition
- Community-shared study materials
- Integration with language exchange partners (prep together)
- Exam result predictions based on practice performance

---

## Key Considerations & Trade-offs

### Exam Question Authenticity
- **Challenge:** Real exam questions have copyright/licensing restrictions
- **Solution:** Use adapted publicly available questions for MVP; consider partnerships (Cambridge, ETS) for Phase 2
- **Trade-off:** MVP questions may not feel 100% authentic, but AI-generated variety compensates

### AI Cost Management
- **Essay/speaking evaluation:** ~$0.02-0.05 per response with OpenAI
- **Mitigation:** Cache similar answers; batch evaluations during off-peak hours
- **Estimate:** ~$500-1000/month at moderate user scale (1000 active users)

### Data Privacy
- **User answers:** Stored in DB for progress tracking
- **AI Training:** Configure OpenAI API to not train on user data (disable training in API settings)

### Scalability
- **Questions:** Pre-seed ~30 per section; AI generates on-demand
- **Study plans:** Generated once per user (cached); regenerate only on request
- **Database:** Index on `examId`, `sectionId`, `userId` for fast queries

### Integration with Existing BananaTalk Features
- **User model:** Link `exam_questions` to user for personalization
- **Chat/conversation practice:** Can reference exam topics (e.g., "Practice IELTS speaking with an AI partner")
- **Notifications:** Remind users of study plan milestones or low scores

---

## Testing Strategy

### Unit Tests
- AI evaluation logic (rubric scoring, fairness across question types)
- Study plan generation algorithm
- Progress calculation accuracy

### Integration Tests
- Full user flow: language → exam → section → practice → feedback
- Progress persistence and retrieval
- API response formats

### Manual Testing
- User experience with 3+ real users (mobile + web)
- AI feedback quality for essays, speaking prompts
- Study plan recommendations accuracy

---

## Success Metrics

- **Adoption:** % of users who open Exam Study tab
- **Engagement:** Avg questions attempted per user per week
- **Retention:** % returning after first practice session
- **Satisfaction:** User ratings of AI feedback quality
- **AI cost efficiency:** Cost per question evaluated

---

## Future Enhancements (Out of Scope for MVP)

1. **Adaptive difficulty:** Questions adjust based on user performance
2. **Peer comparison:** Safe, aggregate benchmarking ("You're in top 20% for IELTS Writing")
3. **Integration with tutors:** Premium users matched with language tutors for personalized coaching
4. **Exam day simulation:** Full mock test under timed conditions with proctoring
5. **Multi-modal input:** Video speaking practice with AI evaluation

---

## Summary

Exam Study transforms BananaTalk into a comprehensive language proficiency exam prep platform. By combining pre-built authentic questions with AI-generated variety, real-time feedback, and personalized study plans, users can prepare for major exams (IELTS, TOEFL, TOPIK, DELE, etc.) in a structured, engaging way—all within the app they already use for language exchange. The phased launch (MVP with 3 languages + reading/writing) allows for rapid validation before full-scale rollout.
