/**
 * Lesson Seeds
 * Run with: node seeds/lessons.js
 *
 * Creates sample lessons for multiple languages at different CEFR levels
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config/config.env' });

const Lesson = require('../models/Lesson');

/**
 * Generate slug from title and language
 */
const generateSlug = (title, language) => {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${language}`;
};

// ===================== ENGLISH LESSONS (for learners) =====================
const englishLessons = [
  // A1 - Beginner Level
  {
    title: 'Greetings and Introductions',
    description: 'Learn basic greetings and how to introduce yourself in English',
    language: 'en',
    level: 'A1',
    category: 'conversation',
    topic: 'Greetings',
    icon: '👋',
    introduction: 'In this lesson, you will learn common English greetings and how to introduce yourself. These are essential phrases for starting conversations with native speakers.',
    content: [
      {
        type: 'text',
        title: 'Common Greetings',
        body: 'Here are the most common ways to greet someone in English:\n\n• Hello - A standard greeting, used anytime\n• Hi - Informal, friendly greeting\n• Good morning - Used before noon\n• Good afternoon - Used between noon and evening\n• Good evening - Used in the evening',
        order: 1
      },
      {
        type: 'example',
        title: 'Introducing Yourself',
        body: 'My name is John. Nice to meet you!',
        translation: '(Adapt to your native language)',
        order: 2
      },
      {
        type: 'tip',
        title: 'Cultural Note',
        body: 'In English-speaking countries, people often shake hands when meeting someone for the first time. Make eye contact and smile!',
        order: 3
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'What is the best greeting to use at 10 AM?',
        options: [
          { text: 'Good evening', isCorrect: false },
          { text: 'Good morning', isCorrect: true },
          { text: 'Good night', isCorrect: false },
          { text: 'Goodbye', isCorrect: false }
        ],
        correctAnswer: 'Good morning',
        explanation: 'Good morning is used before noon (12 PM).',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'Complete: "_____ to meet you!"',
        correctAnswer: 'Nice',
        acceptedAnswers: ['nice', 'Nice', 'NICE'],
        hint: 'This is a polite phrase used when meeting someone.',
        explanation: '"Nice to meet you" is the standard polite response when being introduced.',
        points: 10,
        order: 2
      },
      {
        type: 'multiple_choice',
        question: 'Which greeting is most informal?',
        options: [
          { text: 'Good afternoon', isCorrect: false },
          { text: 'Hello', isCorrect: false },
          { text: 'Hi', isCorrect: true },
          { text: 'Good evening', isCorrect: false }
        ],
        correctAnswer: 'Hi',
        explanation: '"Hi" is the most casual and informal greeting in English.',
        points: 10,
        order: 3
      },
      {
        type: 'ordering',
        question: 'Put these words in the correct order: "is / My / Sarah / name"',
        correctAnswer: ['My', 'name', 'is', 'Sarah'],
        explanation: 'The correct sentence is: "My name is Sarah."',
        points: 15,
        order: 4
      },
      {
        type: 'translation',
        question: 'How do you say "Hello, my name is..." in English?',
        correctAnswer: 'Hello, my name is',
        acceptedAnswers: ['Hello, my name is', 'Hi, my name is', 'Hello my name is'],
        explanation: 'This is the basic way to introduce yourself.',
        points: 15,
        order: 5
      }
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 10,
    unit: { number: 1, name: 'Getting Started' },
    orderInUnit: 1,
    tags: ['greetings', 'introductions', 'basics'],
    isPublished: true
  },
  {
    title: 'Numbers 1-20',
    description: 'Learn to count from 1 to 20 in English',
    language: 'en',
    level: 'A1',
    category: 'vocabulary',
    topic: 'Numbers',
    icon: '🔢',
    introduction: 'Numbers are essential for everyday conversations. In this lesson, you will learn numbers from 1 to 20.',
    content: [
      {
        type: 'text',
        title: 'Numbers 1-10',
        body: '1 - one\n2 - two\n3 - three\n4 - four\n5 - five\n6 - six\n7 - seven\n8 - eight\n9 - nine\n10 - ten',
        order: 1
      },
      {
        type: 'text',
        title: 'Numbers 11-20',
        body: '11 - eleven\n12 - twelve\n13 - thirteen\n14 - fourteen\n15 - fifteen\n16 - sixteen\n17 - seventeen\n18 - eighteen\n19 - nineteen\n20 - twenty',
        order: 2
      },
      {
        type: 'tip',
        title: 'Pattern Alert',
        body: 'Notice that numbers 13-19 all end in "-teen". This comes from "ten" - they mean "three and ten", "four and ten", etc.',
        order: 3
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'What is "7" in English?',
        options: [
          { text: 'six', isCorrect: false },
          { text: 'seven', isCorrect: true },
          { text: 'eight', isCorrect: false },
          { text: 'five', isCorrect: false }
        ],
        correctAnswer: 'seven',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'Complete: 10, 11, 12, _____',
        correctAnswer: 'thirteen',
        acceptedAnswers: ['thirteen', 'Thirteen', '13'],
        points: 10,
        order: 2
      },
      {
        type: 'typing',
        question: 'Type the number "15" in words:',
        correctAnswer: 'fifteen',
        acceptedAnswers: ['fifteen', 'Fifteen', 'FIFTEEN'],
        points: 10,
        order: 3
      },
      {
        type: 'multiple_choice',
        question: 'Which number is "twelve"?',
        options: [
          { text: '11', isCorrect: false },
          { text: '12', isCorrect: true },
          { text: '20', isCorrect: false },
          { text: '2', isCorrect: false }
        ],
        correctAnswer: '12',
        points: 10,
        order: 4
      },
      {
        type: 'fill_blank',
        question: 'What comes after nineteen? _____',
        correctAnswer: 'twenty',
        acceptedAnswers: ['twenty', 'Twenty', '20'],
        points: 10,
        order: 5
      }
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 8,
    unit: { number: 1, name: 'Getting Started' },
    orderInUnit: 2,
    tags: ['numbers', 'counting', 'basics'],
    isPublished: true
  },
  {
    title: 'Days of the Week',
    description: 'Learn the seven days of the week in English',
    language: 'en',
    level: 'A1',
    category: 'vocabulary',
    topic: 'Time and Dates',
    icon: '📅',
    introduction: 'Knowing the days of the week is essential for making plans and understanding schedules.',
    content: [
      {
        type: 'text',
        title: 'The Seven Days',
        body: '• Monday (Mon) - First day of the work week\n• Tuesday (Tue)\n• Wednesday (Wed) - Middle of the week\n• Thursday (Thu)\n• Friday (Fri) - End of the work week\n• Saturday (Sat) - Weekend\n• Sunday (Sun) - Weekend',
        order: 1
      },
      {
        type: 'tip',
        title: 'Remember',
        body: 'In English, days of the week always start with a capital letter!',
        order: 2
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'What day comes after Wednesday?',
        options: [
          { text: 'Tuesday', isCorrect: false },
          { text: 'Thursday', isCorrect: true },
          { text: 'Friday', isCorrect: false },
          { text: 'Monday', isCorrect: false }
        ],
        correctAnswer: 'Thursday',
        points: 10,
        order: 1
      },
      {
        type: 'ordering',
        question: 'Put in order: Friday, Monday, Wednesday',
        correctAnswer: ['Monday', 'Wednesday', 'Friday'],
        points: 15,
        order: 2
      },
      {
        type: 'fill_blank',
        question: 'The weekend days are Saturday and _____.',
        correctAnswer: 'Sunday',
        acceptedAnswers: ['Sunday', 'sunday'],
        points: 10,
        order: 3
      },
      {
        type: 'multiple_choice',
        question: 'Which day starts the work week?',
        options: [
          { text: 'Sunday', isCorrect: false },
          { text: 'Monday', isCorrect: true },
          { text: 'Saturday', isCorrect: false },
          { text: 'Friday', isCorrect: false }
        ],
        correctAnswer: 'Monday',
        points: 10,
        order: 4
      }
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 8,
    unit: { number: 1, name: 'Getting Started' },
    orderInUnit: 3,
    tags: ['days', 'week', 'time'],
    isPublished: true
  },

  // A2 - Elementary Level
  {
    title: 'Present Simple Tense',
    description: 'Learn how to use the present simple tense for habits and facts',
    language: 'en',
    level: 'A2',
    category: 'grammar',
    topic: 'Verb Tenses',
    icon: '📝',
    introduction: 'The present simple tense is used to describe habits, routines, and general facts. It\'s one of the most important tenses in English.',
    content: [
      {
        type: 'text',
        title: 'When to Use Present Simple',
        body: 'Use present simple for:\n\n1. Habits and routines: "I wake up at 7 AM every day."\n2. Facts: "Water boils at 100°C."\n3. Permanent situations: "She lives in Tokyo."\n4. Schedules: "The train leaves at 9 PM."',
        order: 1
      },
      {
        type: 'text',
        title: 'How to Form It',
        body: 'Subject + Base Verb (+ s/es for he/she/it)\n\nExamples:\n• I work → He works\n• You play → She plays\n• They go → It goes\n\nNote: Add -es for verbs ending in -s, -sh, -ch, -x, -o:\n• watch → watches\n• go → goes',
        order: 2
      },
      {
        type: 'example',
        title: 'Negative Form',
        body: 'Subject + do/does + not + base verb\n\n• I do not (don\'t) like coffee.\n• She does not (doesn\'t) work on Sundays.',
        order: 3
      }
    ],
    exercises: [
      {
        type: 'fill_blank',
        question: 'She _____ to school every day. (go)',
        correctAnswer: 'goes',
        acceptedAnswers: ['goes', 'Goes'],
        explanation: 'For he/she/it, we add -es to verbs ending in -o.',
        points: 10,
        order: 1
      },
      {
        type: 'multiple_choice',
        question: 'Which sentence is correct?',
        options: [
          { text: 'He play tennis.', isCorrect: false },
          { text: 'He plays tennis.', isCorrect: true },
          { text: 'He playing tennis.', isCorrect: false },
          { text: 'He playes tennis.', isCorrect: false }
        ],
        correctAnswer: 'He plays tennis.',
        points: 10,
        order: 2
      },
      {
        type: 'fill_blank',
        question: 'They _____ coffee in the morning. (drink)',
        correctAnswer: 'drink',
        acceptedAnswers: ['drink', 'Drink'],
        explanation: 'For they/we/I/you, use the base form without -s.',
        points: 10,
        order: 3
      },
      {
        type: 'multiple_choice',
        question: 'Make this negative: "She likes pizza."',
        options: [
          { text: 'She not likes pizza.', isCorrect: false },
          { text: 'She doesn\'t like pizza.', isCorrect: true },
          { text: 'She don\'t like pizza.', isCorrect: false },
          { text: 'She doesn\'t likes pizza.', isCorrect: false }
        ],
        correctAnswer: 'She doesn\'t like pizza.',
        points: 15,
        order: 4
      },
      {
        type: 'fill_blank',
        question: 'My brother _____ (watch) TV every evening.',
        correctAnswer: 'watches',
        acceptedAnswers: ['watches', 'Watches'],
        points: 10,
        order: 5
      }
    ],
    xpReward: 25,
    perfectBonus: 5,
    estimatedMinutes: 15,
    unit: { number: 2, name: 'Grammar Foundations' },
    orderInUnit: 1,
    tags: ['grammar', 'present tense', 'verbs'],
    isPublished: true
  },

  // B1 - Intermediate Level
  {
    title: 'Conditionals: First and Second',
    description: 'Master real and unreal conditional sentences',
    language: 'en',
    level: 'B1',
    category: 'grammar',
    topic: 'Conditionals',
    icon: '🔀',
    introduction: 'Conditionals are sentences with "if" that describe possible situations and their results. They\'re essential for expressing possibilities, giving advice, and talking about hypothetical situations.',
    content: [
      {
        type: 'text',
        title: 'First Conditional (Real/Possible)',
        body: 'Structure: If + present simple, will + base verb\n\nUse for: Real possibilities in the future\n\nExamples:\n• If it rains, I will take an umbrella.\n• If you study hard, you will pass the exam.\n• If she calls, I\'ll tell her the news.',
        order: 1
      },
      {
        type: 'text',
        title: 'Second Conditional (Unreal/Hypothetical)',
        body: 'Structure: If + past simple, would + base verb\n\nUse for: Unreal or unlikely situations\n\nExamples:\n• If I won the lottery, I would travel the world.\n• If she spoke French, she would move to Paris.\n• If I were you, I would accept the job.',
        order: 2
      },
      {
        type: 'tip',
        title: 'Important Note',
        body: 'In formal English, we use "were" for all subjects in the second conditional:\n• If I were rich... (not "If I was rich...")\n• If he were here... (not "If he was here...")',
        order: 3
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'Complete: "If I _____ more money, I would buy a new car."',
        options: [
          { text: 'have', isCorrect: false },
          { text: 'had', isCorrect: true },
          { text: 'will have', isCorrect: false },
          { text: 'would have', isCorrect: false }
        ],
        correctAnswer: 'had',
        explanation: 'Second conditional uses past simple in the if-clause.',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'If it snows tomorrow, we _____ (go) skiing.',
        correctAnswer: 'will go',
        acceptedAnswers: ['will go', "will go", "'ll go"],
        explanation: 'First conditional: real possibility, so we use will + base verb.',
        points: 10,
        order: 2
      },
      {
        type: 'multiple_choice',
        question: 'Which conditional is used for unlikely situations?',
        options: [
          { text: 'Zero conditional', isCorrect: false },
          { text: 'First conditional', isCorrect: false },
          { text: 'Second conditional', isCorrect: true },
          { text: 'All of them', isCorrect: false }
        ],
        correctAnswer: 'Second conditional',
        points: 10,
        order: 3
      },
      {
        type: 'fill_blank',
        question: 'If I _____ (be) you, I would apologize.',
        correctAnswer: 'were',
        acceptedAnswers: ['were', 'Was', 'was'],
        explanation: 'We use "were" for all subjects in second conditional.',
        points: 15,
        order: 4
      },
      {
        type: 'multiple_choice',
        question: 'Choose the correct sentence:',
        options: [
          { text: 'If I will see him, I tell him.', isCorrect: false },
          { text: 'If I see him, I will tell him.', isCorrect: true },
          { text: 'If I saw him, I will tell him.', isCorrect: false },
          { text: 'If I see him, I told him.', isCorrect: false }
        ],
        correctAnswer: 'If I see him, I will tell him.',
        points: 15,
        order: 5
      }
    ],
    xpReward: 30,
    perfectBonus: 10,
    estimatedMinutes: 20,
    unit: { number: 3, name: 'Advanced Grammar' },
    orderInUnit: 1,
    tags: ['grammar', 'conditionals', 'intermediate'],
    isPublished: true
  }
];

// ===================== SPANISH LESSONS (for learners) =====================
const spanishLessons = [
  {
    title: 'Saludos y Presentaciones',
    description: 'Learn basic Spanish greetings and introductions',
    language: 'es',
    level: 'A1',
    category: 'conversation',
    topic: 'Greetings',
    icon: '👋',
    introduction: 'In this lesson, you will learn common Spanish greetings and how to introduce yourself.',
    content: [
      {
        type: 'text',
        title: 'Common Greetings',
        body: '• Hola - Hello (informal)\n• Buenos días - Good morning\n• Buenas tardes - Good afternoon\n• Buenas noches - Good evening/night\n• ¿Qué tal? - How are you? (informal)\n• ¿Cómo está usted? - How are you? (formal)',
        order: 1
      },
      {
        type: 'example',
        title: 'Introducing Yourself',
        body: 'Me llamo María. Mucho gusto.',
        translation: 'My name is María. Nice to meet you.',
        order: 2
      },
      {
        type: 'tip',
        title: 'Formal vs Informal',
        body: 'Spanish has two forms of "you": "tú" (informal) and "usted" (formal). Use "usted" with older people, strangers, or in professional settings.',
        order: 3
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'What does "Buenos días" mean?',
        options: [
          { text: 'Good night', isCorrect: false },
          { text: 'Good morning', isCorrect: true },
          { text: 'Goodbye', isCorrect: false },
          { text: 'Good afternoon', isCorrect: false }
        ],
        correctAnswer: 'Good morning',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'Complete: "Me _____ Juan." (My name is Juan)',
        correctAnswer: 'llamo',
        acceptedAnswers: ['llamo', 'Llamo'],
        points: 10,
        order: 2
      },
      {
        type: 'multiple_choice',
        question: 'Which greeting is informal?',
        options: [
          { text: '¿Cómo está usted?', isCorrect: false },
          { text: 'Buenos días', isCorrect: false },
          { text: '¿Qué tal?', isCorrect: true },
          { text: 'Buenas noches', isCorrect: false }
        ],
        correctAnswer: '¿Qué tal?',
        points: 10,
        order: 3
      },
      {
        type: 'translation',
        question: 'How do you say "Nice to meet you" in Spanish?',
        correctAnswer: 'Mucho gusto',
        acceptedAnswers: ['Mucho gusto', 'mucho gusto', 'Encantado', 'Encantada'],
        points: 15,
        order: 4
      }
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 10,
    unit: { number: 1, name: 'Primeros Pasos' },
    orderInUnit: 1,
    tags: ['greetings', 'introductions', 'basics'],
    isPublished: true
  },
  {
    title: 'Los Números del 1 al 20',
    description: 'Learn to count from 1 to 20 in Spanish',
    language: 'es',
    level: 'A1',
    category: 'vocabulary',
    topic: 'Numbers',
    icon: '🔢',
    introduction: 'Numbers are essential for everyday conversations. Let\'s learn 1-20 in Spanish.',
    content: [
      {
        type: 'text',
        title: 'Numbers 1-10',
        body: '1 - uno\n2 - dos\n3 - tres\n4 - cuatro\n5 - cinco\n6 - seis\n7 - siete\n8 - ocho\n9 - nueve\n10 - diez',
        order: 1
      },
      {
        type: 'text',
        title: 'Numbers 11-20',
        body: '11 - once\n12 - doce\n13 - trece\n14 - catorce\n15 - quince\n16 - dieciséis\n17 - diecisiete\n18 - dieciocho\n19 - diecinueve\n20 - veinte',
        order: 2
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'What is "siete" in English?',
        options: [
          { text: 'six', isCorrect: false },
          { text: 'seven', isCorrect: true },
          { text: 'eight', isCorrect: false },
          { text: 'nine', isCorrect: false }
        ],
        correctAnswer: 'seven',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'Complete: diez, once, _____',
        correctAnswer: 'doce',
        acceptedAnswers: ['doce', 'Doce'],
        points: 10,
        order: 2
      },
      {
        type: 'typing',
        question: 'Type "15" in Spanish:',
        correctAnswer: 'quince',
        acceptedAnswers: ['quince', 'Quince'],
        points: 10,
        order: 3
      },
      {
        type: 'multiple_choice',
        question: 'Which is "twenty"?',
        options: [
          { text: 'doce', isCorrect: false },
          { text: 'quince', isCorrect: false },
          { text: 'veinte', isCorrect: true },
          { text: 'trece', isCorrect: false }
        ],
        correctAnswer: 'veinte',
        points: 10,
        order: 4
      }
    ],
    xpReward: 20,
    perfectBonus: 5,
    estimatedMinutes: 8,
    unit: { number: 1, name: 'Primeros Pasos' },
    orderInUnit: 2,
    tags: ['numbers', 'counting', 'basics'],
    isPublished: true
  }
];

// ===================== JAPANESE LESSONS (for learners) =====================
const japaneseLessons = [
  {
    title: 'Hiragana: A-O Row',
    description: 'Learn the first five hiragana characters',
    language: 'ja',
    level: 'A1',
    category: 'writing',
    topic: 'Hiragana',
    icon: 'あ',
    introduction: 'Hiragana is one of the Japanese writing systems. Let\'s start with the first five characters!',
    content: [
      {
        type: 'text',
        title: 'The A-O Row',
        body: 'あ (a) - Like "a" in "father"\nい (i) - Like "ee" in "see"\nう (u) - Like "oo" in "food"\nえ (e) - Like "e" in "bed"\nお (o) - Like "o" in "go"',
        order: 1
      },
      {
        type: 'tip',
        title: 'Writing Tips',
        body: 'Stroke order matters in Japanese! Always write from left to right and top to bottom.',
        order: 2
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'Which hiragana character is "a"?',
        options: [
          { text: 'い', isCorrect: false },
          { text: 'あ', isCorrect: true },
          { text: 'う', isCorrect: false },
          { text: 'え', isCorrect: false }
        ],
        correctAnswer: 'あ',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'What sound does お make?',
        correctAnswer: 'o',
        acceptedAnswers: ['o', 'O', 'oh'],
        points: 10,
        order: 2
      },
      {
        type: 'matching',
        question: 'Match the hiragana with their sounds',
        options: [
          { text: 'あ', matchWith: 'a' },
          { text: 'い', matchWith: 'i' },
          { text: 'う', matchWith: 'u' }
        ],
        correctAnswer: [['あ', 'a'], ['い', 'i'], ['う', 'u']],
        points: 15,
        order: 3
      }
    ],
    xpReward: 25,
    perfectBonus: 5,
    estimatedMinutes: 15,
    unit: { number: 1, name: 'Japanese Writing' },
    orderInUnit: 1,
    tags: ['hiragana', 'writing', 'basics'],
    isPublished: true
  },
  {
    title: 'Basic Greetings in Japanese',
    description: 'Learn essential Japanese greetings',
    language: 'ja',
    level: 'A1',
    category: 'conversation',
    topic: 'Greetings',
    icon: '🙇',
    introduction: 'Japanese greetings are an important part of the culture. Let\'s learn the basics!',
    content: [
      {
        type: 'text',
        title: 'Daily Greetings',
        body: '• おはようございます (Ohayou gozaimasu) - Good morning (polite)\n• こんにちは (Konnichiwa) - Hello/Good afternoon\n• こんばんは (Konbanwa) - Good evening\n• おやすみなさい (Oyasuminasai) - Good night',
        order: 1
      },
      {
        type: 'text',
        title: 'Meeting People',
        body: '• はじめまして (Hajimemashite) - Nice to meet you\n• よろしくお願いします (Yoroshiku onegaishimasu) - Please treat me well\n• 私は～です (Watashi wa ~ desu) - I am ~',
        order: 2
      },
      {
        type: 'tip',
        title: 'Cultural Note',
        body: 'Japanese people often bow when greeting. The deeper the bow, the more respect shown.',
        order: 3
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'What does "こんにちは" mean?',
        options: [
          { text: 'Good morning', isCorrect: false },
          { text: 'Hello/Good afternoon', isCorrect: true },
          { text: 'Good night', isCorrect: false },
          { text: 'Goodbye', isCorrect: false }
        ],
        correctAnswer: 'Hello/Good afternoon',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'Complete: はじめまして。私は田中___。(I am Tanaka)',
        correctAnswer: 'です',
        acceptedAnswers: ['です', 'desu'],
        points: 10,
        order: 2
      },
      {
        type: 'multiple_choice',
        question: 'Which greeting is used in the morning?',
        options: [
          { text: 'こんばんは', isCorrect: false },
          { text: 'こんにちは', isCorrect: false },
          { text: 'おはようございます', isCorrect: true },
          { text: 'おやすみなさい', isCorrect: false }
        ],
        correctAnswer: 'おはようございます',
        points: 10,
        order: 3
      }
    ],
    xpReward: 25,
    perfectBonus: 5,
    estimatedMinutes: 12,
    unit: { number: 1, name: 'Japanese Writing' },
    orderInUnit: 2,
    tags: ['greetings', 'conversation', 'basics'],
    isPublished: true
  }
];

// ===================== KOREAN LESSONS (for learners) =====================
const koreanLessons = [
  {
    title: 'Hangul Basics: Vowels',
    description: 'Learn the basic Korean vowels',
    language: 'ko',
    level: 'A1',
    category: 'writing',
    topic: 'Hangul',
    icon: 'ㅏ',
    introduction: 'Hangul is the Korean alphabet. It\'s considered one of the most scientific writing systems in the world!',
    content: [
      {
        type: 'text',
        title: 'Basic Vowels',
        body: 'ㅏ (a) - Like "a" in "father"\nㅓ (eo) - Like "u" in "sun"\nㅗ (o) - Like "o" in "go"\nㅜ (u) - Like "oo" in "food"\nㅡ (eu) - No English equivalent, smile and say "oo"\nㅣ (i) - Like "ee" in "see"',
        order: 1
      },
      {
        type: 'tip',
        title: 'Fun Fact',
        body: 'Hangul was created by King Sejong the Great in 1443. It was designed to be easy to learn!',
        order: 2
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'Which vowel sounds like "a" in "father"?',
        options: [
          { text: 'ㅓ', isCorrect: false },
          { text: 'ㅏ', isCorrect: true },
          { text: 'ㅗ', isCorrect: false },
          { text: 'ㅜ', isCorrect: false }
        ],
        correctAnswer: 'ㅏ',
        points: 10,
        order: 1
      },
      {
        type: 'fill_blank',
        question: 'What sound does ㅣ make?',
        correctAnswer: 'i',
        acceptedAnswers: ['i', 'ee', 'I'],
        points: 10,
        order: 2
      },
      {
        type: 'multiple_choice',
        question: 'Which vowel has no English equivalent?',
        options: [
          { text: 'ㅏ', isCorrect: false },
          { text: 'ㅡ', isCorrect: true },
          { text: 'ㅣ', isCorrect: false },
          { text: 'ㅗ', isCorrect: false }
        ],
        correctAnswer: 'ㅡ',
        points: 15,
        order: 3
      }
    ],
    xpReward: 25,
    perfectBonus: 5,
    estimatedMinutes: 12,
    unit: { number: 1, name: 'Korean Alphabet' },
    orderInUnit: 1,
    tags: ['hangul', 'writing', 'basics', 'vowels'],
    isPublished: true
  },
  {
    title: 'Basic Korean Greetings',
    description: 'Learn essential Korean greetings',
    language: 'ko',
    level: 'A1',
    category: 'conversation',
    topic: 'Greetings',
    icon: '🙋',
    introduction: 'Korean greetings depend on politeness levels. Let\'s learn the polite forms first!',
    content: [
      {
        type: 'text',
        title: 'Essential Greetings',
        body: '• 안녕하세요 (Annyeonghaseyo) - Hello (polite)\n• 감사합니다 (Gamsahamnida) - Thank you (formal)\n• 죄송합니다 (Joesonghamnida) - I\'m sorry (formal)\n• 안녕히 가세요 (Annyeonghi gaseyo) - Goodbye (to someone leaving)\n• 안녕히 계세요 (Annyeonghi gyeseyo) - Goodbye (to someone staying)',
        order: 1
      },
      {
        type: 'tip',
        title: 'Cultural Note',
        body: 'In Korean, there are two "goodbyes" depending on who is leaving. This shows Korean\'s attention to social context!',
        order: 2
      }
    ],
    exercises: [
      {
        type: 'multiple_choice',
        question: 'What does "안녕하세요" mean?',
        options: [
          { text: 'Goodbye', isCorrect: false },
          { text: 'Thank you', isCorrect: false },
          { text: 'Hello', isCorrect: true },
          { text: 'Sorry', isCorrect: false }
        ],
        correctAnswer: 'Hello',
        points: 10,
        order: 1
      },
      {
        type: 'multiple_choice',
        question: 'Which phrase means "Thank you"?',
        options: [
          { text: '안녕하세요', isCorrect: false },
          { text: '감사합니다', isCorrect: true },
          { text: '죄송합니다', isCorrect: false },
          { text: '안녕히 가세요', isCorrect: false }
        ],
        correctAnswer: '감사합니다',
        points: 10,
        order: 2
      },
      {
        type: 'fill_blank',
        question: 'To say goodbye to someone who is leaving, say: 안녕히 _____',
        correctAnswer: '가세요',
        acceptedAnswers: ['가세요', 'gaseyo'],
        points: 15,
        order: 3
      }
    ],
    xpReward: 25,
    perfectBonus: 5,
    estimatedMinutes: 12,
    unit: { number: 1, name: 'Korean Alphabet' },
    orderInUnit: 2,
    tags: ['greetings', 'conversation', 'basics'],
    isPublished: true
  }
];

// Combine all lessons
const allLessons = [
  ...englishLessons,
  ...spanishLessons,
  ...japaneseLessons,
  ...koreanLessons
];

const seedLessons = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing lessons
    await Lesson.deleteMany({});
    console.log('Cleared existing lessons');

    // Add slugs to all lessons (insertMany bypasses pre-save hooks)
    const lessonsWithSlugs = allLessons.map(lesson => ({
      ...lesson,
      slug: generateSlug(lesson.title, lesson.language)
    }));

    // Insert new lessons
    const result = await Lesson.insertMany(lessonsWithSlugs);
    console.log(`Seeded ${result.length} lessons:`);
    console.log(`  - English: ${englishLessons.length} lessons`);
    console.log(`  - Spanish: ${spanishLessons.length} lessons`);
    console.log(`  - Japanese: ${japaneseLessons.length} lessons`);
    console.log(`  - Korean: ${koreanLessons.length} lessons`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding lessons:', error);
    process.exit(1);
  }
};

// Run the seed
seedLessons();
