/**
 * Migration: seed exam vocabulary words for all languages
 *
 * Seeds vocabulary for IELTS, DELE, TOPIK (existing) and
 * DELF, Goethe, HSK, JLPT, CAPLE, CELI (new)
 *
 * Idempotent — re-runs without duplicating.
 *
 * Usage:
 *   node migrations/seedVocabulary.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamVocabularyWord = require('../models/ExamVocabularyWord');
const { generateExpandedVocabulary } = require('../utils/examVocabularyExpanded');

// Language to language code mapping
const LANGUAGE_CODES = {
  'English': 'en',
  'Spanish': 'es',
  'Korean': 'ko',
  'French': 'fr',
  'German': 'de',
  'Chinese (Mandarin)': 'zh',
  'Japanese': 'ja',
  'Portuguese': 'pt',
  'Italian': 'it',
};

// Proficiency levels for each exam
const EXAM_LEVELS = {
  'IELTS': ['easy', 'medium', 'hard'],
  'DELE': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  'TOPIK': ['easy', 'medium', 'hard'],
  'DELF': ['A1', 'A2', 'B1', 'B2'],
  'Goethe-Zertifikat': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  'HSK': ['easy', 'medium', 'hard'],
  'JLPT': ['N5', 'N4', 'N3', 'N2', 'N1'],
  'CAPLE': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  'CELI': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
};

// Map exam level names to standard levels
function mapToStandardLevel(examName, level) {
  if (['DELE', 'Goethe-Zertifikat', 'CAPLE', 'CELI', 'DELF'].includes(examName)) {
    return level; // Already in A1-C2 format
  }
  if (examName === 'JLPT') {
    // N5 -> A1, N4 -> A2, N3 -> B1, N2 -> B2, N1 -> C1
    const jlptMap = { 'N5': 'A1', 'N4': 'A2', 'N3': 'B1', 'N2': 'B2', 'N1': 'C1' };
    return jlptMap[level] || 'A1';
  }
  if (examName === 'HSK') {
    // HSK 1-2 -> A1-A2, HSK 3-4 -> B1-B2, HSK 5-6 -> C1-C2
    const hskMap = { 'HSK 1': 'A1', 'HSK 2': 'A2', 'HSK 3': 'B1', 'HSK 4': 'B2', 'HSK 5': 'C1', 'HSK 6': 'C2' };
    return hskMap[level] || 'A1';
  }
  // For easy/medium/hard, convert to CEFR
  if (level === 'easy') return 'A1';
  if (level === 'medium') return 'B1';
  if (level === 'hard') return 'C1';
  return 'A1';
}

async function seedVocabulary() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Get all exams
    const exams = await ExamType.find().lean();
    console.log(`Found ${exams.length} exams\n`);

    let totalWords = 0;

    for (const exam of exams) {
      // Get the language
      const language = await ExamLanguage.findById(exam.languageId);
      if (!language) {
        console.log(`⚠️ Exam ${exam.name} has no language, skipping`);
        continue;
      }

      // Determine language code
      const langCode = LANGUAGE_CODES[language.name] || LANGUAGE_CODES['English'];

      // Extract exam base name (e.g., "DELF" from "DELF/A1")
      const examBaseNameMatch = exam.name.match(/^([A-Za-z\-]+)/);
      const examBaseName = examBaseNameMatch ? examBaseNameMatch[1] : exam.name;

      // Extract level from exam name (e.g., "A1" from "DELF/A1")
      const levelMatch = exam.name.match(/\/(.+)$/);
      const examLevel = levelMatch ? levelMatch[1] : 'A1';
      const standardLevel = mapToStandardLevel(examBaseName, examLevel);

      // Check if vocabulary already exists for this exam/level
      const existingCount = await ExamVocabularyWord.countDocuments({
        languageId: exam.languageId,
        examIds: exam._id,
        level: standardLevel,
      });

      if (existingCount > 0) {
        console.log(`= ${exam.name} (${language.name}) vocabulary already exists`);
        continue;
      }

      // Generate vocabulary (350 words per level with diverse topics)
      const vocabWords = generateExpandedVocabulary(350, langCode, standardLevel);

      // Create vocabulary records
      const wordRecords = vocabWords.map(w => ({
        word: w.word,
        languageId: exam.languageId,
        examIds: [exam._id],
        level: standardLevel,
        topic: w.topic,
        partOfSpeech: w.partOfSpeech,
        definition: w.definition,
        exampleSentence: w.exampleSentence,
      }));

      await ExamVocabularyWord.insertMany(wordRecords);
      totalWords += wordRecords.length;

      console.log(`+ Created ${exam.name} (${language.name}) - ${wordRecords.length} vocabulary words`);
    }

    console.log(`\n✅ Vocabulary seeding complete — ${totalWords} words created\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedVocabulary();
