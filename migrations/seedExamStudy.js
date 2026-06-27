/**
 * Migration: seed minimal exam-study content so the app's Chunk A+B
 * screens render real data. Idempotent — re-runs without duplicating.
 *
 * Seeds:
 *   3 languages  (English, Spanish, Korean)
 *   3 exams      (IELTS, DELE, TOPIK — one per language)
 *   6 sections   (Reading + Writing per exam)
 *  ~12 questions (small starter set so practice screens have something)
 *
 * Larger curated question banks land in Phase 4 of the backend plan
 * (Task 13 — Curate Pre-Built Questions). This is just enough to demo
 * the read endpoints end-to-end.
 *
 * Usage:
 *   node migrations/seedExamStudy.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');

const LANGUAGE_DATA = [
  { name: 'English', code: 'en', icon: '🇬🇧' },
  { name: 'Spanish', code: 'es', icon: '🇪🇸' },
  { name: 'Korean', code: 'ko', icon: '🇰🇷' },
];

// One exam per language for MVP. Keep the descriptions tight.
const EXAM_DATA = [
  {
    name: 'IELTS',
    languageCode: 'en',
    description: 'International English Language Testing System.',
    sections: ['reading', 'writing'],
    durationMinutes: 170,
    scoringType: 'band',
    maxScore: 9,
  },
  {
    name: 'DELE',
    languageCode: 'es',
    description: 'Diplomas de Español como Lengua Extranjera.',
    sections: ['reading', 'writing'],
    durationMinutes: 160,
    scoringType: 'score',
    maxScore: 100,
  },
  {
    name: 'TOPIK',
    languageCode: 'ko',
    description: 'Test of Proficiency in Korean.',
    sections: ['reading', 'writing'],
    durationMinutes: 180,
    scoringType: 'score',
    maxScore: 300,
  },
];

// Reading + Writing for every exam.
const SECTION_DATA = [
  { type: 'reading', name: 'Reading', durationMinutes: 60, questionCount: 20 },
  { type: 'writing', name: 'Writing', durationMinutes: 60, questionCount: 2 },
];

// Sample questions per (exam, section). Keep small + obviously synthetic
// so we don't accidentally ship licensed copy in the demo seed.
const QUESTION_DATA = {
  'IELTS:reading': [
    {
      questionText:
        'According to the passage, the author argues that renewable energy is most effective when:',
      questionType: 'multiple-choice',
      options: [
        'A) Used in isolation from existing infrastructure',
        'B) Combined with traditional energy sources',
        'C) Restricted to industrial use only',
        'D) Replaced every five years',
      ],
      correctAnswer: 'B',
      explanation:
        'The passage emphasizes integration with existing infrastructure as the key success factor.',
      difficulty: 'medium',
    },
    {
      questionText:
        'The word "abundant" in paragraph 2 is closest in meaning to:',
      questionType: 'multiple-choice',
      options: ['A) Scarce', 'B) Plentiful', 'C) Expensive', 'D) Polluting'],
      correctAnswer: 'B',
      explanation: '"Abundant" means existing in large quantities — i.e. plentiful.',
      difficulty: 'easy',
    },
  ],
  'IELTS:writing': [
    {
      questionText:
        'Some people believe that technology has made our lives easier, while others argue it has made them more complicated. Discuss both views and give your own opinion. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'A strong response addresses both sides with clear examples and ends with a reasoned personal opinion.',
      difficulty: 'medium',
    },
  ],
  'DELE:reading': [
    {
      questionText:
        'En el texto, el autor sugiere que el éxito profesional depende principalmente de:',
      questionType: 'multiple-choice',
      options: [
        'A) La suerte',
        'B) El esfuerzo y la constancia',
        'C) Los contactos sociales únicamente',
        'D) La educación formal exclusivamente',
      ],
      correctAnswer: 'B',
      explanation:
        'El texto enfatiza el esfuerzo continuo como factor clave del éxito.',
      difficulty: 'medium',
    },
  ],
  'DELE:writing': [
    {
      questionText:
        'Escriba una carta formal a una empresa solicitando información sobre un puesto de trabajo. Mínimo 150 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'La carta debe seguir el formato formal: saludo, presentación, motivo, despedida.',
      difficulty: 'medium',
    },
  ],
  'TOPIK:reading': [
    {
      questionText:
        '다음 글의 주제로 가장 알맞은 것은?\n\n"한국의 사계절은 각각 뚜렷한 특징을 가지고 있다. 봄에는 꽃이 피고, 여름에는 덥고 비가 많이 온다."',
      questionType: 'multiple-choice',
      options: [
        'A) 한국의 음식',
        'B) 한국의 사계절',
        'C) 한국의 역사',
        'D) 한국의 문화',
      ],
      correctAnswer: 'B',
      explanation: '글의 주제는 명확하게 사계절에 관한 내용입니다.',
      difficulty: 'easy',
    },
  ],
  'TOPIK:writing': [
    {
      questionText:
        '"환경 보호의 중요성"에 대해 600~700자 분량의 글을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '환경 보호의 필요성과 구체적인 실천 방안을 논리적으로 제시해야 합니다.',
      difficulty: 'medium',
    },
  ],
};

async function seed() {
  console.log('🔄 Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
    maxPoolSize: 10,
  });
  console.log('✅ Connected');

  // 1. Languages.
  const languageByCode = {};
  for (const data of LANGUAGE_DATA) {
    const existing = await ExamLanguage.findOne({ code: data.code });
    if (existing) {
      languageByCode[data.code] = existing;
      console.log(`= ${data.name} already exists`);
    } else {
      const created = await ExamLanguage.create(data);
      languageByCode[data.code] = created;
      console.log(`+ Created language ${data.name}`);
    }
  }

  // 2. Exams.
  const examByName = {};
  for (const data of EXAM_DATA) {
    const language = languageByCode[data.languageCode];
    const existing = await ExamType.findOne({
      name: data.name,
      languageId: language._id,
    });
    if (existing) {
      examByName[data.name] = existing;
      console.log(`= ${data.name} already exists`);
    } else {
      const { languageCode, ...rest } = data;
      const created = await ExamType.create({
        ...rest,
        languageId: language._id,
      });
      examByName[data.name] = created;
      console.log(`+ Created exam ${data.name}`);
    }
  }

  // 3. Sections.
  const sectionsByExam = {};
  for (const exam of Object.values(examByName)) {
    sectionsByExam[exam.name] = {};
    for (const sectionDef of SECTION_DATA) {
      const existing = await ExamSection.findOne({
        examId: exam._id,
        sectionType: sectionDef.type,
      });
      if (existing) {
        sectionsByExam[exam.name][sectionDef.type] = existing;
        console.log(`= ${exam.name}/${sectionDef.type} already exists`);
      } else {
        const created = await ExamSection.create({
          examId: exam._id,
          sectionName: sectionDef.name,
          sectionType: sectionDef.type,
          durationMinutes: sectionDef.durationMinutes,
          questionCount: sectionDef.questionCount,
        });
        sectionsByExam[exam.name][sectionDef.type] = created;
        console.log(`+ Created section ${exam.name}/${sectionDef.type}`);
      }
    }
  }

  // 4. Questions.
  let createdQuestions = 0;
  for (const [key, questions] of Object.entries(QUESTION_DATA)) {
    const [examName, sectionType] = key.split(':');
    const exam = examByName[examName];
    const section = sectionsByExam[examName]?.[sectionType];
    if (!exam || !section) {
      console.warn(`! Skipping ${key} — exam or section missing`);
      continue;
    }
    for (const q of questions) {
      const existing = await ExamQuestion.findOne({
        sectionId: section._id,
        questionText: q.questionText,
      });
      if (existing) continue;
      await ExamQuestion.create({
        examId: exam._id,
        sectionId: section._id,
        ...q,
        source: 'builtin',
      });
      createdQuestions++;
    }
  }
  console.log(`+ Created ${createdQuestions} questions`);

  console.log('✅ Seed complete');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
