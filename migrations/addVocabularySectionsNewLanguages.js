/**
 * Migration: Add vocabulary sections for new language exams
 *
 * Adds vocabulary sections to DELF, Goethe-Zertifikat, HSK, JLPT, CAPLE, CELI exams
 * The vocabulary words already exist (seeded by seedVocabulary.js), but the sections
 * were missing, so the Flutter app couldn't display them.
 *
 * Usage:
 *   node migrations/addVocabularySectionsNewLanguages.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');

// Vocabulary section names per language
const VOCAB_SECTIONS = [
  { examName: 'DELF/A1', sectionName: 'Vocabulaire', language: 'French' },
  { examName: 'DELF/A2', sectionName: 'Vocabulaire', language: 'French' },
  { examName: 'DELF/B1', sectionName: 'Vocabulaire', language: 'French' },
  { examName: 'DELF/B2', sectionName: 'Vocabulaire', language: 'French' },

  { examName: 'Goethe-Zertifikat/A1', sectionName: 'Wortschatz', language: 'German' },
  { examName: 'Goethe-Zertifikat/A2', sectionName: 'Wortschatz', language: 'German' },
  { examName: 'Goethe-Zertifikat/B1', sectionName: 'Wortschatz', language: 'German' },
  { examName: 'Goethe-Zertifikat/B2', sectionName: 'Wortschatz', language: 'German' },
  { examName: 'Goethe-Zertifikat/C1', sectionName: 'Wortschatz', language: 'German' },
  { examName: 'Goethe-Zertifikat/C2', sectionName: 'Wortschatz', language: 'German' },

  { examName: 'HSK/HSK 1', sectionName: '词汇', language: 'Chinese' },
  { examName: 'HSK/HSK 2', sectionName: '词汇', language: 'Chinese' },
  { examName: 'HSK/HSK 3', sectionName: '词汇', language: 'Chinese' },
  { examName: 'HSK/HSK 4', sectionName: '词汇', language: 'Chinese' },
  { examName: 'HSK/HSK 5', sectionName: '词汇', language: 'Chinese' },
  { examName: 'HSK/HSK 6', sectionName: '词汇', language: 'Chinese' },

  { examName: 'JLPT/N5', sectionName: '語彙', language: 'Japanese' },
  { examName: 'JLPT/N4', sectionName: '語彙', language: 'Japanese' },
  { examName: 'JLPT/N3', sectionName: '語彙', language: 'Japanese' },
  { examName: 'JLPT/N2', sectionName: '語彙', language: 'Japanese' },
  { examName: 'JLPT/N1', sectionName: '語彙', language: 'Japanese' },

  { examName: 'CAPLE/A1', sectionName: 'Vocabulário', language: 'Portuguese' },
  { examName: 'CAPLE/A2', sectionName: 'Vocabulário', language: 'Portuguese' },
  { examName: 'CAPLE/B1', sectionName: 'Vocabulário', language: 'Portuguese' },
  { examName: 'CAPLE/B2', sectionName: 'Vocabulário', language: 'Portuguese' },
  { examName: 'CAPLE/C1', sectionName: 'Vocabulário', language: 'Portuguese' },
  { examName: 'CAPLE/C2', sectionName: 'Vocabulário', language: 'Portuguese' },

  { examName: 'CELI/A1', sectionName: 'Vocabolario', language: 'Italian' },
  { examName: 'CELI/A2', sectionName: 'Vocabolario', language: 'Italian' },
  { examName: 'CELI/B1', sectionName: 'Vocabolario', language: 'Italian' },
  { examName: 'CELI/B2', sectionName: 'Vocabolario', language: 'Italian' },
  { examName: 'CELI/C1', sectionName: 'Vocabolario', language: 'Italian' },
  { examName: 'CELI/C2', sectionName: 'Vocabolario', language: 'Italian' },
];

async function addVocabularySections() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    let created = 0;
    let skipped = 0;

    for (const vocabData of VOCAB_SECTIONS) {
      const exam = await ExamType.findOne({ name: vocabData.examName });
      if (!exam) {
        console.log(`⚠️ Exam "${vocabData.examName}" not found, skipping`);
        continue;
      }

      // Check if vocabulary section already exists
      const existing = await ExamSection.findOne({
        examId: exam._id,
        sectionType: 'vocabulary',
      });

      if (existing) {
        console.log(`= ${vocabData.examName} vocabulary section already exists`);
        skipped += 1;
        continue;
      }

      // Create vocabulary section
      await ExamSection.create({
        examId: exam._id,
        sectionName: vocabData.sectionName,
        sectionType: 'vocabulary',
        questionCount: 0,
      });

      // Update ExamType to include 'vocabulary' in sections array
      await ExamType.updateOne(
        { _id: exam._id },
        { $addToSet: { sections: 'vocabulary' } }
      );

      console.log(`+ ${vocabData.examName.padEnd(25)} (${vocabData.language.padEnd(10)}) → vocabulary section created`);
      created += 1;
    }

    console.log(`\n✅ Done — ${created} sections created, ${skipped} already existed\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

addVocabularySections();
