# Multi-Language Exam Expansion Design

**Date:** July 9, 2026  
**Status:** Design Approved  
**Scope:** Add 6 new language exams (French, German, Chinese, Japanese, Portuguese, Italian) with large question corpus

---

## Executive Summary

Expand the exam study system from 3 languages (English, Spanish, Korean) to 9 languages by adding modular seed migrations for each new language. Each language uses its standard certification exam with full difficulty levels and ~150+ questions per section, covering diverse reading types, writing task formats, and speaking topics.

**Key Features:**
- ✅ Backward compatible — no code changes needed
- ✅ Modular — add languages independently
- ✅ Safe — each language isolated, idempotent operations
- ✅ Large corpus — 150+ questions per section per language
- ✅ Diverse content — reading (6 types), writing (9 types), speaking (20+ topics)

---

## Current State

**Existing Languages (3):**
- IELTS (English): 214 questions
- DELE (Spanish): 167 questions
- TOPIK (Korean): 174 questions

**Database Engagement:**
- 626 total users
- 10 users with exam progress
- 59 study tips
- 1,590 vocabulary words

---

## Design

### Architecture

**File Structure:**
```
migrations/
├── seedExamStudy.js          (existing — IELTS, DELE, TOPIK)
├── seedDELF.js               (French: A1, A2, B1, B2)
├── seedGoethe.js             (German: A1, A2, B1, B2, C1, C2)
├── seedHSK.js                (Chinese Mandarin: HSK 1-6)
├── seedJLPT.js               (Japanese: N5, N4, N3, N2, N1)
├── seedCAPLE.js              (Portuguese: A1, A2, B1, B2, C1, C2)
└── seedCELI.js               (Italian: A1, A2, B1, B2, C1, C2)
```

**Data Models (No Changes Required):**
- `ExamLanguage` — language metadata (name, code, icon)
- `ExamType` — exam certification (DELF, Goethe, HSK, JLPT, CAPLE, CELI)
- `ExamSection` — test sections (reading, writing-task-1, writing-task-2, speaking-part-1/2/3)
- `ExamQuestion` — individual questions with topic, type, difficulty

### Language Specifications

#### French (DELF)
- **Levels:** A1, A2, B1, B2 (4 levels, European framework)
- **Sections per level:** Reading, Writing Task 1, Writing Task 2, Speaking Parts 1-3
- **Questions per section:** 150+ (except speaking: 40-50)
- **Reading types:** Academic, news, opinion, creative, technical, social media
- **Writing types:** Letters, emails, essays, reports, creative narratives, reviews, summaries, proposals, formal correspondence
- **Speaking topics:** Hobbies, travel, work, education, family, technology, environment, health, culture, sports, food, media, relationships, ethics, career, social issues, art, money, local customs, current events

#### German (Goethe)
- **Levels:** A1, A2, B1, B2, C1, C2 (6 levels, European framework)
- **Sections per level:** Same as DELF
- **Questions per section:** 150+ (speaking: 40-50)
- **Content:** Same diversity as DELF (adapted for German contexts)

#### Chinese Mandarin (HSK)
- **Levels:** HSK 1, 2, 3, 4, 5, 6 (6 levels, proficiency scale)
- **Sections per level:** Same structure
- **Questions per section:** 150+ (speaking: 40-50)
- **Reading:** Adapted for Chinese comprehension (character recognition, grammar patterns)
- **Writing:** Adapted for Chinese writing system (stroke order contexts noted where relevant)
- **Speaking topics:** Same breadth as European languages

#### Japanese (JLPT)
- **Levels:** N5, N4, N3, N2, N1 (5 levels, proficiency scale)
- **Sections per level:** Same structure
- **Questions per section:** 150+ (speaking: 40-50)
- **Reading:** Hiragana, katakana, kanji recognition
- **Writing:** Japanese writing system contexts
- **Speaking topics:** Same breadth

#### Portuguese (CAPLE)
- **Levels:** A1, A2, B1, B2, C1, C2 (6 levels, European framework)
- **Sections per level:** Same structure
- **Questions per section:** 150+ (speaking: 40-50)
- **Content:** Diverse for Portuguese (Brazil + European contexts where relevant)

#### Italian (CELI)
- **Levels:** A1, A2, B1, B2, C1, C2 (6 levels, European framework)
- **Sections per level:** Same structure
- **Questions per section:** 150+ (speaking: 40-50)
- **Content:** Italian cultural and linguistic contexts

### Implementation Details

**Each seed file:**
1. Connects to MongoDB
2. Creates `ExamLanguage` (if not exists) with name, code, icon
3. Creates `ExamType` per level with standard exam configuration
4. Creates `ExamSection` for each test section
5. Creates 150+ `ExamQuestion` per section with:
   - Topic (diverse: 20+ topics per language)
   - Question type (reading: 6 types, writing: 9 types, speaking: open-ended)
   - Difficulty (matched to exam level)
   - Explanation/guidance for learners
6. Logs progress: `✅ Created 450 DELF questions across 4 levels`
7. Exits gracefully (idempotent — safe to re-run)

**Question Distribution Example (DELF):**
```
DELF A1:
  - Reading: 150 Q (varied topics: 7 questions/topic × 20 topics)
  - Writing Task 1: 150 Q (varied prompts: 17 questions/type × 9 types)
  - Writing Task 2: 150 Q (same distribution)
  - Speaking Part 1: 40 Q (diverse starters: 2 per topic × 20 topics)
  - Speaking Part 2: 40 Q
  - Speaking Part 3: 40 Q
  Total: 570 Q per level × 4 levels = 2,280 DELF questions
```

### Backward Compatibility

✅ **No code changes required:**
- Existing models support all languages
- API routes already parameterized by language
- Frontend automatically discovers new languages from API
- Existing IELTS/DELE/TOPIK data untouched
- Each seed file idempotent (safe to re-run)

✅ **Safety:**
- New languages added via separate migrations
- If one language seed fails, others unaffected
- Database transactions per-language
- Explicit logging of what was created

### Execution Plan

**Run independently:**
```bash
# Existing languages (no changes)
node migrations/seedExamStudy.js

# Add new languages one at a time
node migrations/seedDELF.js     # French
node migrations/seedGoethe.js   # German
node migrations/seedHSK.js      # Chinese
node migrations/seedJLPT.js     # Japanese
node migrations/seedCAPLE.js    # Portuguese
node migrations/seedCELI.js     # Italian
```

**User can:**
- Add languages incrementally
- Test each before proceeding
- Pause and resume without affecting other data
- Re-run any seed without duplicating

### Testing Strategy

1. **Data Validation:**
   - Count questions per section (should be ~150)
   - Verify topics are diverse (20+ unique topics per language)
   - Check difficulty levels match exam standard

2. **Backward Compatibility:**
   - Run existing exam endpoints (IELTS, DELE, TOPIK)
   - Verify no data corruption
   - Check API still returns correct counts

3. **New Language Verification:**
   - Query new exam data: `GET /api/exams?language=French`
   - Count questions per section
   - Verify speaking questions are open-ended

---

## Effort Estimate

- **Development:** ~3-4 hours (write 6 seed files with diverse question content)
- **Testing:** ~1 hour (verify data, test backward compatibility)
- **Total:** ~4-5 hours

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Large seed files hard to debug | Modular per-language files; easy to isolate issues |
| One language breaks app | Separate migrations; if DELF fails, TOPIK still works |
| Database bloat | 6 languages × ~2,000 Q = 12,000 extra questions; manageable |
| Question quality inconsistency | Use consistent templates; review samples before commit |
| Backward compatibility broken | No code changes to models/routes; schema already supports |

---

## Success Criteria

- ✅ All 6 new languages seeded without errors
- ✅ Each language has 150+ questions per section
- ✅ Existing IELTS/DELE/TOPIK data unaffected
- ✅ API returns new languages in language list
- ✅ Exam endpoints work for all 9 languages
- ✅ All seeds are idempotent (safe to re-run)
- ✅ No database transactions across languages

---

## Next Steps

1. Write implementation plan (writing-plans skill)
2. Create 6 seed files with diverse question content
3. Test each seed independently
4. Verify backward compatibility
5. Commit with clear messages per language

