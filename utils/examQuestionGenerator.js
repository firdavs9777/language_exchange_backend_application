const { READING_TEMPLATES, WRITING_TEMPLATES, SPEAKING_TEMPLATES } = require('./questionTemplates');

// Topics for diverse content
const TOPICS = {
  reading: [
    'Climate and Environment', 'Technology and Innovation', 'Education and Learning',
    'Work and Career', 'Health and Wellness', 'Travel and Culture', 'Family and Relationships',
    'Food and Nutrition', 'Sports and Recreation', 'Media and Communication', 'Ethics and Values',
    'Arts and Creativity', 'Finance and Economics', 'Social Issues', 'Science and Discovery',
    'History and Heritage', 'Urban Life', 'Nature and Wildlife', 'Transportation', 'Entertainment'
  ],
  speaking: [
    'Hobbies', 'Travel', 'Work', 'Education', 'Family', 'Technology', 'Environment', 'Health',
    'Culture', 'Sports', 'Food', 'Media', 'Relationships', 'Career', 'Social Issues', 'Art',
    'Money and Finance', 'Local Customs', 'Current Events', 'Future Plans', 'Personal Values'
  ]
};

function generateReadingQuestions(count, language = 'en') {
  const questions = [];
  const topicsToUse = TOPICS.reading;

  for (let i = 0; i < count; i++) {
    const templateType = ['mainIdea', 'vocabulary', 'inference'][i % 3];
    const templates = READING_TEMPLATES[templateType];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const topic = topicsToUse[i % topicsToUse.length];
    const difficulty = ['easy', 'medium', 'hard'][Math.floor(i / (count / 3))];

    const question = {
      topic: topic,
      questionText: `${template.template(topic, `in ${topic.toLowerCase()}`).question} (Question ${i + 1})`,
      questionType: 'multiple-choice',
      options: generateMultipleChoiceOptions(),
      correctAnswer: 'B',
      explanation: template.template(topic, `the main discussion`).explanation,
      difficulty: difficulty,
    };

    questions.push(question);
  }

  return questions;
}

function generateWritingQuestions(count, language = 'en') {
  const questions = [];
  const types = ['letter', 'essay', 'report', 'review'];
  const typeTemplates = {
    letter: WRITING_TEMPLATES.letter,
    essay: WRITING_TEMPLATES.essay,
    report: WRITING_TEMPLATES.report,
    review: WRITING_TEMPLATES.review,
  };

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const templates = typeTemplates[type];
    const template = templates[i % templates.length];
    const topic = TOPICS.reading[i % TOPICS.reading.length];
    const difficulty = ['easy', 'medium', 'hard'][Math.floor(i / (count / 3))];

    const question = {
      topic: topic,
      questionText: template
        .replace('[TOPIC]', topic)
        .replace('[RECIPIENT]', 'the relevant authority')
        .replace('[ACTION]', 'your situation')
        .replace('[REASON]', 'how this affects you')
        .replace('[ITEM]', topic),
      questionType: 'essay',
      correctAnswer: null,
      explanation: `This task requires a structured ${type}. Focus on clear communication and appropriate tone.`,
      difficulty: difficulty,
    };

    questions.push(question);
  }

  return questions;
}

function generateSpeakingQuestions(count, language = 'en') {
  const questions = [];
  const parts = ['part-one', 'part-two', 'part-three'];

  for (let i = 0; i < count; i++) {
    const part = parts[i % 3];
    const templates = part === 'part-one'
      ? SPEAKING_TEMPLATES.partOne
      : part === 'part-two'
      ? SPEAKING_TEMPLATES.partTwo
      : SPEAKING_TEMPLATES.partThree;

    const template = templates[i % templates.length];
    const topic = TOPICS.speaking[i % TOPICS.speaking.length];

    const question = {
      topic: topic,
      questionText: template
        .replace('[TOPIC]', topic)
        .replace('[NOUN]', topic)
        .replace('[ACTIVITY]', topic.toLowerCase())
        .replace('[PAST_EVENT]', `when you ${topic.toLowerCase()}`)
        .replace('[BROADER_QUESTION]', `about the role of ${topic.toLowerCase()} in society`),
      questionType: 'open-ended',
      correctAnswer: null,
      explanation: 'This is an open-ended speaking task. Aim for fluency and natural expression.',
      difficulty: 'medium',
    };

    questions.push(question);
  }

  return questions;
}

function generateMultipleChoiceOptions() {
  const options = [
    'A) The passage discusses only historical perspectives',
    'B) The main focus is on practical applications and modern implications',
    'C) The author argues for a single solution',
    'D) The passage is primarily biographical'
  ];
  return options;
}

module.exports = {
  generateReadingQuestions,
  generateWritingQuestions,
  generateSpeakingQuestions,
};
