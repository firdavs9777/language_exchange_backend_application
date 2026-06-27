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

// Sample questions per (exam, section). Tagged with `topic` so the app's
// topic picker has something to group by. Keep small + obviously synthetic
// so we don't accidentally ship licensed copy in the demo seed.
const QUESTION_DATA = {
  'IELTS:reading': [
    // Climate
    {
      topic: 'Climate',
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
      topic: 'Climate',
      questionText:
        'The word "abundant" in paragraph 2 is closest in meaning to:',
      questionType: 'multiple-choice',
      options: ['A) Scarce', 'B) Plentiful', 'C) Expensive', 'D) Polluting'],
      correctAnswer: 'B',
      explanation: '"Abundant" means existing in large quantities — i.e. plentiful.',
      difficulty: 'easy',
    },
    // Technology
    {
      topic: 'Technology',
      questionText:
        'The passage suggests that artificial intelligence is most useful when it is:',
      questionType: 'multiple-choice',
      options: [
        'A) Replacing human judgement entirely',
        'B) Augmenting human decision-making',
        'C) Trained on a single source of data',
        'D) Kept hidden from end users',
      ],
      correctAnswer: 'B',
      explanation:
        'The author argues AI works best as an augmentation tool rather than a replacement.',
      difficulty: 'medium',
    },
    // Travel
    {
      topic: 'Travel',
      questionText:
        'What does the author identify as the primary benefit of slow travel?',
      questionType: 'multiple-choice',
      options: [
        'A) Lower cost',
        'B) Deeper cultural understanding',
        'C) More social media content',
        'D) Faster transportation',
      ],
      correctAnswer: 'B',
      explanation:
        'The passage frames slow travel as a path to deeper cultural connection.',
      difficulty: 'easy',
    },
    // Education
    {
      topic: 'Education',
      questionText:
        'Which of the following best summarises the author\'s view on standardised testing?',
      questionType: 'multiple-choice',
      options: [
        'A) Tests measure all the skills students need',
        'B) Tests are useful but should not be the sole measure of learning',
        'C) Tests should be abolished entirely',
        'D) Tests should be given more frequently',
      ],
      correctAnswer: 'B',
      explanation:
        'The author advocates a balanced view — useful, but not the only metric.',
      difficulty: 'medium',
    },
    // Health
    {
      topic: 'Health',
      questionText:
        'According to the passage, regular exercise primarily benefits cognitive function by:',
      questionType: 'multiple-choice',
      options: [
        'A) Increasing blood flow to the brain',
        'B) Reducing the need for sleep',
        'C) Replacing the need for proper nutrition',
        'D) Lowering body temperature',
      ],
      correctAnswer: 'A',
      explanation:
        'The author cites improved cerebral blood flow as the key mechanism.',
      difficulty: 'medium',
    },
  ],
  'IELTS:writing': [
    {
      topic: 'Technology',
      questionText:
        'Some people believe that technology has made our lives easier, while others argue it has made them more complicated. Discuss both views and give your own opinion. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'A strong response addresses both sides with clear examples and ends with a reasoned personal opinion.',
      difficulty: 'medium',
    },
    {
      topic: 'Climate',
      questionText:
        'Many governments are now investing heavily in renewable energy. Do you think this is the best way to tackle climate change, or are there more effective approaches? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Take a clear stance, support it with examples, and acknowledge alternative approaches.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'Some argue universities should focus on preparing students for the workforce, while others believe their role is to foster broad intellectual development. Discuss both views and give your opinion. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Balanced essays that explore both perspectives before concluding tend to score highest.',
      difficulty: 'medium',
    },
  ],
  'DELE:reading': [
    {
      topic: 'Work',
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
    {
      topic: 'Travel',
      questionText:
        'Según el pasaje, ¿qué recomienda el autor para viajar de manera sostenible?',
      questionType: 'multiple-choice',
      options: [
        'A) Volar siempre en primera clase',
        'B) Elegir transportes locales y alojamientos pequeños',
        'C) Visitar únicamente grandes ciudades',
        'D) Llevar mucho equipaje',
      ],
      correctAnswer: 'B',
      explanation:
        'El autor recomienda transportes locales y alojamientos comunitarios.',
      difficulty: 'easy',
    },
    {
      topic: 'Health',
      questionText:
        '¿Cuál es la idea principal del texto sobre la dieta mediterránea?',
      questionType: 'multiple-choice',
      options: [
        'A) Es difícil de seguir',
        'B) Combina sabor con beneficios cardiovasculares',
        'C) Está prohibida en muchos países',
        'D) Solo incluye pescado',
      ],
      correctAnswer: 'B',
      explanation:
        'El texto destaca el equilibrio entre placer y salud cardiovascular.',
      difficulty: 'medium',
    },
  ],
  'DELE:writing': [
    {
      topic: 'Work',
      questionText:
        'Escriba una carta formal a una empresa solicitando información sobre un puesto de trabajo. Mínimo 150 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'La carta debe seguir el formato formal: saludo, presentación, motivo, despedida.',
      difficulty: 'medium',
    },
    {
      topic: 'Climate',
      questionText:
        'Escriba un artículo de opinión sobre las medidas que cada persona puede tomar para reducir su impacto ambiental. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Use ejemplos concretos y conecte las acciones individuales con el efecto colectivo.',
      difficulty: 'medium',
    },
  ],
  'TOPIK:reading': [
    {
      topic: 'Culture',
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
    {
      topic: 'Technology',
      questionText:
        '"스마트폰은 우리의 일상생활을 편리하게 해주지만, 동시에 사람들 사이의 직접적인 대화를 줄이기도 합니다."\n\n이 글의 핵심 주장은 무엇입니까?',
      questionType: 'multiple-choice',
      options: [
        'A) 스마트폰은 사용해서는 안 된다',
        'B) 스마트폰은 장점과 단점을 모두 가진다',
        'C) 스마트폰은 미래에 사라질 것이다',
        'D) 스마트폰은 어린이에게만 유익하다',
      ],
      correctAnswer: 'B',
      explanation: '글은 편리함과 부작용 양면을 동시에 언급합니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        '"평생 학습은 변화하는 사회에서 필수가 되었다."\n\n이 문장이 의미하는 바와 가장 가까운 것은?',
      questionType: 'multiple-choice',
      options: [
        'A) 학교를 마치면 공부할 필요가 없다',
        'B) 사회 변화에 적응하려면 계속 배워야 한다',
        'C) 평생 학교에 다녀야 한다',
        'D) 학습은 어린 시절에만 가능하다',
      ],
      correctAnswer: 'B',
      explanation: '"평생 학습"은 사회 변화에 적응하기 위한 지속적 학습을 의미합니다.',
      difficulty: 'medium',
    },
  ],
  'TOPIK:writing': [
    {
      topic: 'Climate',
      questionText:
        '"환경 보호의 중요성"에 대해 600~700자 분량의 글을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '환경 보호의 필요성과 구체적인 실천 방안을 논리적으로 제시해야 합니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Culture',
      questionText:
        '여러분의 나라의 전통문화 중 가장 자랑스러운 것을 하나 골라 600~700자로 소개하십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '문화의 역사와 현재적 의미를 함께 설명하면 좋은 점수를 받기 쉽습니다.',
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
      if (existing) {
        // Backfill the topic field on already-seeded rows so the topic
        // picker has something to group by after a fresh seed run.
        if (!existing.topic && q.topic) {
          existing.topic = q.topic;
          await existing.save();
          console.log(`~ Backfilled topic for ${examName}/${sectionType} question`);
        }
        continue;
      }
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
