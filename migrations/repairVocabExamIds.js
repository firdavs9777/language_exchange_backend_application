/**
 * One-shot repair: every ExamVocabularyWord must have examIds matching
 * its languageId. The earlier seedExamVocab.js used
 * `ExamType.findOne({ code: 'X' })`, but ExamType has no `code` field
 * — Mongoose stripped the unknown field, findOne({}) returned the
 * first doc (always IELTS), so every Spanish/Korean word got tagged
 * IELTS instead of DELE/TOPIK.
 *
 * This script repairs the data. After this runs, the seed file must
 * be updated to look up exams by `name`.
 */
require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamVocabularyWord = require('../models/ExamVocabularyWord');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { useUnifiedTopology: true });
  console.log('connected');

  // Look up by NAME — works for both legacy and any future seed.
  const [en, es, ko] = await Promise.all([
    ExamLanguage.findOne({ code: 'en' }),
    ExamLanguage.findOne({ code: 'es' }),
    ExamLanguage.findOne({ code: 'ko' }),
  ]);
  const [ielts, dele, topik] = await Promise.all([
    ExamType.findOne({ name: 'IELTS' }),
    ExamType.findOne({ name: 'DELE' }),
    ExamType.findOne({ name: 'TOPIK' }),
  ]);
  if (!ielts || !dele || !topik) {
    throw new Error('Missing exam doc. Run seedExamStudy.js first.');
  }
  console.log(`IELTS: ${ielts._id}\nDELE:  ${dele._id}\nTOPIK: ${topik._id}`);

  const LANG_TO_EXAM = new Map([
    [String(en._id), ielts._id],
    [String(es._id), dele._id],
    [String(ko._id), topik._id],
  ]);

  let scanned = 0;
  let fixed = 0;
  const cursor = ExamVocabularyWord.find({}).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned += 1;
    const correctExamId = LANG_TO_EXAM.get(String(doc.languageId));
    if (!correctExamId) {
      console.log(`!! orphan doc: word="${doc.word}" languageId=${doc.languageId} (no language match) — skipping`);
      continue;
    }
    // Replace examIds with the single correct ID. If the doc already
    // matches, skip.
    const current = doc.examIds.map(String);
    const target = [String(correctExamId)];
    const same = current.length === 1 && current[0] === target[0];
    if (!same) {
      doc.examIds = [correctExamId];
      await doc.save();
      fixed += 1;
    }
    if (scanned % 200 === 0) console.log(`  scanned ${scanned}, fixed ${fixed}`);
  }
  console.log(`done. scanned=${scanned}  fixed=${fixed}`);
  await mongoose.disconnect();
})();
