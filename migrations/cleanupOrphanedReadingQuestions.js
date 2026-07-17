/**
 * One-off cleanup: removes the IELTS Reading questions that referenced a
 * reading passage which was never stored (no `passage` field exists in the
 * schema, and these items never embedded their passage in `questionText`).
 *
 * seedExamStudy.js now ships self-contained replacements (each embeds its own
 * short passage), but its dedup is keyed on `questionText` — so it would
 * happily insert the new versions ALONGSIDE these stale rows. Delete the old
 * rows first, then re-run seedExamStudy.js to insert the corrected versions.
 *
 * Scoped to source:'builtin' and matched by exact old questionText, so the
 * 7 already-good reading questions and any user/AI-generated content are
 * left untouched.
 *
 *   node migrations/cleanupOrphanedReadingQuestions.js
 */
require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamQuestion = require('../models/ExamQuestion');

// Exact questionText of each orphaned row as it currently exists in prod
// (i.e. BEFORE the seed edits). These are the strings to delete.
const ORPHANED_QUESTION_TEXTS = [
  'According to the passage, the author argues that renewable energy is most effective when:',
  'The word "abundant" in paragraph 2 is closest in meaning to:',
  'The passage suggests that artificial intelligence is most useful when it is:',
  'What does the author identify as the primary benefit of slow travel?',
  "Which of the following best summarises the author's view on standardised testing?",
  'According to the passage, regular exercise primarily benefits cognitive function by:',
  'In the passage above, the word "variability" most closely means:',
  'According to the passage, what is the main DRAWBACK of full remote work?',
  'In the passage above, what does the author imply about cloud-based speech recognition?',
  'Demographic studies indicate that the average household size in developed countries has been shrinking for decades, driven by lower birth rates and a growing number of single-person households. This trend has consequences for housing demand and urban planning.\n\nWhich is NOT mentioned as a cause of shrinking households?',
  // DELE (Spanish) reading questions that referenced a passage never stored.
  'En el texto, el autor sugiere que el éxito profesional depende principalmente de:',
  'Según el pasaje, ¿qué recomienda el autor para viajar de manera sostenible?',
  '¿Cuál es la idea principal del texto sobre la dieta mediterránea?',
];

async function cleanup() {
  console.log('🔄 Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const res = await ExamQuestion.deleteMany({
    source: 'builtin',
    questionText: { $in: ORPHANED_QUESTION_TEXTS },
  });

  console.log(`🗑  Deleted ${res.deletedCount} orphaned reading question(s)`);
  console.log(
    `   (expected up to ${ORPHANED_QUESTION_TEXTS.length}; fewer is fine if some were never seeded)`,
  );
  console.log('✅ Cleanup complete — now run: node migrations/seedExamStudy.js');
  await mongoose.disconnect();
}

cleanup().catch(async (err) => {
  console.error('❌ Cleanup failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
