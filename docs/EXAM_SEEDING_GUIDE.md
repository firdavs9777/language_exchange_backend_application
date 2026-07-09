# Exam Seeding Guide

## Quick Start

### Seed All Languages
```bash
node scripts/seedAllExams.js
```

### Seed Individual Language
```bash
node migrations/seedDELF.js      # French
node migrations/seedGoethe.js    # German
node migrations/seedHSK.js       # Chinese
node migrations/seedJLPT.js      # Japanese
node migrations/seedCAPLE.js     # Portuguese
node migrations/seedCELI.js      # Italian
```

## Available Languages

| Language | Exam | Levels | Questions |
|----------|------|--------|-----------|
| English | IELTS | 1 | 214 |
| Spanish | DELE | 1 | 167 |
| Korean | TOPIK | 1 | 174 |
| French | DELF | A1-B2 | 2,280 |
| German | Goethe | A1-C2 | 3,420 |
| Chinese | HSK | 1-6 | 3,420 |
| Japanese | JLPT | N5-N1 | 2,850 |
| Portuguese | CAPLE | A1-C2 | 3,420 |
| Italian | CELI | A1-C2 | 3,420 |

## Testing

```bash
# Verify backward compatibility
node scripts/testBackwardCompatibility.js

# Check final inventory
node -e "require('mongoose').connect(process.env.MONGO_URI).then(async () => { const db = require('mongoose').connection.db; const exams = await db.collection('examtypes').countDocuments(); console.log(exams + ' exam types'); process.exit(0); })"
```

## Architecture

- `utils/examQuestionGenerator.js` — Question generator with 6 reading types, 9 writing types
- `utils/questionTemplates.js` — Question templates (reading, writing, speaking)
- `utils/seedExamConfig.js` — Exam configurations for all 6 languages
- `migrations/seed*.js` — Per-language seed files
- `scripts/seedAllExams.js` — Unified seed runner

Each seed is idempotent — safe to re-run without duplicating data.
