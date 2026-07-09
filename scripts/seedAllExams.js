require('dotenv').config({ path: './config/config.env' });
const { spawn } = require('child_process');

const seeds = [
  { name: 'DELF (French)', file: 'migrations/seedDELF.js' },
  { name: 'Goethe (German)', file: 'migrations/seedGoethe.js' },
  { name: 'HSK (Chinese)', file: 'migrations/seedHSK.js' },
  { name: 'JLPT (Japanese)', file: 'migrations/seedJLPT.js' },
  { name: 'CAPLE (Portuguese)', file: 'migrations/seedCAPLE.js' },
  { name: 'CELI (Italian)', file: 'migrations/seedCELI.js' },
];

async function runSeed(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [file]);
    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
      output += data;
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
      error += data;
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Seed failed with code ${code}: ${error}`));
      }
    });
  });
}

async function seedAll() {
  console.log('🚀 Starting Multi-Language Exam Seeding\n');
  console.log('This will seed all 6 language exams.');
  console.log('Each language can be seeded independently later.\n');
  console.log('='.repeat(60) + '\n');

  let completed = 0;
  let failed = 0;

  for (const seed of seeds) {
    console.log(`\n📚 [${completed + 1}/${seeds.length}] Seeding ${seed.name}…\n`);
    try {
      await runSeed(seed.file);
      completed++;
    } catch (err) {
      console.error(`\n❌ Failed to seed ${seed.name}: ${err.message}\n`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Seeding Summary:`);
  console.log(`   ✅ Completed: ${completed}/${seeds.length}`);
  console.log(`   ❌ Failed: ${failed}/${seeds.length}\n`);

  if (failed === 0) {
    console.log('🎉 All exams seeded successfully!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some seeds failed. Review logs above.\n');
    process.exit(1);
  }
}

seedAll();
