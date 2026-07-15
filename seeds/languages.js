/**
 * Language Seed Data
 * Complete list of languages for Bananatalk language exchange app
 *
 * Run: node seeds/languages.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './config/config.env' });

const Language = require('../models/Language');

// Comprehensive language list with native names and flags
const languages = [
  // === MOST POPULAR / YOUR USER BASE ===
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', flag: '🇵🇭' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },

  // === EAST ASIAN ===
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာဘာသာ', flag: '🇲🇲' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭' },
  { code: 'lo', name: 'Lao', nativeName: 'ພາສາລາວ', flag: '🇱🇦' },

  // === SOUTH ASIAN ===
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰' },

  // === EUROPEAN ===
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español (México)', flag: '🇲🇽' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'fr-CA', name: 'French (Canada)', nativeName: 'Français (Canada)', flag: '🇨🇦' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },

  // === ENGLISH VARIANTS ===
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧' },

  // === MORE EAST ASIAN ===
  { code: 'zh-HK', name: 'Cantonese', nativeName: '粵語', flag: '🇭🇰' },

  // === MORE SOUTH ASIAN ===
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', flag: '🇮🇳' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', flag: '🇵🇰' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر', flag: '🇮🇳' },
  { code: 'dv', name: 'Dhivehi', nativeName: 'ދިވެހި', flag: '🇲🇻' },

  // === MIDDLE EAST & AFRICA ===
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', flag: '🇦🇫' },
  { code: 'prs', name: 'Dari', nativeName: 'دری', flag: '🇦🇫' },
  { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî', flag: '🇮🇶' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹' },
  { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ', flag: '🇪🇷' },
  { code: 'om', name: 'Oromo', nativeName: 'Afaan Oromoo', flag: '🇪🇹' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', flag: '🇸🇴' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', flag: '🇿🇦' },
  { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', flag: '🇱🇸' },
  { code: 'tn', name: 'Setswana', nativeName: 'Setswana', flag: '🇧🇼' },
  { code: 'sn', name: 'Shona', nativeName: 'chiShona', flag: '🇿🇼' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda', flag: '🇷🇼' },
  { code: 'lg', name: 'Luganda', nativeName: 'Oluganda', flag: '🇺🇬' },
  { code: 'ny', name: 'Chichewa', nativeName: 'Chichewa', flag: '🇲🇼' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy', flag: '🇲🇬' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', flag: '🇳🇬' },
  { code: 'wo', name: 'Wolof', nativeName: 'Wolof', flag: '🇸🇳' },
  { code: 'ff', name: 'Fula', nativeName: 'Fulfulde', flag: '🇸🇳' },

  // === CENTRAL ASIAN ===
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча', flag: '🇰🇬' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ', flag: '🇹🇯' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Türkmençe', flag: '🇹🇲' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', flag: '🇲🇳' },

  // === CAUCASUS ===
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', flag: '🇬🇪' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', flag: '🇦🇲' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycanca', flag: '🇦🇿' },

  // === MORE EUROPEAN — SLAVIC ===
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', flag: '🇧🇦' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', flag: '🇲🇰' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская', flag: '🇧🇾' },

  // === MORE EUROPEAN — BALTIC ===
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹' },

  // === MORE EUROPEAN — ROMANCE / GERMANIC / CELTIC / OTHER ===
  { code: 'ca', name: 'Catalan', nativeName: 'Català', flag: '🇪🇸' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego', flag: '🇪🇸' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', flag: '🇪🇸' },
  { code: 'oc', name: 'Occitan', nativeName: 'Occitan', flag: '🇫🇷' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', flag: '🇮🇸' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch', flag: '🇱🇺' },
  { code: 'fy', name: 'Frisian', nativeName: 'Frysk', flag: '🇳🇱' },
  { code: 'fo', name: 'Faroese', nativeName: 'Føroyskt', flag: '🇫🇴' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', flag: '🇮🇪' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { code: 'gd', name: 'Scottish Gaelic', nativeName: 'Gàidhlig', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { code: 'br', name: 'Breton', nativeName: 'Brezhoneg', flag: '🇫🇷' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti', flag: '🇲🇹' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', flag: '🇦🇱' },

  // === PACIFIC / OCEANIA ===
  { code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori', flag: '🇳🇿' },
  { code: 'sm', name: 'Samoan', nativeName: 'Gagana Samoa', flag: '🇼🇸' },
  { code: 'to', name: 'Tongan', nativeName: 'Lea Faka-Tonga', flag: '🇹🇴' },
  { code: 'fj', name: 'Fijian', nativeName: 'Vosa Vakaviti', flag: '🇫🇯' },
  { code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi', flag: '🇺🇸' },

  // === AMERICAS — INDIGENOUS & CREOLE ===
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', flag: '🇭🇹' },
  { code: 'qu', name: 'Quechua', nativeName: 'Runa Simi', flag: '🇵🇪' },
  { code: 'gn', name: 'Guarani', nativeName: 'Avañeʼẽ', flag: '🇵🇾' },

  // === CONSTRUCTED / CLASSICAL ===
  { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto', flag: '🌐' },
  { code: 'la', name: 'Latin', nativeName: 'Latina', flag: '🏛️' },

  // === SIGN LANGUAGES ===
  { code: 'ase', name: 'American Sign Language', nativeName: 'ASL', flag: '🤟' },
  { code: 'bfi', name: 'British Sign Language', nativeName: 'BSL', flag: '🤟' },
  { code: 'jsl', name: 'Japanese Sign Language', nativeName: '日本手話', flag: '🤟' },
  { code: 'kvk', name: 'Korean Sign Language', nativeName: '한국 수어', flag: '🤟' },
];

const seedLanguages = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    // Clear existing languages
    await Language.deleteMany({});
    console.log('🗑️  Cleared existing languages');

    // Insert new languages (use .create to trigger pre-save hooks for slugify)
    const result = await Language.create(languages);
    console.log(`✅ Inserted ${result.length} languages`);

    // List them
    console.log('\n📋 Languages added:');
    languages.forEach(lang => {
      console.log(`   ${lang.flag} ${lang.code}: ${lang.name} (${lang.nativeName})`);
    });

    console.log('\n✅ Language seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding languages:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedLanguages();
}

module.exports = { languages, seedLanguages };
