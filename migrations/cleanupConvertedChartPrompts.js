/**
 * One-off cleanup: removes the two IELTS Writing Task 1 prompts that used to
 * describe a chart as plain text. They have been rewritten in seedExamStudy.js
 * to embed a real figure block (<<<FIGURE …>>>), rendered by ExamFigureView.
 *
 * Because the seed dedups on questionText, the rewritten versions would be
 * inserted ALONGSIDE the old text ones. Delete the old ones first (matched by
 * their distinctive "The bar chart …" prefix, scoped to builtin essays), then
 * re-run seedExamStudy.js to insert the figure versions.
 *
 *   node migrations/cleanupConvertedChartPrompts.js
 */
require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamQuestion = require('../models/ExamQuestion');

async function cleanup() {
  console.log('🔄 Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // The two old prompts both begin "The bar chart …" and are the only builtin
  // essay questions that do. The new figure versions begin with "<<<FIGURE".
  const res = await ExamQuestion.deleteMany({
    source: 'builtin',
    questionType: 'essay',
    // All old plain-text chart prompts; the figure versions begin "<<<FIGURE".
    questionText: { $regex: '^The (bar chart|pie chart|line graph|table shows)' },
  });

  console.log(`🗑  Deleted ${res.deletedCount} old text-chart prompt(s) (expected 2)`);
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
