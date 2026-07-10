/**
 * Migration: Regenerate questions for new languages with proper passages and content
 *
 * Deletes and recreates reading and writing questions for the new language exams
 * so they include proper reading passages and better writing context.
 *
 * Usage:
 *   node migrations/regenerateNewLanguageQuestions.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');
const { generateReadingQuestions, generateWritingQuestions } = require('../utils/examQuestionGenerator');

const NEW_LANGUAGES = {
  fr: ['DELF/A1', 'DELF/A2', 'DELF/B1', 'DELF/B2'],
  de: ['Goethe-Zertifikat/A1', 'Goethe-Zertifikat/A2', 'Goethe-Zertifikat/B1', 'Goethe-Zertifikat/B2', 'Goethe-Zertifikat/C1', 'Goethe-Zertifikat/C2'],
  zh: ['HSK/HSK 1', 'HSK/HSK 2', 'HSK/HSK 3', 'HSK/HSK 4', 'HSK/HSK 5', 'HSK/HSK 6'],
  ja: ['JLPT/N5', 'JLPT/N4', 'JLPT/N3', 'JLPT/N2', 'JLPT/N1'],
  pt: ['CAPLE/A1', 'CAPLE/A2', 'CAPLE/B1', 'CAPLE/B2', 'CAPLE/C1', 'CAPLE/C2'],
  it: ['CELI/A1', 'CELI/A2', 'CELI/B1', 'CELI/B2', 'CELI/C1', 'CELI/C2'],
};

async function regenerateQuestions() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    let totalDeleted = 0;
    let totalCreated = 0;

    for (const [langCode, examNames] of Object.entries(NEW_LANGUAGES)) {
      console.log(`\n📝 Processing ${langCode.toUpperCase()} exams…`);

      for (const examName of examNames) {
        const exam = await ExamType.findOne({ name: examName });
        if (!exam) {
          console.log(`  ⚠️ Exam not found: ${examName}`);
          continue;
        }

        // Delete existing reading and writing questions
        const readingSection = await ExamSection.findOne({ examId: exam._id, sectionType: 'reading' });
        const writingTask1 = await ExamSection.findOne({ examId: exam._id, sectionType: 'writing-task-1' });
        const writingTask2 = await ExamSection.findOne({ examId: exam._id, sectionType: 'writing-task-2' });

        if (readingSection) {
          const deleted = await ExamQuestion.deleteMany({ sectionId: readingSection._id });
          totalDeleted += deleted.deletedCount;
        }
        if (writingTask1) {
          const deleted = await ExamQuestion.deleteMany({ sectionId: writingTask1._id });
          totalDeleted += deleted.deletedCount;
        }
        if (writingTask2) {
          const deleted = await ExamQuestion.deleteMany({ sectionId: writingTask2._id });
          totalDeleted += deleted.deletedCount;
        }

        // Generate new questions with proper passages and context
        const readingQuestions = generateReadingQuestions(150, langCode);
        const writingQuestions = generateWritingQuestions(300, langCode);

        // Insert reading questions
        if (readingSection) {
          const readingDocsWithSection = readingQuestions.map(q => ({
            ...q,
            examId: exam._id,
            sectionId: readingSection._id,
          }));
          const inserted = await ExamQuestion.insertMany(readingDocsWithSection);
          totalCreated += inserted.length;
        }

        // Insert writing questions (split between task 1 and task 2)
        const writingTask1Qs = writingQuestions.slice(0, 150);
        const writingTask2Qs = writingQuestions.slice(150);

        if (writingTask1) {
          const task1DocsWithSection = writingTask1Qs.map(q => ({
            ...q,
            examId: exam._id,
            sectionId: writingTask1._id,
          }));
          const inserted = await ExamQuestion.insertMany(task1DocsWithSection);
          totalCreated += inserted.length;
        }

        if (writingTask2) {
          const task2DocsWithSection = writingTask2Qs.map(q => ({
            ...q,
            examId: exam._id,
            sectionId: writingTask2._id,
          }));
          const inserted = await ExamQuestion.insertMany(task2DocsWithSection);
          totalCreated += inserted.length;
        }

        console.log(`  ✅ ${examName} - regenerated reading & writing questions`);
      }
    }

    console.log(`\n✅ Complete — deleted ${totalDeleted} old questions, created ${totalCreated} new questions\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

regenerateQuestions();
