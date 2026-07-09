require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');

async function testBackwardCompatibility() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    console.log('📊 Testing Backward Compatibility\n');

    const existingExams = ['IELTS', 'DELE', 'TOPIK'];
    let allPassed = true;

    for (const examName of existingExams) {
      console.log(`\n🔍 Testing ${examName}…`);

      const exams = await ExamType.find({ name: { $regex: `^${examName}` } });
      if (exams.length === 0) {
        console.log(`  ❌ FAIL: No ${examName} exams found`);
        allPassed = false;
        continue;
      }

      console.log(`  ✅ Found ${exams.length} ${examName} exam(s)`);

      for (const exam of exams) {
        const sections = await ExamSection.find({ examId: exam._id });
        console.log(`     - ${exam.name}: ${sections.length} sections`);

        let totalQuestions = 0;
        for (const section of sections) {
          const count = await ExamQuestion.countDocuments({ sectionId: section._id });
          totalQuestions += count;
        }
        console.log(`       ${totalQuestions} total questions`);

        if (totalQuestions === 0) {
          console.log(`  ❌ FAIL: ${exam.name} has no questions`);
          allPassed = false;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✅ All backward compatibility tests PASSED');
      console.log('='.repeat(50) + '\n');
      process.exit(0);
    } else {
      console.log('❌ Some tests FAILED');
      console.log('='.repeat(50) + '\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

testBackwardCompatibility();
