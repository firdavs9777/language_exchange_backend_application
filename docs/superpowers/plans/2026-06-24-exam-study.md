# Exam Study Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete exam preparation system that integrates into BananaTalk's AI section, supporting 3 languages (English, Spanish, Korean) with pre-built and AI-generated questions, real-time feedback, and personalized study plans.

**Architecture:** Hierarchical data model (Language → Exam → Section → Question) with separate services for AI evaluation, study plan generation, and progress tracking. Async essay evaluation via background jobs; instant feedback for multiple-choice. Hybrid content approach uses pre-built questions as "seed" with AI-generated variants.

**Tech Stack:** Express, MongoDB, Mongoose, OpenAI (gpt-4), Redis (for job queue), Node's built-in test framework.

---

## File Structure

### Models (6 new collections)
- `models/ExamLanguage.js` — Language definitions (English, Spanish, Korean)
- `models/ExamType.js` — Exam definitions (IELTS, DELE, TOPIK)
- `models/ExamSection.js` — Sections within exams (Reading, Writing)
- `models/ExamQuestion.js` — Practice questions with metadata
- `models/UserExamProgress.js` — User progress per exam (flat structure with nested section scores)
- `models/UserStudyPlan.js` — AI-generated study plans
- `models/AIEvaluationCache.js` — Cache for essay/speaking evaluations (optional, Phase 2)
- `models/EvaluationJob.js` — Async evaluation jobs for essays/speaking

### Services (4 new services)
- `services/examStudyService.js` — Core service: exam/section/question retrieval
- `services/examEvaluationService.js` — Answer evaluation (MC instant, essays async via OpenAI)
- `services/examStudyPlanService.js` — AI-driven study plan generation
- `services/examQuestionService.js` — Question generation, caching, and sourcing

### Routes (1 new route file)
- `routes/examStudy.js` — All exam study endpoints (9 routes)

### Tests (5 new test files)
- `test/examStudy.test.js` — Integration tests for full user flow
- `services/examEvaluationService.test.js` — Unit tests for evaluation logic
- `services/examStudyPlanService.test.js` — Study plan generation tests
- `services/examQuestionService.test.js` — Question sourcing tests
- `test/examStudyE2E.test.js` — End-to-end tests (language → exam → practice → feedback)

### Migrations (1 new migration)
- `migrations/createExamStudyCollections.js` — Create collections, indexes, seed initial data

---

## Critical Path & Parallelization

**Blocking Item:** Question sourcing. MVP needs ~180 pre-built questions (3 languages × 2 sections × 30 questions). This must be resolved by **Day 5** or Phase 1 slips by 2+ weeks.

**Parallel Tracks:**
- **Track A (Days 1-3):** Models + migrations (can start immediately)
- **Track B (Days 1-4):** API routes skeleton (depends only on models from Track A)
- **Track C (Days 2-5):** Services & evaluation logic (depends on models from Track A)
- **Track D (Days 1-5, BLOCKING):** Question sourcing & seeding (external dependency; gates Phase 1)
- **Track E (Days 6+):** Integration tests (depends on all of the above)

---

## Phase 1: Core Models & Infrastructure (Days 1-3)

### Task 1: ExamLanguage Model

**Files:**
- Create: `models/ExamLanguage.js`
- Modify: `server.js` (import model)

- [ ] **Step 1: Write the failing test**

```javascript
// test/examStudy.test.js
const ExamLanguage = require('../models/ExamLanguage');

test('ExamLanguage.create stores language with code and icon', async () => {
  const lang = await ExamLanguage.create({
    name: 'English',
    code: 'en',
    icon: '🇬🇧',
    active: true
  });
  
  assert.strictEqual(lang.name, 'English');
  assert.strictEqual(lang.code, 'en');
  assert(lang.active);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- test/examStudy.test.js 2>&1 | head -20
```

Expected: `ReferenceError: ExamLanguage is not defined`

- [ ] **Step 3: Create the model**

```javascript
// models/ExamLanguage.js
const mongoose = require('mongoose');

const ExamLanguageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 5
  },
  icon: String,
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ExamLanguageSchema.index({ code: 1 });
ExamLanguageSchema.index({ active: 1 });

module.exports = mongoose.model('ExamLanguage', ExamLanguageSchema);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- test/examStudy.test.js 2>&1 | grep -E "pass|fail"
```

Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add models/ExamLanguage.js test/examStudy.test.js
git commit -m "feat(exam-study): add ExamLanguage model"
```

---

### Task 2: ExamType Model

**Files:**
- Create: `models/ExamType.js`

- [ ] **Step 1: Write the failing test**

```javascript
// Add to test/examStudy.test.js
test('ExamType.create stores exam with languageId and sections', async () => {
  const lang = await ExamLanguage.create({
    name: 'English',
    code: 'en',
    icon: '🇬🇧',
    active: true
  });
  
  const ExamType = require('../models/ExamType');
  const exam = await ExamType.create({
    name: 'IELTS',
    languageId: lang._id,
    description: 'International English Language Testing System',
    sections: ['reading', 'writing'],
    durationMinutes: 170,
    scoringType: 'band',
    maxScore: 9,
    active: true
  });
  
  assert.strictEqual(exam.name, 'IELTS');
  assert.strictEqual(exam.sections.length, 2);
  assert.strictEqual(exam.maxScore, 9);
});
```

- [ ] **Step 2-4: Implement & test**

```javascript
// models/ExamType.js
const mongoose = require('mongoose');

const ExamTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  languageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamLanguage',
    required: true
  },
  description: String,
  sections: [{
    type: String,
    enum: ['reading', 'writing', 'speaking', 'listening', 'vocabulary']
  }],
  durationMinutes: Number,
  scoringType: {
    type: String,
    enum: ['band', 'score'],
    default: 'score'
  },
  maxScore: Number,
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ExamTypeSchema.index({ languageId: 1 });
ExamTypeSchema.index({ active: 1 });

module.exports = mongoose.model('ExamType', ExamTypeSchema);
```

- [ ] **Step 5: Commit**

```bash
git add models/ExamType.js
git commit -m "feat(exam-study): add ExamType model"
```

---

### Task 3: ExamSection Model

**Files:**
- Create: `models/ExamSection.js`

- [ ] **Step 1-4: Write, test, implement (following same pattern)**

```javascript
// models/ExamSection.js
const mongoose = require('mongoose');

const ExamSectionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true
  },
  sectionName: {
    type: String,
    required: true
  },
  sectionType: {
    type: String,
    enum: ['reading', 'writing', 'speaking', 'listening', 'vocabulary'],
    required: true
  },
  description: String,
  durationMinutes: Number,
  questionCount: {
    type: Number,
    default: 20
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ExamSectionSchema.index({ examId: 1, sectionType: 1 });

module.exports = mongoose.model('ExamSection', ExamSectionSchema);
```

- [ ] **Step 5: Commit**

```bash
git add models/ExamSection.js
git commit -m "feat(exam-study): add ExamSection model"
```

---

### Task 4: ExamQuestion Model

**Files:**
- Create: `models/ExamQuestion.js`

- [ ] **Step 1-4: Write, test, implement**

```javascript
// models/ExamQuestion.js
const mongoose = require('mongoose');

const ExamQuestionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamSection',
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'essay', 'speaking-prompt', 'fill-blank'],
    required: true
  },
  correctAnswer: mongoose.Schema.Types.Mixed,
  options: [String],
  audioUrl: String,
  imageUrl: String,
  explanation: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  source: {
    type: String,
    enum: ['builtin', 'ai-generated'],
    default: 'builtin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ExamQuestionSchema.index({ examId: 1, sectionId: 1 });
ExamQuestionSchema.index({ sectionId: 1, difficulty: 1 });
ExamQuestionSchema.index({ source: 1 });

module.exports = mongoose.model('ExamQuestion', ExamQuestionSchema);
```

- [ ] **Step 5: Commit**

```bash
git add models/ExamQuestion.js
git commit -m "feat(exam-study): add ExamQuestion model"
```

---

### Task 5: UserExamProgress Model

**Files:**
- Create: `models/UserExamProgress.js`

- [ ] **Step 1-4: Write, test, implement**

```javascript
// models/UserExamProgress.js
const mongoose = require('mongoose');

const UserExamProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true
  },
  questionsAttempted: {
    type: Number,
    default: 0
  },
  questionsCorrect: {
    type: Number,
    default: 0
  },
  sectionScores: {
    reading: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      score: { type: Number, default: null }
    },
    writing: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      score: { type: Number, default: null }
    },
    speaking: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      score: { type: Number, default: null }
    },
    listening: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      score: { type: Number, default: null }
    },
    vocabulary: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      score: { type: Number, default: null }
    }
  },
  overallScore: Number,
  lastAttemptedQuestionId: mongoose.Schema.Types.ObjectId,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

UserExamProgressSchema.index({ userId: 1, examId: 1 }, { unique: true });
UserExamProgressSchema.index({ userId: 1 });

module.exports = mongoose.model('UserExamProgress', UserExamProgressSchema);
```

- [ ] **Step 5: Commit**

```bash
git add models/UserExamProgress.js
git commit -m "feat(exam-study): add UserExamProgress model"
```

---

### Task 6: UserStudyPlan Model

**Files:**
- Create: `models/UserStudyPlan.js`

- [ ] **Step 1-4: Write, test, implement**

```javascript
// models/UserStudyPlan.js
const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  week: Number,
  focus: String,
  tasks: [String],
  estimatedHours: Number
}, { _id: false });

const DailyLessonSchema = new mongoose.Schema({
  date: Date,
  section: String,
  topic: String,
  estimatedMinutes: Number
}, { _id: false });

const UserStudyPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true
  },
  targetScore: Number,
  targetExamDate: Date,
  plan: {
    milestones: [MilestoneSchema],
    dailyLessons: [DailyLessonSchema]
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

UserStudyPlanSchema.index({ userId: 1, examId: 1 });

module.exports = mongoose.model('UserStudyPlan', UserStudyPlanSchema);
```

- [ ] **Step 5: Commit**

```bash
git add models/UserStudyPlan.js
git commit -m "feat(exam-study): add UserStudyPlan model"
```

---

### Task 7: EvaluationJob Model (for async essay evaluation)

**Files:**
- Create: `models/EvaluationJob.js`

- [ ] **Step 1-4: Write, test, implement**

```javascript
// models/EvaluationJob.js
const mongoose = require('mongoose');

const EvaluationJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamQuestion',
    required: true
  },
  userAnswer: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  score: Number,
  feedback: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  ttl: 604800
}, { 
  timestamps: true,
  expireAfterSeconds: 604800
});

EvaluationJobSchema.index({ userId: 1, questionId: 1 });
EvaluationJobSchema.index({ status: 1 });
EvaluationJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('EvaluationJob', EvaluationJobSchema);
```

- [ ] **Step 5: Commit**

```bash
git add models/EvaluationJob.js
git commit -m "feat(exam-study): add EvaluationJob model for async evaluation"
```

---

## Phase 2: API Routes (Days 2-4)

### Task 8: Create examStudy Route with Language & Exam Endpoints

**Files:**
- Create: `routes/examStudy.js`
- Modify: `server.js` (add route mount)

- [ ] **Step 1: Write failing test**

```javascript
// test/examStudy.test.js - add to existing test file
test('GET /api/exam-study/languages returns all active languages', async () => {
  const response = await request(app)
    .get('/api/exam-study/languages');
  
  assert.strictEqual(response.statusCode, 200);
  assert(Array.isArray(response.body));
});

test('GET /api/exam-study/languages/:languageId/exams returns exams for language', async () => {
  const lang = await ExamLanguage.create({
    name: 'English',
    code: 'en',
    icon: '🇬🇧'
  });
  
  const response = await request(app)
    .get(`/api/exam-study/languages/${lang._id}/exams`);
  
  assert.strictEqual(response.statusCode, 200);
  assert(Array.isArray(response.body));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/examStudy.test.js 2>&1 | grep -E "pass|fail"
```

Expected: `2 failed`

- [ ] **Step 3: Create the route**

```javascript
// routes/examStudy.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/exam-study/languages
router.get('/languages', asyncHandler(async (req, res) => {
  const languages = await ExamLanguage.find({ active: true });
  res.json(languages);
}));

// GET /api/exam-study/languages/:languageId/exams
router.get('/languages/:languageId/exams', asyncHandler(async (req, res) => {
  const { languageId } = req.params;
  const exams = await ExamType.find({
    languageId,
    active: true
  });
  res.json(exams);
}));

// GET /api/exam-study/exams/:examId/sections
router.get('/exams/:examId/sections', asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const sections = await ExamSection.find({ examId });
  res.json(sections);
}));

// GET /api/exam-study/sections/:sectionId/questions
router.get('/sections/:sectionId/questions', asyncHandler(async (req, res) => {
  const { sectionId } = req.params;
  const { limit = 10, skip = 0, difficulty, source } = req.query;
  
  const query = { sectionId };
  if (difficulty) query.difficulty = difficulty;
  if (source) query.source = source;
  
  const questions = await ExamQuestion.find(query)
    .limit(parseInt(limit))
    .skip(parseInt(skip));
  
  res.json(questions);
}));

module.exports = router;
```

- [ ] **Step 4: Mount route in server.js**

```javascript
// In server.js, add before error handler:
app.use('/api/exam-study', require('./routes/examStudy'));
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- test/examStudy.test.js 2>&1 | grep -E "pass|fail"
```

Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add routes/examStudy.js server.js
git commit -m "feat(exam-study): add content retrieval endpoints (languages, exams, sections, questions)"
```

---

### Task 9: Add Answer Submission Endpoint

**Files:**
- Modify: `routes/examStudy.js`

- [ ] **Step 1: Write failing test for multiple-choice (instant feedback)**

```javascript
// test/examStudy.test.js
test('POST /api/exam-study/questions/:questionId/submit-answer returns instant feedback for MC', async () => {
  const lang = await ExamLanguage.create({ name: 'English', code: 'en' });
  const exam = await ExamType.create({
    name: 'IELTS',
    languageId: lang._id,
    sections: ['reading']
  });
  const section = await ExamSection.create({
    examId: exam._id,
    sectionType: 'reading',
    sectionName: 'Reading'
  });
  const question = await ExamQuestion.create({
    examId: exam._id,
    sectionId: section._id,
    questionText: 'What is 2+2?',
    questionType: 'multiple-choice',
    correctAnswer: 'A',
    options: ['A', 'B', 'C'],
    explanation: 'Simple math'
  });
  
  const response = await request(app)
    .post(`/api/exam-study/questions/${question._id}/submit-answer`)
    .send({ userAnswer: 'A', timeSpent: 30 });
  
  assert.strictEqual(response.statusCode, 200);
  assert(response.body.isCorrect === true);
  assert(response.body.score !== undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- test/examStudy.test.js 2>&1 | grep "submit-answer"
```

Expected: Failure

- [ ] **Step 3: Add the endpoint to routes/examStudy.js**

```javascript
// POST /api/exam-study/questions/:questionId/submit-answer
router.post('/questions/:questionId/submit-answer', protect, asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const { userAnswer, timeSpent } = req.body;
  const userId = req.user._id;
  
  // Validate input
  if (!userAnswer) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ANSWER',
      message: 'userAnswer is required'
    });
  }
  
  const question = await ExamQuestion.findById(questionId);
  if (!question) {
    return res.status(404).json({
      success: false,
      code: 'QUESTION_NOT_FOUND',
      message: 'Question not found'
    });
  }
  
  // Instant feedback for multiple-choice
  if (question.questionType === 'multiple-choice') {
    const isCorrect = userAnswer === question.correctAnswer;
    const score = isCorrect ? 100 : 0;
    
    // Update progress
    const examId = question.examId;
    let progress = await UserExamProgress.findOne({ userId, examId });
    if (!progress) {
      progress = await UserExamProgress.create({ userId, examId });
    }
    
    progress.questionsAttempted += 1;
    if (isCorrect) progress.questionsCorrect += 1;
    progress.lastAttemptedQuestionId = questionId;
    progress.lastUpdated = new Date();
    await progress.save();
    
    return res.json({
      score,
      isCorrect,
      explanation: question.explanation,
      feedback: isCorrect ? 'Correct!' : 'Incorrect. ' + question.explanation
    });
  }
  
  // Async evaluation for essays/speaking (return 202 with polling URL)
  if (['essay', 'speaking-prompt'].includes(question.questionType)) {
    const EvaluationJob = require('../models/EvaluationJob');
    const job = await EvaluationJob.create({
      userId,
      questionId,
      userAnswer,
      status: 'pending'
    });
    
    return res.status(202).json({
      statusCode: 202,
      pollUrl: `/api/exam-study/evaluations/${job._id}`
    });
  }
  
  res.status(400).json({
    success: false,
    code: 'INVALID_QUESTION_TYPE',
    message: 'Unknown question type'
  });
}));

// GET /api/exam-study/evaluations/:evaluationId
router.get('/evaluations/:evaluationId', protect, asyncHandler(async (req, res) => {
  const { evaluationId } = req.params;
  const EvaluationJob = require('../models/EvaluationJob');
  
  const job = await EvaluationJob.findById(evaluationId);
  if (!job) {
    return res.status(404).json({
      success: false,
      code: 'EVALUATION_NOT_FOUND',
      message: 'Evaluation not found'
    });
  }
  
  res.json({
    status: job.status,
    score: job.score,
    feedback: job.feedback,
    completedAt: job.completedAt
  });
}));

// GET /api/exam-study/users/:userId/exams/:examId/progress
router.get('/users/:userId/exams/:examId/progress', protect, asyncHandler(async (req, res) => {
  const { userId, examId } = req.params;
  
  const progress = await UserExamProgress.findOne({ userId, examId });
  if (!progress) {
    return res.status(404).json({
      success: false,
      code: 'PROGRESS_NOT_FOUND',
      message: 'No progress found for this exam'
    });
  }
  
  res.json(progress);
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- test/examStudy.test.js 2>&1 | grep "submit-answer"
```

Expected: Pass

- [ ] **Step 5: Commit**

```bash
git add routes/examStudy.js
git commit -m "feat(exam-study): add answer submission and evaluation endpoints"
```

---

### Task 10: Add Study Plan Generation Endpoint

**Files:**
- Modify: `routes/examStudy.js`

- [ ] **Step 1: Write failing test**

```javascript
// test/examStudy.test.js
test('POST /api/exam-study/users/:userId/exams/:examId/generate-study-plan creates plan', async () => {
  const response = await request(app)
    .post(`/api/exam-study/users/${userId}/exams/${examId}/generate-study-plan`)
    .send({
      targetScore: 7.5,
      examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
    });
  
  assert.strictEqual(response.statusCode, 200);
  assert(response.body.plan !== undefined);
  assert(Array.isArray(response.body.plan.milestones));
});
```

- [ ] **Step 2-4: Implement endpoint**

```javascript
// Add to routes/examStudy.js
router.post('/users/:userId/exams/:examId/generate-study-plan', protect, asyncHandler(async (req, res) => {
  const { userId, examId } = req.params;
  const { targetScore, examDate } = req.body;
  
  if (!targetScore || !examDate) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_INPUT',
      message: 'targetScore and examDate are required'
    });
  }
  
  // Check if plan already exists
  let plan = await UserStudyPlan.findOne({ userId, examId });
  
  // Generate simple placeholder plan (services will be implemented in Phase 3)
  const weeksUntilExam = Math.ceil((new Date(examDate) - Date.now()) / (7 * 24 * 60 * 60 * 1000));
  const milestones = [];
  
  for (let week = 1; week <= weeksUntilExam; week++) {
    milestones.push({
      week,
      focus: `Week ${week}: Build vocabulary and reading speed`,
      tasks: ['Complete 5 reading practice questions', 'Write 2 essays'],
      estimatedHours: 8
    });
  }
  
  if (!plan) {
    plan = await UserStudyPlan.create({
      userId,
      examId,
      targetScore,
      targetExamDate: examDate,
      plan: { milestones, dailyLessons: [] }
    });
  } else {
    plan.plan.milestones = milestones;
    plan.targetScore = targetScore;
    plan.targetExamDate = examDate;
    await plan.save();
  }
  
  res.json({
    success: true,
    plan: plan.plan,
    estimatedHours: milestones.reduce((sum, m) => sum + m.estimatedHours, 0)
  });
}));

// GET /api/exam-study/users/:userId/study-plans/:planId
router.get('/users/:userId/study-plans/:planId', protect, asyncHandler(async (req, res) => {
  const { planId } = req.params;
  
  const plan = await UserStudyPlan.findById(planId);
  if (!plan) {
    return res.status(404).json({
      success: false,
      code: 'PLAN_NOT_FOUND',
      message: 'Study plan not found'
    });
  }
  
  res.json(plan);
}));
```

- [ ] **Step 5: Commit**

```bash
git add routes/examStudy.js
git commit -m "feat(exam-study): add study plan generation endpoint"
```

---

## Phase 3: Core Services (Days 3-5)

### Task 11: Create examEvaluationService for Essay Scoring

**Files:**
- Create: `services/examEvaluationService.js`

- [ ] **Step 1: Write failing test**

```javascript
// services/examEvaluationService.test.js
const examEvaluationService = require('../services/examEvaluationService');

test('evaluateEssay returns score and feedback via OpenAI', async () => {
  const result = await examEvaluationService.evaluateEssay({
    essay: 'This is a test essay about climate change.',
    rubric: 'grammar, vocabulary, coherence',
    targetBand: 6
  });
  
  assert(result.score >= 0 && result.score <= 100);
  assert(typeof result.feedback === 'string');
  assert(result.feedback.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- services/examEvaluationService.test.js 2>&1 | head -10
```

Expected: Service not found

- [ ] **Step 3: Create the service**

```javascript
// services/examEvaluationService.js
const aiProviderService = require('./aiProviderService');
const AIUsageLog = require('../models/AIUsageLog');

/**
 * Evaluate an essay answer against a rubric
 * @param {Object} options
 * @param {String} options.essay - User's essay
 * @param {String} options.rubric - Evaluation criteria (e.g., "grammar, vocabulary, structure, coherence")
 * @param {Number} options.targetBand - Target band/score level
 * @returns {Promise<Object>} { score: Number, feedback: String }
 */
const evaluateEssay = async (options) => {
  const { essay, rubric = 'grammar, vocabulary, coherence', targetBand = 6 } = options;
  
  if (!essay || essay.trim().length < 50) {
    throw new Error('Essay must be at least 50 characters');
  }
  
  const prompt = `You are an IELTS examiner. Evaluate the following essay against these criteria: ${rubric}.

Essay:
${essay}

Target Band: ${targetBand}

Provide:
1. A score out of 100
2. Detailed feedback on strengths and weaknesses
3. Specific suggestions for improvement

Format your response as JSON:
{
  "score": <0-100>,
  "feedback": "<detailed feedback>",
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<improvement1>", "<improvement2>"]
}`;
  
  try {
    const response = await aiProviderService.chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      feature: 'exam-essay-evaluation',
      temperature: 0.5,
      json: true
    });
    
    const parsed = JSON.parse(response.content);
    
    // Log usage
    try {
      await AIUsageLog.create({
        feature: 'exam-essay-evaluation',
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cost: (response.usage.inputTokens * 0.00003 + response.usage.outputTokens * 0.00006) / 1000
      });
    } catch (logError) {
      console.warn('Failed to log AI usage:', logError);
    }
    
    return {
      score: Math.min(100, Math.max(0, parsed.score)),
      feedback: parsed.feedback,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || []
    };
  } catch (error) {
    console.error('Essay evaluation error:', error);
    throw new Error('Failed to evaluate essay: ' + error.message);
  }
};

/**
 * Validate answer format based on question type
 * @param {String} questionType
 * @param {String} answer
 * @returns {Object} { valid: Boolean, error: String }
 */
const validateAnswer = (questionType, answer) => {
  if (!answer) return { valid: false, error: 'Answer is required' };
  
  switch (questionType) {
    case 'essay':
      if (answer.length < 50) return { valid: false, error: 'Essay must be at least 50 characters' };
      if (answer.length > 5000) return { valid: false, error: 'Essay must not exceed 5000 characters' };
      return { valid: true };
      
    case 'multiple-choice':
      return { valid: true };
      
    case 'fill-blank':
      if (answer.trim().length === 0) return { valid: false, error: 'Answer cannot be empty' };
      return { valid: true };
      
    default:
      return { valid: false, error: 'Unknown question type' };
  }
};

module.exports = {
  evaluateEssay,
  validateAnswer
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- services/examEvaluationService.test.js 2>&1 | grep -E "pass|fail"
```

Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add services/examEvaluationService.js services/examEvaluationService.test.js
git commit -m "feat(exam-study): add essay evaluation service with OpenAI"
```

---

### Task 12: Create examStudyPlanService

**Files:**
- Create: `services/examStudyPlanService.js`

- [ ] **Step 1-4: Write test, implement service**

```javascript
// services/examStudyPlanService.js
const aiProviderService = require('./aiProviderService');
const UserExamProgress = require('../models/UserExamProgress');

/**
 * Generate a personalized study plan based on user's weak areas
 * @param {Object} options
 * @param {ObjectId} options.userId
 * @param {ObjectId} options.examId
 * @param {Number} options.targetScore
 * @param {Date} options.targetExamDate
 * @param {Object} options.currentProgress - User's current progress
 * @returns {Promise<Object>} { milestones: [], dailyLessons: [] }
 */
const generateStudyPlan = async (options) => {
  const { userId, examId, targetScore, targetExamDate, currentProgress } = options;
  
  const weeksUntilExam = Math.ceil((new Date(targetExamDate) - Date.now()) / (7 * 24 * 60 * 60 * 1000));
  
  if (weeksUntilExam <= 0) {
    throw new Error('Exam date must be in the future');
  }
  
  // Identify weak areas
  const weakAreas = [];
  if (currentProgress && currentProgress.sectionScores) {
    Object.entries(currentProgress.sectionScores).forEach(([section, scores]) => {
      if (scores.score && scores.score < 70) {
        weakAreas.push(section);
      }
    });
  }
  
  // Generate milestones via AI
  const prompt = `Create a ${weeksUntilExam}-week IELTS study plan for someone targeting a band ${targetScore}.
  
Weak areas to focus on: ${weakAreas.length > 0 ? weakAreas.join(', ') : 'all sections'}.

Provide weekly milestones with:
- Week number
- Focus area (e.g., "Improve reading speed")
- Specific tasks (3-4 tasks per week)
- Estimated hours (8-10 hours per week)

Format as JSON array of milestones.`;
  
  try {
    const response = await aiProviderService.chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      feature: 'exam-study-plan',
      temperature: 0.7,
      json: true
    });
    
    const milestones = JSON.parse(response.content);
    
    // Generate daily lessons
    const dailyLessons = [];
    let currentDate = new Date();
    for (let i = 0; i < weeksUntilExam * 5; i++) {
      if (currentDate <= targetExamDate) {
        const section = weakAreas.length > 0 ? weakAreas[i % weakAreas.length] : 'reading';
        dailyLessons.push({
          date: new Date(currentDate),
          section: section,
          topic: `Practice ${section}`,
          estimatedMinutes: 45
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return {
      milestones: Array.isArray(milestones) ? milestones : [{ week: 1, focus: 'Start your preparation', tasks: [], estimatedHours: 8 }],
      dailyLessons
    };
  } catch (error) {
    console.error('Study plan generation error:', error);
    // Fallback: return basic plan
    const milestones = [];
    for (let week = 1; week <= weeksUntilExam; week++) {
      milestones.push({
        week,
        focus: `Week ${week}: Build skills and confidence`,
        tasks: ['Complete reading practice', 'Write essays', 'Review mistakes'],
        estimatedHours: 8
      });
    }
    return { milestones, dailyLessons: [] };
  }
};

module.exports = {
  generateStudyPlan
};
```

- [ ] **Step 5: Commit**

```bash
git add services/examStudyPlanService.js
git commit -m "feat(exam-study): add study plan generation service"
```

---

## Phase 4: Question Sourcing & Seeding (Days 1-5, CRITICAL PATH)

### Task 13: Curate Pre-Built Questions (BLOCKING)

**Files:**
- Create: `data/exam-questions-seed.json`

**Instructions:** This is the blocking item. **Must be completed by Day 5.**

- [ ] **Step 1: Source 180+ questions from public/licensed sources**

Required: 
- 3 languages (English, Spanish, Korean) 
- 2 sections (Reading, Writing)
- ~30 questions per section
- Total: 3 × 2 × 30 = 180 questions

**Public sources to use:**
1. Cambridge English official practice books (PDFs available online)
2. IELTS official sample materials
3. DELE official sample materials
4. TOPIK official practice tests
5. ETS TOEFL sample questions

- [ ] **Step 2: Format questions as JSON**

```json
{
  "questions": [
    {
      "language": "English",
      "exam": "IELTS",
      "section": "reading",
      "questionText": "What is the main idea of the passage?",
      "questionType": "multiple-choice",
      "options": ["A) ...", "B) ...", "C) ..."],
      "correctAnswer": "A",
      "explanation": "...",
      "difficulty": "medium",
      "source": "builtin"
    },
    {
      "language": "English",
      "exam": "IELTS",
      "section": "writing",
      "questionText": "Write an essay on climate change. (250 words minimum)",
      "questionType": "essay",
      "correctAnswer": null,
      "explanation": "Essay responses should address the prompt and demonstrate good grammar and vocabulary.",
      "difficulty": "medium",
      "source": "builtin"
    }
  ]
}
```

- [ ] **Step 3: Save to `data/exam-questions-seed.json`**

```bash
mkdir -p /Users/davis/Desktop/Personal/language_exchange_backend_application/data
# Create the seed file with all 180 questions
```

- [ ] **Step 4: Verify question count**

```bash
jq '.questions | length' data/exam-questions-seed.json
```

Expected: >= 180

- [ ] **Step 5: Commit**

```bash
git add data/exam-questions-seed.json
git commit -m "feat(exam-study): seed pre-built questions (English, Spanish, Korean)"
```

---

### Task 14: Create Migration to Seed Database

**Files:**
- Create: `migrations/createExamStudyCollections.js`

- [ ] **Step 1-4: Write and test migration**

```javascript
// migrations/createExamStudyCollections.js
const mongoose = require('mongoose');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');
const seedData = require('../data/exam-questions-seed.json');

const seedExamData = async () => {
  try {
    console.log('Seeding exam study data...');
    
    // Create languages
    const languages = {};
    const languageData = [
      { name: 'English', code: 'en', icon: '🇬🇧' },
      { name: 'Spanish', code: 'es', icon: '🇪🇸' },
      { name: 'Korean', code: 'ko', icon: '🇰🇷' }
    ];
    
    for (const langData of languageData) {
      const existing = await ExamLanguage.findOne({ code: langData.code });
      if (!existing) {
        const lang = await ExamLanguage.create(langData);
        languages[langData.code] = lang._id;
        console.log(`✓ Created language: ${langData.name}`);
      } else {
        languages[langData.code] = existing._id;
      }
    }
    
    // Create exams
    const exams = {};
    const examData = [
      { name: 'IELTS', languageId: languages['en'], sections: ['reading', 'writing'], maxScore: 9, scoringType: 'band' },
      { name: 'DELE', languageId: languages['es'], sections: ['reading', 'writing'], maxScore: 100, scoringType: 'score' },
      { name: 'TOPIK', languageId: languages['ko'], sections: ['reading', 'writing'], maxScore: 300, scoringType: 'score' }
    ];
    
    for (const examData of examData) {
      const existing = await ExamType.findOne({ name: examData.name, languageId: examData.languageId });
      if (!existing) {
        const exam = await ExamType.create(examData);
        exams[examData.name] = exam._id;
        console.log(`✓ Created exam: ${examData.name}`);
      } else {
        exams[examData.name] = existing._id;
      }
    }
    
    // Create sections
    const sections = {};
    for (const examName of ['IELTS', 'DELE', 'TOPIK']) {
      for (const sectionType of ['reading', 'writing']) {
        const key = `${examName}_${sectionType}`;
        const existing = await ExamSection.findOne({ examId: exams[examName], sectionType });
        if (!existing) {
          const section = await ExamSection.create({
            examId: exams[examName],
            sectionType,
            sectionName: sectionType.charAt(0).toUpperCase() + sectionType.slice(1)
          });
          sections[key] = section._id;
          console.log(`✓ Created section: ${examName} - ${sectionType}`);
        } else {
          sections[key] = existing._id;
        }
      }
    }
    
    // Seed questions
    let questionCount = 0;
    for (const q of seedData.questions) {
      const examId = exams[q.exam];
      const sectionKey = `${q.exam}_${q.section}`;
      const sectionId = sections[sectionKey];
      
      if (examId && sectionId) {
        const existing = await ExamQuestion.findOne({
          examId,
          sectionId,
          questionText: q.questionText
        });
        
        if (!existing) {
          await ExamQuestion.create({
            examId,
            sectionId,
            questionText: q.questionText,
            questionType: q.questionType,
            correctAnswer: q.correctAnswer,
            options: q.options,
            explanation: q.explanation,
            difficulty: q.difficulty,
            source: q.source
          });
          questionCount++;
        }
      }
    }
    
    console.log(`✓ Seeded ${questionCount} questions`);
    console.log('Exam study data seeding complete!');
  } catch (error) {
    console.error('Seeding error:', error);
    throw error;
  }
};

module.exports = { seedExamData };
```

- [ ] **Step 5: Commit**

```bash
git add migrations/createExamStudyCollections.js
git commit -m "feat(exam-study): add migration script to seed languages, exams, sections, and questions"
```

---

## Phase 5: Integration Tests & Final Polish (Days 6-10)

### Task 15: Write Full Integration Test Suite

**Files:**
- Create: `test/examStudyE2E.test.js`

- [ ] **Step 1-4: Write comprehensive integration tests**

```javascript
// test/examStudyE2E.test.js
const request = require('supertest');
const app = require('../server');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const User = require('../models/User');

describe('Exam Study Full Flow', () => {
  let user, token, languageId, examId, sectionId, questionId;
  
  before(async () => {
    // Setup: create test user and data
    user = await User.create({
      email: 'test@exam.com',
      password: 'testpass',
      name: 'Test User'
    });
    token = user.generateAuthToken();
    
    const lang = await ExamLanguage.create({
      name: 'English',
      code: 'en',
      icon: '🇬🇧'
    });
    languageId = lang._id;
  });
  
  test('Full user flow: Language → Exam → Section → Practice → Progress', async () => {
    // Step 1: Get languages
    let res = await request(app)
      .get('/api/exam-study/languages');
    assert.strictEqual(res.statusCode, 200);
    
    // Step 2: Get exams for language
    res = await request(app)
      .get(`/api/exam-study/languages/${languageId}/exams`);
    assert.strictEqual(res.statusCode, 200);
    
    // Step 3: Get sections
    res = await request(app)
      .get(`/api/exam-study/exams/${examId}/sections`);
    assert.strictEqual(res.statusCode, 200);
    
    // Step 4: Get questions for section
    res = await request(app)
      .get(`/api/exam-study/sections/${sectionId}/questions?limit=5`);
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.length > 0);
    
    // Step 5: Submit answer to MC question
    res = await request(app)
      .post(`/api/exam-study/questions/${questionId}/submit-answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userAnswer: 'A', timeSpent: 30 });
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.isCorrect !== undefined);
    
    // Step 6: Check progress
    res = await request(app)
      .get(`/api/exam-study/users/${user._id}/exams/${examId}/progress`)
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.questionsAttempted > 0);
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add test/examStudyE2E.test.js
git commit -m "test: add end-to-end integration tests for exam study flow"
```

---

### Task 16: Add Rate Limiting & Error Handling

**Files:**
- Modify: `routes/examStudy.js`

- [ ] **Step 1-4: Add rate limiting middleware**

```javascript
// At top of routes/examStudy.js
const rateLimit = require('express-rate-limit');

const submitAnswerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many submissions, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply limiter to submit-answer route
router.post('/questions/:questionId/submit-answer', submitAnswerLimiter, protect, asyncHandler(async (req, res) => {
  // ... existing code
}));
```

- [ ] **Step 5: Commit**

```bash
git add routes/examStudy.js
git commit -m "feat(exam-study): add rate limiting to prevent API abuse"
```

---

### Task 17: Final Code Review & Documentation

**Files:**
- Create: `docs/exam-study-api.md`

- [ ] **Step 1-4: Write API documentation**

```markdown
# Exam Study API Documentation

## Endpoints

### GET /api/exam-study/languages
Returns all active languages.

**Response:**
```json
[
  { "_id": "...", "name": "English", "code": "en", "icon": "🇬🇧" }
]
```

### GET /api/exam-study/languages/:languageId/exams
Returns exams for a language.

**Response:**
```json
[
  { "_id": "...", "name": "IELTS", "maxScore": 9, "sections": ["reading", "writing"] }
]
```

...
```

- [ ] **Step 5: Commit**

```bash
git add docs/exam-study-api.md
git commit -m "docs: add API documentation for exam study"
```

---

## Testing Checklist

Before Phase 1 is considered complete:

- [ ] All unit tests pass: `npm test`
- [ ] Integration tests pass: `npm test -- test/examStudyE2E.test.js`
- [ ] 180+ questions seeded in database
- [ ] No ESLint errors: `npm run lint` (if available)
- [ ] API tested manually with Postman/curl for:
  - Language retrieval
  - Exam selection
  - Question submission (MC & essay)
  - Progress tracking
  - Study plan generation

---

## Known Limitations (Phase 1 MVP)

- ✗ Speaking and Listening sections (requires audio handling)
- ✗ Advanced analytics (weak area detection)
- ✗ Mock test mode (timed full exams)
- ✗ Leaderboards
- ✗ Adaptive difficulty
- ✗ Audio transcription via Whisper (Phase 2)

---

## Deployment Checklist

Before going live:

- [ ] Environment variables set (OPENAI_API_KEY, MongoDB connection string)
- [ ] Database indexes created
- [ ] Error monitoring configured (Sentry/similar)
- [ ] Rate limits adjusted based on user load
- [ ] AI usage logged and monitored
- [ ] Backup/restore procedures documented
- [ ] Load testing completed (1000+ concurrent users)

---

## Success Criteria

Phase 1 is complete when:

1. ✅ All 9 API endpoints working (content retrieval, answer submission, progress, study plans)
2. ✅ 3 languages, 3 exams, 6 sections, 180+ questions in database
3. ✅ Instant feedback for MC questions
4. ✅ Async essay evaluation (202 response with polling endpoint)
5. ✅ Study plan generation working
6. ✅ Progress tracking accurate
7. ✅ All unit & integration tests passing
8. ✅ API documentation complete
9. ✅ Zero critical bugs in manual testing
