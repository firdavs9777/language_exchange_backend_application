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
  ],
  newsArticle: [
    {
      pattern: 'According to the article, what is the main news being reported?',
      optionCount: 4,
      template: (topic, context) => ({
        question: `Based on the news article about ${topic}, the primary development is:`,
        explanation: `The article emphasizes ${context}`,
      })
    },
    {
      pattern: 'What does the author cite as evidence for this claim?',
      optionCount: 4,
      template: (topic, context) => ({
        question: `In the article, the evidence cited for ${topic} includes:`,
        explanation: `The article provides ${context} as supporting evidence`,
      })
    }
  ],
  opinionPiece: [
    {
      pattern: 'What is the author\'s main argument?',
      optionCount: 4,
      template: (topic, context) => ({
        question: `The author's primary argument regarding ${topic} is that:`,
        explanation: `The author asserts that ${context}`,
      })
    },
    {
      pattern: 'Which statement best reflects the author\'s viewpoint?',
      optionCount: 4,
      template: (topic, context) => ({
        question: `Based on the opinion piece, the author believes ${topic}:`,
        explanation: `This reflects the author's position that ${context}`,
      })
    }
  ],
  technicalContent: [
    {
      pattern: 'According to the technical material, how does this process work?',
      optionCount: 4,
      template: (topic, context) => ({
        question: `In the technical content about ${topic}, the process is described as:`,
        explanation: `The text explains that ${context}`,
      })
    },
    {
      pattern: 'What is the purpose of this technical component?',
      optionCount: 4,
      template: (topic, context) => ({
        question: `The primary function of ${topic} in this technical context is to:`,
        explanation: `The technical documentation indicates that ${context}`,
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
  ],
  email: [
    'Write a professional email to [RECIPIENT] about [TOPIC]. Include: • clear subject • polite greeting • main point • closing request',
    'You need to send a work email requesting [REQUEST] from [RECIPIENT]. Write at least 100 words.',
  ],
  creativePiece: [
    'Write a creative piece about [TOPIC]. You can choose: • a short story • a dialogue • a descriptive narrative. Include vivid details and engaging language.',
    'Create a creative writing piece inspired by [TOPIC]. Your work should demonstrate: • imagination • descriptive language • clear structure',
  ],
  summary: [
    'Summarize the key points from [TOPIC]. Your summary should: • capture main ideas • be concise • maintain the original meaning',
    'Write a summary of [TOPIC] in no more than 150 words. Include only the most important information.',
  ],
  proposal: [
    'Write a proposal for [TOPIC]. Include: • statement of the problem • proposed solution • expected benefits • timeline for implementation',
    'Prepare a proposal addressing [TOPIC]. Structure your response with: • introduction • main argument • supporting evidence • call to action',
  ],
  formalLetter: [
    'Write a formal business letter regarding [TOPIC]. Include: • proper formatting • formal greeting • clear purpose • professional closing',
    'Compose a formal letter to [RECIPIENT] about [TOPIC]. Ensure: • appropriate tone • structured paragraphs • clear requests or statements',
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
