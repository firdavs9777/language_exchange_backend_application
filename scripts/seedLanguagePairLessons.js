/**
 * Seed Language-Pair Specific Lessons
 *
 * Creates starter A1 lessons for common language pairs.
 * Each lesson has explanations/hints in the learner's native language.
 *
 * Usage: node scripts/seedLanguagePairLessons.js
 *
 * Options:
 *   --dry-run    Show what would be created without writing to DB
 *   --pair=ko:en Only seed a specific pair (sourceLanguage:targetLanguage)
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Lesson = require('../models/Lesson');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const isDryRun = process.argv.includes('--dry-run');
const pairArg = process.argv.find(a => a.startsWith('--pair='));
const specificPair = pairArg ? pairArg.split('=')[1] : null;

// Language display names (in their own language for native speakers)
const LANG_NAMES = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
  'zh-Hant': '繁體中文',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ar: 'العربية',
  hi: 'हिन्दी',
  ru: 'Русский',
  th: 'ภาษาไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  tr: 'Türkçe',
  tl: 'Filipino',
};

// English names for display in target language context
const LANG_NAMES_EN = {
  en: 'English', ko: 'Korean', ja: 'Japanese', zh: 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)', es: 'Spanish', pt: 'Portuguese',
  fr: 'French', de: 'German', it: 'Italian', ar: 'Arabic', hi: 'Hindi',
  ru: 'Russian', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  tr: 'Turkish', tl: 'Filipino',
};

// Priority language pairs to seed
// Format: [sourceLanguage, targetLanguage]
const PRIORITY_PAIRS = [
  // English as target (most common)
  ['ko', 'en'], ['ja', 'en'], ['zh', 'en'], ['es', 'en'], ['pt', 'en'],
  ['fr', 'en'], ['de', 'en'], ['ar', 'en'], ['hi', 'en'], ['ru', 'en'],
  ['th', 'en'], ['vi', 'en'], ['id', 'en'], ['tr', 'en'], ['tl', 'en'],
  ['it', 'en'], ['zh-Hant', 'en'],
  // English as source (learning other languages)
  ['en', 'ko'], ['en', 'ja'], ['en', 'zh'], ['en', 'es'], ['en', 'pt'],
  ['en', 'fr'], ['en', 'de'], ['en', 'ar'], ['en', 'hi'], ['en', 'ru'],
  ['en', 'th'], ['en', 'vi'], ['en', 'id'], ['en', 'tr'], ['en', 'tl'],
  ['en', 'it'], ['en', 'zh-Hant'],
  // Popular non-English pairs
  ['ko', 'ja'], ['ja', 'ko'], ['zh', 'ja'], ['zh', 'ko'],
  ['es', 'pt'], ['pt', 'es'], ['ko', 'zh'], ['es', 'fr'],
];

/**
 * Generate greeting phrases for a target language
 */
function getGreetings(targetLang) {
  const greetings = {
    en: [
      { phrase: 'Hello', phonetic: 'heh-LOW', usage: 'General greeting' },
      { phrase: 'Good morning', phonetic: 'good MOR-ning', usage: 'Morning greeting' },
      { phrase: 'How are you?', phonetic: 'how ar yoo', usage: 'Asking about wellbeing' },
      { phrase: 'Nice to meet you', phonetic: 'nais too meet yoo', usage: 'First meeting' },
      { phrase: 'Goodbye', phonetic: 'good-BAI', usage: 'Farewell' },
    ],
    ko: [
      { phrase: '안녕하세요', phonetic: 'an-nyeong-ha-se-yo', usage: 'Formal greeting' },
      { phrase: '좋은 아침이에요', phonetic: 'jo-eun a-chi-mi-e-yo', usage: 'Good morning' },
      { phrase: '잘 지내세요?', phonetic: 'jal ji-nae-se-yo', usage: 'How are you? (formal)' },
      { phrase: '만나서 반갑습니다', phonetic: 'man-na-seo ban-gap-seum-ni-da', usage: 'Nice to meet you' },
      { phrase: '안녕히 가세요', phonetic: 'an-nyeong-hi ga-se-yo', usage: 'Goodbye (to person leaving)' },
    ],
    ja: [
      { phrase: 'こんにちは', phonetic: 'kon-ni-chi-wa', usage: 'General greeting' },
      { phrase: 'おはようございます', phonetic: 'o-ha-you go-zai-ma-su', usage: 'Good morning (polite)' },
      { phrase: 'お元気ですか', phonetic: 'o-gen-ki de-su-ka', usage: 'How are you?' },
      { phrase: 'はじめまして', phonetic: 'ha-ji-me-ma-shi-te', usage: 'Nice to meet you' },
      { phrase: 'さようなら', phonetic: 'sa-you-na-ra', usage: 'Goodbye' },
    ],
    zh: [
      { phrase: '你好', phonetic: 'nǐ hǎo', usage: 'General greeting' },
      { phrase: '早上好', phonetic: 'zǎo shang hǎo', usage: 'Good morning' },
      { phrase: '你好吗？', phonetic: 'nǐ hǎo ma', usage: 'How are you?' },
      { phrase: '很高兴认识你', phonetic: 'hěn gāo xìng rèn shi nǐ', usage: 'Nice to meet you' },
      { phrase: '再见', phonetic: 'zài jiàn', usage: 'Goodbye' },
    ],
    es: [
      { phrase: 'Hola', phonetic: 'OH-lah', usage: 'General greeting' },
      { phrase: 'Buenos días', phonetic: 'BWEH-nos DEE-as', usage: 'Good morning' },
      { phrase: '¿Cómo estás?', phonetic: 'KOH-moh es-TAHS', usage: 'How are you? (informal)' },
      { phrase: 'Mucho gusto', phonetic: 'MOO-cho GOO-stoh', usage: 'Nice to meet you' },
      { phrase: 'Adiós', phonetic: 'ah-dee-OHS', usage: 'Goodbye' },
    ],
    fr: [
      { phrase: 'Bonjour', phonetic: 'bohn-ZHOOR', usage: 'General greeting' },
      { phrase: 'Bonsoir', phonetic: 'bohn-SWAHR', usage: 'Good evening' },
      { phrase: 'Comment allez-vous ?', phonetic: 'koh-MAHN tah-lay VOO', usage: 'How are you? (formal)' },
      { phrase: 'Enchanté(e)', phonetic: 'ahn-shahn-TAY', usage: 'Nice to meet you' },
      { phrase: 'Au revoir', phonetic: 'oh ruh-VWAHR', usage: 'Goodbye' },
    ],
    de: [
      { phrase: 'Hallo', phonetic: 'HAH-loh', usage: 'General greeting' },
      { phrase: 'Guten Morgen', phonetic: 'GOO-ten MOR-gen', usage: 'Good morning' },
      { phrase: 'Wie geht es Ihnen?', phonetic: 'vee gayt es EE-nen', usage: 'How are you? (formal)' },
      { phrase: 'Freut mich', phonetic: 'froyt mikh', usage: 'Nice to meet you' },
      { phrase: 'Auf Wiedersehen', phonetic: 'owf VEE-der-zay-en', usage: 'Goodbye' },
    ],
    pt: [
      { phrase: 'Olá', phonetic: 'oh-LAH', usage: 'General greeting' },
      { phrase: 'Bom dia', phonetic: 'bohm JEE-ah', usage: 'Good morning' },
      { phrase: 'Como vai?', phonetic: 'KOH-moo vai', usage: 'How are you?' },
      { phrase: 'Prazer em conhecê-lo', phonetic: 'prah-ZEHR em koh-nyeh-SEH-loo', usage: 'Nice to meet you' },
      { phrase: 'Tchau', phonetic: 'chow', usage: 'Goodbye (informal)' },
    ],
    it: [
      { phrase: 'Ciao', phonetic: 'CHOW', usage: 'Hi / Bye (informal)' },
      { phrase: 'Buongiorno', phonetic: 'bwon-JOOR-no', usage: 'Good morning/day' },
      { phrase: 'Come stai?', phonetic: 'KOH-meh STAI', usage: 'How are you? (informal)' },
      { phrase: 'Piacere', phonetic: 'pyah-CHEH-reh', usage: 'Nice to meet you' },
      { phrase: 'Arrivederci', phonetic: 'ar-ree-veh-DEHR-chee', usage: 'Goodbye' },
    ],
    ar: [
      { phrase: 'مرحبا', phonetic: 'mar-ha-ba', usage: 'General greeting' },
      { phrase: 'صباح الخير', phonetic: 'sa-baah al-khayr', usage: 'Good morning' },
      { phrase: 'كيف حالك؟', phonetic: 'kayf haa-lak', usage: 'How are you?' },
      { phrase: 'تشرفنا', phonetic: 'ta-shar-raf-na', usage: 'Nice to meet you' },
      { phrase: 'مع السلامة', phonetic: 'ma-a as-sa-laa-ma', usage: 'Goodbye' },
    ],
    hi: [
      { phrase: 'नमस्ते', phonetic: 'na-mas-te', usage: 'General greeting' },
      { phrase: 'सुप्रभात', phonetic: 'su-pra-bhaat', usage: 'Good morning' },
      { phrase: 'आप कैसे हैं?', phonetic: 'aap kai-se hain', usage: 'How are you? (formal)' },
      { phrase: 'आपसे मिलकर खुशी हुई', phonetic: 'aap-se mil-kar khu-shee hu-ee', usage: 'Nice to meet you' },
      { phrase: 'अलविदा', phonetic: 'al-vi-da', usage: 'Goodbye' },
    ],
    ru: [
      { phrase: 'Привет', phonetic: 'pri-VYET', usage: 'Hi (informal)' },
      { phrase: 'Доброе утро', phonetic: 'DOB-ro-ye OO-tro', usage: 'Good morning' },
      { phrase: 'Как дела?', phonetic: 'kak de-LA', usage: 'How are you?' },
      { phrase: 'Приятно познакомиться', phonetic: 'pri-YAT-no poz-na-KO-mit-sya', usage: 'Nice to meet you' },
      { phrase: 'До свидания', phonetic: 'do svi-DA-ni-ya', usage: 'Goodbye' },
    ],
    th: [
      { phrase: 'สวัสดี', phonetic: 'sa-wat-dee', usage: 'General greeting' },
      { phrase: 'อรุณสวัสดิ์', phonetic: 'a-run sa-wat', usage: 'Good morning' },
      { phrase: 'สบายดีไหม', phonetic: 'sa-bai dee mai', usage: 'How are you?' },
      { phrase: 'ยินดีที่ได้รู้จัก', phonetic: 'yin-dee tee dai roo-jak', usage: 'Nice to meet you' },
      { phrase: 'ลาก่อน', phonetic: 'laa gon', usage: 'Goodbye' },
    ],
    vi: [
      { phrase: 'Xin chào', phonetic: 'sin chow', usage: 'General greeting' },
      { phrase: 'Chào buổi sáng', phonetic: 'chow boo-oy sahng', usage: 'Good morning' },
      { phrase: 'Bạn khỏe không?', phonetic: 'ban kweh kohng', usage: 'How are you?' },
      { phrase: 'Rất vui được gặp bạn', phonetic: 'rat voo-ee duhk gap ban', usage: 'Nice to meet you' },
      { phrase: 'Tạm biệt', phonetic: 'tam bee-et', usage: 'Goodbye' },
    ],
    id: [
      { phrase: 'Halo', phonetic: 'HA-lo', usage: 'General greeting' },
      { phrase: 'Selamat pagi', phonetic: 'se-LA-mat PA-gi', usage: 'Good morning' },
      { phrase: 'Apa kabar?', phonetic: 'A-pa KA-bar', usage: 'How are you?' },
      { phrase: 'Senang bertemu Anda', phonetic: 'se-NANG ber-TE-mu AN-da', usage: 'Nice to meet you' },
      { phrase: 'Sampai jumpa', phonetic: 'SAM-pai JUM-pa', usage: 'Goodbye' },
    ],
    tr: [
      { phrase: 'Merhaba', phonetic: 'mer-HA-ba', usage: 'General greeting' },
      { phrase: 'Günaydın', phonetic: 'goo-NAI-dun', usage: 'Good morning' },
      { phrase: 'Nasılsınız?', phonetic: 'na-SUL-su-nuz', usage: 'How are you? (formal)' },
      { phrase: 'Memnun oldum', phonetic: 'mem-NOON ol-DUM', usage: 'Nice to meet you' },
      { phrase: 'Hoşça kalın', phonetic: 'hosh-CHA ka-LUN', usage: 'Goodbye' },
    ],
    tl: [
      { phrase: 'Kumusta', phonetic: 'koo-moos-TA', usage: 'General greeting' },
      { phrase: 'Magandang umaga', phonetic: 'ma-gan-dang oo-MA-ga', usage: 'Good morning' },
      { phrase: 'Kamusta ka?', phonetic: 'ka-moos-TA ka', usage: 'How are you?' },
      { phrase: 'Ikinagagalak kitang makilala', phonetic: 'i-ki-na-ga-GA-lak ki-tang ma-ki-LA-la', usage: 'Nice to meet you' },
      { phrase: 'Paalam', phonetic: 'pa-A-lam', usage: 'Goodbye' },
    ],
  };
  // zh-Hant uses same phrases as zh
  greetings['zh-Hant'] = (greetings['zh'] || []).map(g => ({ ...g }));
  return greetings[targetLang] || greetings['en'];
}

/**
 * Create a greetings lesson for a language pair
 */
function createGreetingsLesson(sourceLang, targetLang) {
  const targetName = LANG_NAMES_EN[targetLang] || targetLang;
  const sourceName = LANG_NAMES[sourceLang] || sourceLang;
  const greetings = getGreetings(targetLang);

  return {
    title: `Basic Greetings in ${targetName}`,
    description: `Learn essential greetings and introductions in ${targetName}. Explanations in ${sourceName}.`,
    language: targetLang,
    sourceLanguage: sourceLang,
    level: 'A1',
    category: 'conversation',
    topic: 'Greetings & Introductions',
    icon: '👋',
    introduction: `Welcome to your first ${targetName} lesson! You'll learn the most common greetings used in everyday conversation.`,
    content: greetings.map((g, i) => ({
      type: 'example',
      title: g.usage,
      body: g.phrase,
      translation: `[${g.phonetic}] — ${g.usage}`,
      order: i,
    })),
    exercises: [
      // Multiple choice
      {
        type: 'multiple_choice',
        question: `How do you say "Hello" in ${targetName}?`,
        options: [
          { text: greetings[0].phrase, isCorrect: true },
          { text: greetings[4].phrase, isCorrect: false },
          { text: greetings[2].phrase, isCorrect: false },
          { text: greetings[1].phrase, isCorrect: false },
        ],
        correctAnswer: greetings[0].phrase,
        hint: greetings[0].phonetic,
        explanation: `"${greetings[0].phrase}" is the standard greeting in ${targetName}.`,
        points: 10,
        order: 0,
      },
      // Matching
      {
        type: 'matching',
        question: 'Match the greetings with their meanings:',
        options: greetings.slice(0, 4).flatMap((g, i) => [
          { text: g.phrase, matchWith: g.usage, isCorrect: true },
        ]),
        correctAnswer: greetings.slice(0, 4).map(g => ({ phrase: g.phrase, meaning: g.usage })),
        explanation: 'Great job matching the greetings!',
        points: 20,
        order: 1,
      },
      // Fill in the blank
      {
        type: 'fill_blank',
        question: `Complete: "___" means "Good morning" in ${targetName}`,
        correctAnswer: greetings[1].phrase,
        acceptedAnswers: [greetings[1].phrase.toLowerCase()],
        hint: `It sounds like: ${greetings[1].phonetic}`,
        explanation: `"${greetings[1].phrase}" (${greetings[1].phonetic}) is used as a morning greeting.`,
        points: 15,
        order: 2,
      },
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 8,
    unit: { number: 1, name: 'Getting Started' },
    orderInUnit: 1,
    tags: ['greetings', 'basics', 'a1', 'conversation'],
    isPublished: true,
    publishedAt: new Date(),
  };
}

/**
 * Create a numbers lesson for a language pair
 */
function createNumbersLesson(sourceLang, targetLang) {
  const targetName = LANG_NAMES_EN[targetLang] || targetLang;
  const sourceName = LANG_NAMES[sourceLang] || sourceLang;

  const numbers = {
    en: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
    ko: ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'],
    ja: ['いち', 'に', 'さん', 'し/よん', 'ご', 'ろく', 'しち/なな', 'はち', 'きゅう', 'じゅう'],
    zh: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'],
    es: ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'],
    fr: ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
    de: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'],
    pt: ['um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
    it: ['uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'],
    ar: ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'],
    hi: ['एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस'],
    ru: ['один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'],
    th: ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ'],
    vi: ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'],
    id: ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'],
    tr: ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'],
    tl: ['isa', 'dalawa', 'tatlo', 'apat', 'lima', 'anim', 'pito', 'walo', 'siyam', 'sampu'],
  };
  numbers['zh-Hant'] = numbers['zh'];

  const targetNums = numbers[targetLang] || numbers['en'];

  return {
    title: `Numbers 1-10 in ${targetName}`,
    description: `Learn to count from 1 to 10 in ${targetName}. Explanations in ${sourceName}.`,
    language: targetLang,
    sourceLanguage: sourceLang,
    level: 'A1',
    category: 'vocabulary',
    topic: 'Numbers',
    icon: '🔢',
    introduction: `Numbers are essential for daily life. Let's learn 1-10 in ${targetName}!`,
    content: targetNums.map((num, i) => ({
      type: 'example',
      title: `${i + 1}`,
      body: num,
      translation: `${i + 1} = ${num}`,
      order: i,
    })),
    exercises: [
      {
        type: 'multiple_choice',
        question: `What is "3" in ${targetName}?`,
        options: [
          { text: targetNums[2], isCorrect: true },
          { text: targetNums[6], isCorrect: false },
          { text: targetNums[0], isCorrect: false },
          { text: targetNums[8], isCorrect: false },
        ],
        correctAnswer: targetNums[2],
        explanation: `3 = "${targetNums[2]}" in ${targetName}.`,
        points: 10,
        order: 0,
      },
      {
        type: 'ordering',
        question: `Put these numbers in order (1, 2, 3, 4, 5):`,
        options: [
          { text: targetNums[2], isCorrect: false },
          { text: targetNums[0], isCorrect: false },
          { text: targetNums[4], isCorrect: false },
          { text: targetNums[3], isCorrect: false },
          { text: targetNums[1], isCorrect: false },
        ],
        correctAnswer: [targetNums[0], targetNums[1], targetNums[2], targetNums[3], targetNums[4]],
        explanation: `The correct order is: ${targetNums.slice(0, 5).join(', ')}`,
        points: 20,
        order: 1,
      },
      {
        type: 'fill_blank',
        question: `What number comes after "${targetNums[4]}" (5)?`,
        correctAnswer: targetNums[5],
        acceptedAnswers: [targetNums[5].toLowerCase?.() || targetNums[5]],
        hint: `It's the number 6 in ${targetName}`,
        explanation: `After ${targetNums[4]} (5) comes ${targetNums[5]} (6).`,
        points: 10,
        order: 2,
      },
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 10,
    unit: { number: 1, name: 'Getting Started' },
    orderInUnit: 2,
    tags: ['numbers', 'basics', 'a1', 'vocabulary'],
    isPublished: true,
    publishedAt: new Date(),
  };
}

/**
 * Create a self-introduction lesson for a language pair
 */
function createSelfIntroLesson(sourceLang, targetLang) {
  const targetName = LANG_NAMES_EN[targetLang] || targetLang;
  const sourceName = LANG_NAMES[sourceLang] || sourceLang;

  const phrases = {
    en: [
      { phrase: 'My name is...', example: 'My name is Alex.', usage: 'Introducing yourself' },
      { phrase: 'I am from...', example: 'I am from Korea.', usage: 'Saying where you are from' },
      { phrase: 'I speak...', example: 'I speak Korean and English.', usage: 'Saying what languages you speak' },
      { phrase: 'I am learning...', example: 'I am learning English.', usage: 'Saying what you are studying' },
    ],
    ko: [
      { phrase: '제 이름은...입니다', example: '제 이름은 Alex입니다.', usage: 'Introducing yourself' },
      { phrase: '저는...에서 왔습니다', example: '저는 미국에서 왔습니다.', usage: 'Saying where you are from' },
      { phrase: '저는...를 할 수 있습니다', example: '저는 영어를 할 수 있습니다.', usage: 'Saying what languages you speak' },
      { phrase: '저는...를 배우고 있습니다', example: '저는 한국어를 배우고 있습니다.', usage: 'Saying what you are studying' },
    ],
    ja: [
      { phrase: '私の名前は...です', example: '私の名前はAlexです。', usage: 'Introducing yourself' },
      { phrase: '...から来ました', example: 'アメリカから来ました。', usage: 'Saying where you are from' },
      { phrase: '...を話します', example: '英語を話します。', usage: 'Saying what languages you speak' },
      { phrase: '...を勉強しています', example: '日本語を勉強しています。', usage: 'Saying what you are studying' },
    ],
    zh: [
      { phrase: '我叫...', example: '我叫Alex。', usage: 'Introducing yourself' },
      { phrase: '我来自...', example: '我来自美国。', usage: 'Saying where you are from' },
      { phrase: '我会说...', example: '我会说英语。', usage: 'Saying what languages you speak' },
      { phrase: '我在学...', example: '我在学中文。', usage: 'Saying what you are studying' },
    ],
    es: [
      { phrase: 'Me llamo...', example: 'Me llamo Alex.', usage: 'Introducing yourself' },
      { phrase: 'Soy de...', example: 'Soy de Estados Unidos.', usage: 'Saying where you are from' },
      { phrase: 'Hablo...', example: 'Hablo inglés y español.', usage: 'Saying what languages you speak' },
      { phrase: 'Estoy aprendiendo...', example: 'Estoy aprendiendo español.', usage: 'Saying what you are studying' },
    ],
    fr: [
      { phrase: 'Je m\'appelle...', example: 'Je m\'appelle Alex.', usage: 'Introducing yourself' },
      { phrase: 'Je viens de...', example: 'Je viens des États-Unis.', usage: 'Saying where you are from' },
      { phrase: 'Je parle...', example: 'Je parle anglais et français.', usage: 'Saying what languages you speak' },
      { phrase: 'J\'apprends...', example: 'J\'apprends le français.', usage: 'Saying what you are studying' },
    ],
    de: [
      { phrase: 'Ich heiße...', example: 'Ich heiße Alex.', usage: 'Introducing yourself' },
      { phrase: 'Ich komme aus...', example: 'Ich komme aus den USA.', usage: 'Saying where you are from' },
      { phrase: 'Ich spreche...', example: 'Ich spreche Englisch und Deutsch.', usage: 'Saying what languages you speak' },
      { phrase: 'Ich lerne...', example: 'Ich lerne Deutsch.', usage: 'Saying what you are studying' },
    ],
  };
  // Fallback for languages not detailed above
  const targetPhrases = phrases[targetLang] || phrases['en'];

  return {
    title: `Self-Introduction in ${targetName}`,
    description: `Learn to introduce yourself in ${targetName}. Explanations in ${sourceName}.`,
    language: targetLang,
    sourceLanguage: sourceLang,
    level: 'A1',
    category: 'conversation',
    topic: 'Self-Introduction',
    icon: '🙋',
    introduction: `Being able to introduce yourself is one of the first things you need in any language. Let's learn how to do it in ${targetName}!`,
    content: targetPhrases.map((p, i) => ({
      type: 'example',
      title: p.usage,
      body: `${p.phrase}\n${p.example}`,
      translation: p.usage,
      order: i,
    })),
    exercises: [
      {
        type: 'multiple_choice',
        question: `Which phrase means "My name is..." in ${targetName}?`,
        options: [
          { text: targetPhrases[0].phrase, isCorrect: true },
          { text: targetPhrases[1].phrase, isCorrect: false },
          { text: targetPhrases[2].phrase, isCorrect: false },
          { text: targetPhrases[3].phrase, isCorrect: false },
        ],
        correctAnswer: targetPhrases[0].phrase,
        explanation: `"${targetPhrases[0].phrase}" is how you say "My name is..." in ${targetName}.`,
        points: 10,
        order: 0,
      },
      {
        type: 'translation',
        question: 'Translate: "I am learning ' + targetName + '"',
        correctAnswer: targetPhrases[3].example,
        acceptedAnswers: [targetPhrases[3].phrase, targetPhrases[3].example],
        hint: targetPhrases[3].phrase,
        explanation: `"${targetPhrases[3].example}" means "I am learning ${targetName}."`,
        points: 15,
        order: 1,
      },
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 10,
    unit: { number: 1, name: 'Getting Started' },
    orderInUnit: 3,
    tags: ['introduction', 'basics', 'a1', 'conversation'],
    isPublished: true,
    publishedAt: new Date(),
  };
}

async function main() {
  console.log('🌐 BananaTalk Language-Pair Lesson Seeder');
  console.log('=========================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN — no changes will be written to database\n');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  let pairs = PRIORITY_PAIRS;
  if (specificPair) {
    const [src, tgt] = specificPair.split(':');
    pairs = [[src, tgt]];
    console.log(`📌 Seeding only pair: ${src} → ${tgt}\n`);
  }

  let created = 0;
  let skipped = 0;

  for (const [sourceLang, targetLang] of pairs) {
    console.log(`\n📝 ${LANG_NAMES_EN[sourceLang] || sourceLang} → ${LANG_NAMES_EN[targetLang] || targetLang}`);

    const lessons = [
      createGreetingsLesson(sourceLang, targetLang),
      createNumbersLesson(sourceLang, targetLang),
      createSelfIntroLesson(sourceLang, targetLang),
    ];

    for (const lessonData of lessons) {
      // Check if a similar lesson already exists for this pair
      const existing = await Lesson.findOne({
        language: targetLang,
        sourceLanguage: sourceLang,
        topic: lessonData.topic,
        level: 'A1',
      });

      if (existing) {
        console.log(`   ⏭️  Skip "${lessonData.title}" (already exists)`);
        skipped++;
        continue;
      }

      if (isDryRun) {
        console.log(`   📋 Would create: "${lessonData.title}"`);
        created++;
      } else {
        try {
          const lesson = await Lesson.create(lessonData);
          console.log(`   ✅ Created: "${lesson.title}" (${lesson._id})`);
          created++;
        } catch (err) {
          console.log(`   ❌ Error creating "${lessonData.title}": ${err.message}`);
        }
      }
    }
  }

  console.log('\n=========================================');
  console.log(`✅ Done! Created: ${created}, Skipped: ${skipped}`);
  console.log(`📊 Total pairs processed: ${pairs.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
