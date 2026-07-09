/**
 * Migration: seed CAPLE (Cambridge English Certificate – Portuguese) exam content
 * with A1–C2 proficiency levels, full section coverage, and ~3,420 questions.
 *
 * Seeds:
 *   1 language  (Portuguese)
 *   6 exams     (CAPLE/A1, CAPLE/A2, CAPLE/B1, CAPLE/B2, CAPLE/C1, CAPLE/C2)
 *   36 sections (6 sections × 6 levels)
 *   ~3,420 questions (~150 questions per section × 6 sections × 6 levels)
 *
 * Idempotent — re-runs without duplicating.
 *
 * Usage:
 *   node migrations/seedCAPLE.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');
const { generateReadingQuestions, generateWritingQuestions, generateSpeakingQuestions } = require('../utils/examQuestionGenerator');
const seedExamConfig = require('../utils/seedExamConfig');

const config = seedExamConfig.CAPLE;

async function seedCAPLE() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // 1. Create or get ExamLanguage
    let language = await ExamLanguage.findOne({ code: config.language.code });
    if (language) {
      console.log(`= ${config.language.name} already exists`);
    } else {
      language = await ExamLanguage.create(config.language);
      console.log(`+ Created ${config.language.name}`);
    }

    // 2. Create ExamTypes for each level
    let totalQuestions = 0;
    for (const level of config.levels) {
      const examKey = `${config.name}/${level}`;

      let exam = await ExamType.findOne({ name: examKey });
      if (exam) {
        console.log(`= ${examKey} already exists`);
        continue;
      }

      exam = await ExamType.create({
        name: examKey,
        languageId: language._id,
        description: `${config.description} Level ${level}`,
        sections: config.sections,
        durationMinutes: config.durationMinutes,
        scoringType: config.scoringType,
        maxScore: config.maxScore,
      });
      console.log(`+ Created ${examKey}`);

      // 3. Create sections and questions
      for (const sectionType of config.sections) {
        let section = await ExamSection.findOne({ examId: exam._id, sectionType });
        if (section) {
          console.log(`  = ${sectionType} already exists`);
          continue;
        }

        const sectionNames = {
          reading: 'Reading',
          'writing-task-1': 'Writing — Task 1',
          'writing-task-2': 'Writing — Task 2',
          'speaking-part-1': 'Speaking — Part 1',
          'speaking-part-2': 'Speaking — Part 2',
          'speaking-part-3': 'Speaking — Part 3',
        };

        section = await ExamSection.create({
          examId: exam._id,
          sectionName: sectionNames[sectionType],
          sectionType,
          durationMinutes: ['reading', 'writing-task-1', 'writing-task-2'].includes(sectionType) ? 40 : 10,
          questionCount: sectionType.startsWith('speaking') ? config.questionsPerSpeakingPart : config.questionsPerSection,
        });

        // Generate questions
        let questions = [];
        if (sectionType === 'reading') {
          questions = generateReadingQuestions(config.questionsPerSection, config.language.code);
        } else if (sectionType.startsWith('writing')) {
          questions = generateWritingQuestions(config.questionsPerSection, config.language.code);
        } else if (sectionType.startsWith('speaking')) {
          questions = generateSpeakingQuestions(config.questionsPerSpeakingPart, config.language.code);
        }

        // Attach section ID and metadata
        questions = questions.map((q) => ({
          ...q,
          sectionId: section._id,
          examId: exam._id,
        }));

        await ExamQuestion.insertMany(questions);
        totalQuestions += questions.length;
        console.log(`  + Created ${questions.length} ${sectionType} questions`);
      }
    }

    console.log(`\n✅ CAPLE seed complete — ${totalQuestions} questions created\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedCAPLE();
