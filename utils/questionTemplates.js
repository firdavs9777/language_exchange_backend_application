const READING_TEMPLATES = {
  mainIdea: [
    {
      pattern: 'Which of the following best summarizes the passage?',
      optionCount: 4,
      template: (topic, context) => ({
        question: `Which of the following best summarizes the passage about ${topic}?`,
        explanation: `The passage primarily discusses ${context}`,
      })
    },
    {
      pattern: 'The author\'s main purpose is to:',
      optionCount: 4,
      template: (topic, context) => ({
        question: `The author's main purpose in discussing ${topic} is to:`,
        explanation: `This relates to the central argument about ${context}`,
      })
    }
  ],
  vocabulary: [
    {
      pattern: 'In paragraph X, the word "Y" most closely means:',
      optionCount: 4,
      template: (word, context) => ({
        question: `In the passage, the word "${word}" most closely means:`,
        explanation: `Based on context, "${word}" refers to ${context}`,
      })
    }
  ],
  inference: [
    {
      pattern: 'The passage implies that:',
      optionCount: 4,
      template: (topic, context) => ({
        question: `The passage implies that regarding ${topic}:`,
        explanation: `While not directly stated, this is supported by ${context}`,
      })
    }
  ]
};

const WRITING_TEMPLATES = {
  letter: [
    'Write a letter to [RECIPIENT]. In your letter: • describe [ACTION] • explain [REASON] • say what you want them to do',
    'You need to contact [RECIPIENT] about [TOPIC]. Write a letter that: • states your purpose • gives details • requests [OUTCOME]',
  ],
  essay: [
    'Write an essay about [TOPIC]. Discuss: • the current situation • the implications • your perspective. Write at least 250 words.',
    'Some people believe that [CLAIM]. To what extent do you agree or disagree? Write at least 250 words.',
  ],
  report: [
    'Write a report on [TOPIC]. Include: • an overview • key findings • recommendations',
  ],
  review: [
    'Write a review of [ITEM]. Include: • what it is • your experience • recommendation',
  ]
};

const SPEAKING_TEMPLATES = {
  partOne: [
    'Tell me about your favorite [TOPIC]. What do you like about it? Why?',
    'Do you enjoy [ACTIVITY]? Why / why not?',
    'How often do you [ACTIVITY]? What do you think about it?',
  ],
  partTwo: [
    'Describe [NOUN]. You should say: • what it is • where it is • why you like/remember it',
    'Talk about a time you [PAST_EVENT]. Describe: • what happened • who was involved • why it was important',
  ],
  partThree: [
    'We\'ve been talking about [TOPIC]. Now, let\'s consider the broader issue. How do you think [BROADER_QUESTION]?',
    'In your opinion, how has [PHENOMENON] changed over time? What are the reasons?',
  ]
};

module.exports = {
  READING_TEMPLATES,
  WRITING_TEMPLATES,
  SPEAKING_TEMPLATES,
};
