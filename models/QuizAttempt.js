const mongoose = require('mongoose');

/**
 * QuizAttempt Model
 * Tracks user's quiz attempts and results
 */
const QuizAttemptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true
  },

  // Quiz type (denormalized)
  quizType: {
    type: String,
    enum: ['placement', 'level_test', 'unit_test', 'practice', 'daily'],
    required: true,
    index: true
  },

  // Answers
  answers: [{
    questionIndex: Number,
    questionId: mongoose.Schema.Types.ObjectId,
    answer: mongoose.Schema.Types.Mixed,
    isCorrect: Boolean,
    responseTime: Number, // ms
    points: Number
  }],

  // Score tracking
  totalQuestions: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  incorrectAnswers: {
    type: Number,
    default: 0
  },
  score: {
    type: Number, // 0-100
    default: 0
  },
  earnedPoints: {
    type: Number,
    default: 0
  },
  maxPoints: {
    type: Number,
    default: 0
  },

  // Time tracking
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  timeSpent: {
    type: Number, // seconds
    default: 0
  },
  timeLimit: {
    type: Number, // seconds (null = no limit)
    default: null
  },

  // Status
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'timed_out', 'abandoned'],
    default: 'in_progress',
    index: true
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  isPerfect: {
    type: Boolean,
    default: false
  },

  // For placement tests
  determinedLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null],
    default: null
  },

  // XP awarded
  xpAwarded: {
    type: Number,
    default: 0
  },

  // Attempt number
  attemptNumber: {
    type: Number,
    default: 1
  }

}, { timestamps: true });

// Indexes
QuizAttemptSchema.index({ user: 1, quiz: 1, status: 1 });
QuizAttemptSchema.index({ user: 1, quizType: 1, completedAt: -1 });
QuizAttemptSchema.index({ user: 1, completedAt: -1 });

/**
 * Start a quiz attempt
 */
QuizAttemptSchema.statics.startAttempt = async function(userId, quizId) {
  const Quiz = mongoose.model('Quiz');
  const quiz = await Quiz.findById(quizId);

  if (!quiz) {
    throw new Error('Quiz not found');
  }

  // Check for existing in-progress attempt
  let attempt = await this.findOne({
    user: userId,
    quiz: quizId,
    status: 'in_progress'
  });

  if (attempt) {
    return { attempt, quiz: this.prepareQuizForUser(quiz) };
  }

  // Count previous attempts
  const previousAttempts = await this.countDocuments({
    user: userId,
    quiz: quizId
  });

  // Check if retake is allowed
  if (!quiz.settings.allowRetake && previousAttempts > 0) {
    throw new Error('Retake not allowed for this quiz');
  }

  // Create new attempt
  attempt = await this.create({
    user: userId,
    quiz: quizId,
    quizType: quiz.type,
    totalQuestions: quiz.questions.length,
    maxPoints: quiz.questions.reduce((sum, q) => sum + (q.points || 10), 0),
    timeLimit: quiz.settings.timeLimit,
    attemptNumber: previousAttempts + 1
  });

  return { attempt, quiz: this.prepareQuizForUser(quiz) };
};

/**
 * Prepare quiz object for user (hide answers)
 */
QuizAttemptSchema.statics.prepareQuizForUser = function(quiz) {
  const quizObj = quiz.toObject ? quiz.toObject() : quiz;

  // Optionally shuffle questions
  let questions = [...quizObj.questions];
  if (quizObj.settings.shuffleQuestions) {
    questions = questions.sort(() => Math.random() - 0.5);
  }

  return {
    _id: quizObj._id,
    title: quizObj.title,
    description: quizObj.description,
    type: quizObj.type,
    level: quizObj.level,
    category: quizObj.category,
    settings: quizObj.settings,
    xpReward: quizObj.xpReward,
    perfectBonus: quizObj.perfectBonus,
    questions: questions.map((q, i) => {
      let options = q.options || [];

      // Shuffle options if enabled
      if (quizObj.settings.shuffleOptions && options.length > 0) {
        options = [...options].sort(() => Math.random() - 0.5);
      }

      return {
        _id: q._id,
        index: i,
        type: q.type,
        question: q.question,
        audioUrl: q.audioUrl,
        imageUrl: q.imageUrl,
        options: options.map(o => ({ text: o.text })),
        difficulty: q.difficulty,
        points: q.points
      };
    })
  };
};

/**
 * Submit an answer
 */
QuizAttemptSchema.methods.submitAnswer = async function(questionIndex, answer, responseTime = 0) {
  const Quiz = mongoose.model('Quiz');
  const quiz = await Quiz.findById(this.quiz);

  if (!quiz || questionIndex >= quiz.questions.length) {
    throw new Error('Invalid question');
  }

  const question = quiz.questions[questionIndex];

  // Check if already answered
  const existingAnswer = this.answers.find(a => a.questionIndex === questionIndex);
  if (existingAnswer) {
    throw new Error('Question already answered');
  }

  // Check correctness
  let isCorrect = false;

  switch (question.type) {
    case 'multiple_choice':
    case 'true_false':
      isCorrect = answer === question.correctAnswer;
      break;
    case 'fill_blank':
    case 'translation':
      const normalizedAnswer = answer.toString().toLowerCase().trim();
      const normalizedCorrect = question.correctAnswer.toString().toLowerCase().trim();
      isCorrect = normalizedAnswer === normalizedCorrect ||
                  question.acceptedAnswers?.some(a => a.toLowerCase().trim() === normalizedAnswer);
      break;
    default:
      isCorrect = answer === question.correctAnswer;
  }

  const points = isCorrect ? (question.points || 10) : 0;

  this.answers.push({
    questionIndex,
    questionId: question._id,
    answer,
    isCorrect,
    responseTime,
    points
  });

  if (isCorrect) {
    this.correctAnswers += 1;
    this.earnedPoints += points;
  } else {
    this.incorrectAnswers += 1;
  }

  this.score = Math.floor((this.earnedPoints / this.maxPoints) * 100);

  await this.save();

  const result = {
    isCorrect,
    points: isCorrect ? points : 0,
    currentScore: this.score,
    answeredQuestions: this.answers.length,
    totalQuestions: this.totalQuestions
  };

  // Include correct answer if setting allows
  if (quiz.settings.showCorrectAnswers) {
    result.correctAnswer = question.correctAnswer;
    result.explanation = question.explanation;
  }

  return result;
};

/**
 * Complete the quiz
 */
QuizAttemptSchema.methods.completeQuiz = async function() {
  const Quiz = mongoose.model('Quiz');
  const quiz = await Quiz.findById(this.quiz);

  if (!quiz) {
    throw new Error('Quiz not found');
  }

  // Calculate final score
  this.score = Math.floor((this.earnedPoints / this.maxPoints) * 100);
  this.isPerfect = this.score === 100;
  this.isPassed = this.score >= quiz.settings.passingScore;
  this.status = 'completed';
  this.completedAt = new Date();
  this.timeSpent = Math.floor((this.completedAt - this.startedAt) / 1000);

  // For placement tests, determine level
  if (quiz.type === 'placement') {
    this.determinedLevel = quiz.determineLevel(this.score);
  }

  // Calculate XP
  let xp = quiz.xpReward;
  if (this.isPerfect) {
    xp += quiz.perfectBonus;
  }
  this.xpAwarded = xp;

  await this.save();

  // Update quiz stats
  const allAttempts = await this.constructor.find({
    quiz: this.quiz,
    status: 'completed'
  });

  const avgScore = allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length;
  const passRate = (allAttempts.filter(a => a.isPassed).length / allAttempts.length) * 100;

  await Quiz.updateOne(
    { _id: this.quiz },
    {
      $inc: { 'stats.totalAttempts': 1 },
      $set: {
        'stats.averageScore': Math.round(avgScore * 100) / 100,
        'stats.passRate': Math.round(passRate * 100) / 100
      }
    }
  );

  return {
    score: this.score,
    isPassed: this.isPassed,
    isPerfect: this.isPerfect,
    determinedLevel: this.determinedLevel,
    xpAwarded: this.xpAwarded,
    timeSpent: this.timeSpent,
    correctAnswers: this.correctAnswers,
    incorrectAnswers: this.incorrectAnswers,
    answers: quiz.settings.showCorrectAnswers ? this.getDetailedResults(quiz) : null
  };
};

/**
 * Get detailed results with correct answers
 */
QuizAttemptSchema.methods.getDetailedResults = function(quiz) {
  return this.answers.map(answer => {
    const question = quiz.questions[answer.questionIndex];
    return {
      questionIndex: answer.questionIndex,
      question: question.question,
      yourAnswer: answer.answer,
      correctAnswer: question.correctAnswer,
      isCorrect: answer.isCorrect,
      explanation: question.explanation,
      points: answer.points
    };
  });
};

/**
 * Get user's quiz history
 */
QuizAttemptSchema.statics.getUserHistory = async function(userId, options = {}) {
  const { type, limit = 20, skip = 0 } = options;

  const filter = {
    user: new mongoose.Types.ObjectId(userId),
    status: 'completed'
  };

  if (type) filter.quizType = type;

  return this.aggregate([
    { $match: filter },
    { $sort: { completedAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'quizzes',
        localField: 'quiz',
        foreignField: '_id',
        as: 'quizDetails'
      }
    },
    { $unwind: '$quizDetails' },
    {
      $project: {
        _id: 1,
        score: 1,
        isPassed: 1,
        isPerfect: 1,
        determinedLevel: 1,
        xpAwarded: 1,
        timeSpent: 1,
        completedAt: 1,
        attemptNumber: 1,
        quiz: {
          _id: '$quizDetails._id',
          title: '$quizDetails.title',
          type: '$quizDetails.type',
          level: '$quizDetails.level',
          category: '$quizDetails.category',
          icon: '$quizDetails.icon'
        }
      }
    }
  ]);
};

/**
 * Check if user has completed placement test
 */
QuizAttemptSchema.statics.hasCompletedPlacement = async function(userId, language) {
  const Quiz = mongoose.model('Quiz');

  const placementQuiz = await Quiz.findOne({
    language,
    type: 'placement',
    isPublished: true
  });

  if (!placementQuiz) return false;

  const completedAttempt = await this.findOne({
    user: userId,
    quiz: placementQuiz._id,
    status: 'completed'
  });

  return !!completedAttempt;
};

/**
 * Get best attempt for a quiz
 */
QuizAttemptSchema.statics.getBestAttempt = async function(userId, quizId) {
  return this.findOne({
    user: userId,
    quiz: quizId,
    status: 'completed'
  })
    .sort({ score: -1 })
    .lean();
};

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);
