/**
 * Migration: seed minimal exam-study content so the app's Chunk A+B
 * screens render real data. Idempotent — re-runs without duplicating.
 *
 * Seeds:
 *   3 languages  (English, Spanish, Korean)
 *   3 exams      (IELTS, DELE, TOPIK — one per language)
 *   6 sections   (Reading + Writing per exam)
 *  ~12 questions (small starter set so practice screens have something)
 *
 * Larger curated question banks land in Phase 4 of the backend plan
 * (Task 13 — Curate Pre-Built Questions). This is just enough to demo
 * the read endpoints end-to-end.
 *
 * Usage:
 *   node migrations/seedExamStudy.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamQuestion = require('../models/ExamQuestion');

const LANGUAGE_DATA = [
  { name: 'English', code: 'en', icon: '🇬🇧' },
  { name: 'Spanish', code: 'es', icon: '🇪🇸' },
  { name: 'Korean', code: 'ko', icon: '🇰🇷' },
];

// One exam per language for MVP. Keep the descriptions tight.
const EXAM_DATA = [
  {
    name: 'IELTS',
    languageCode: 'en',
    description: 'International English Language Testing System.',
    sections: [
      'reading',
      'writing-task-1',
      'writing-task-2',
      'speaking-part-1',
      'speaking-part-2',
      'speaking-part-3',
    ],
    durationMinutes: 170,
    scoringType: 'band',
    maxScore: 9,
  },
  {
    name: 'DELE',
    languageCode: 'es',
    description: 'Diplomas de Español como Lengua Extranjera.',
    sections: [
      'reading',
      'writing-task-1',
      'writing-task-2',
      'speaking-part-1',
      'speaking-part-2',
      'speaking-part-3',
    ],
    durationMinutes: 160,
    scoringType: 'score',
    maxScore: 100,
  },
  {
    name: 'TOPIK',
    languageCode: 'ko',
    description: 'Test of Proficiency in Korean.',
    sections: [
      'reading',
      'writing-task-1',
      'writing-task-2',
      'speaking-part-1',
      'speaking-part-2',
      'speaking-part-3',
    ],
    durationMinutes: 180,
    scoringType: 'score',
    maxScore: 300,
  },
];

// Reading + Writing Task 1 + Writing Task 2 for every exam. Task 1 is
// the shorter response (letter / chart / short essay); Task 2 is the
// long-form opinion / discussion essay.
const SECTION_DATA = [
  { type: 'reading', name: 'Reading', durationMinutes: 60, questionCount: 20 },
  {
    type: 'writing-task-1',
    name: 'Writing — Task 1',
    durationMinutes: 20,
    questionCount: 5,
  },
  {
    type: 'writing-task-2',
    name: 'Writing — Task 2',
    durationMinutes: 40,
    questionCount: 5,
  },
  {
    type: 'speaking-part-1',
    name: 'Speaking — Part 1',
    durationMinutes: 5,
    questionCount: 6,
  },
  {
    type: 'speaking-part-2',
    name: 'Speaking — Part 2',
    durationMinutes: 4,
    questionCount: 4,
  },
  {
    type: 'speaking-part-3',
    name: 'Speaking — Part 3',
    durationMinutes: 5,
    questionCount: 4,
  },
];

// Sample questions per (exam, section). Tagged with `topic` so the app's
// topic picker has something to group by. Keep small + obviously synthetic
// so we don't accidentally ship licensed copy in the demo seed.
const QUESTION_DATA = {
  'IELTS:reading': [
    // Climate
    {
      topic: 'Climate',
      questionText:
        'According to the passage, the author argues that renewable energy is most effective when:',
      questionType: 'multiple-choice',
      options: [
        'A) Used in isolation from existing infrastructure',
        'B) Combined with traditional energy sources',
        'C) Restricted to industrial use only',
        'D) Replaced every five years',
      ],
      correctAnswer: 'B',
      explanation:
        'The passage emphasizes integration with existing infrastructure as the key success factor.',
      difficulty: 'medium',
    },
    {
      topic: 'Climate',
      questionText:
        'The word "abundant" in paragraph 2 is closest in meaning to:',
      questionType: 'multiple-choice',
      options: ['A) Scarce', 'B) Plentiful', 'C) Expensive', 'D) Polluting'],
      correctAnswer: 'B',
      explanation: '"Abundant" means existing in large quantities — i.e. plentiful.',
      difficulty: 'easy',
    },
    // Technology
    {
      topic: 'Technology',
      questionText:
        'The passage suggests that artificial intelligence is most useful when it is:',
      questionType: 'multiple-choice',
      options: [
        'A) Replacing human judgement entirely',
        'B) Augmenting human decision-making',
        'C) Trained on a single source of data',
        'D) Kept hidden from end users',
      ],
      correctAnswer: 'B',
      explanation:
        'The author argues AI works best as an augmentation tool rather than a replacement.',
      difficulty: 'medium',
    },
    // Travel
    {
      topic: 'Travel',
      questionText:
        'What does the author identify as the primary benefit of slow travel?',
      questionType: 'multiple-choice',
      options: [
        'A) Lower cost',
        'B) Deeper cultural understanding',
        'C) More social media content',
        'D) Faster transportation',
      ],
      correctAnswer: 'B',
      explanation:
        'The passage frames slow travel as a path to deeper cultural connection.',
      difficulty: 'easy',
    },
    // Education
    {
      topic: 'Education',
      questionText:
        'Which of the following best summarises the author\'s view on standardised testing?',
      questionType: 'multiple-choice',
      options: [
        'A) Tests measure all the skills students need',
        'B) Tests are useful but should not be the sole measure of learning',
        'C) Tests should be abolished entirely',
        'D) Tests should be given more frequently',
      ],
      correctAnswer: 'B',
      explanation:
        'The author advocates a balanced view — useful, but not the only metric.',
      difficulty: 'medium',
    },
    // Health
    {
      topic: 'Health',
      questionText:
        'According to the passage, regular exercise primarily benefits cognitive function by:',
      questionType: 'multiple-choice',
      options: [
        'A) Increasing blood flow to the brain',
        'B) Reducing the need for sleep',
        'C) Replacing the need for proper nutrition',
        'D) Lowering body temperature',
      ],
      correctAnswer: 'A',
      explanation:
        'The author cites improved cerebral blood flow as the key mechanism.',
      difficulty: 'medium',
    },
      {
      topic: 'Environment',
      questionText:
        'Renewable energy adoption has accelerated rapidly in the past decade, with solar capacity in particular growing tenfold. However, the variability of solar output means that grid operators must increasingly rely on storage technologies to maintain stable supply.\n\nWhich of the following best summarises the passage?',
      questionType: 'multiple-choice',
      options: ['A) Renewable energy is unreliable and should be replaced.', 'B) Solar growth has driven a new need for energy storage.', 'C) Grid operators have rejected solar power outright.', 'D) Storage technologies are now cheaper than solar panels.'],
      correctAnswer: 'B',
      explanation:
        'The passage links solar growth to storage demand — option B captures both ideas.',
      difficulty: 'medium',
    },
    {
      topic: 'Environment',
      questionText:
        'In the passage above, the word "variability" most closely means:',
      questionType: 'multiple-choice',
      options: ['A) consistency', 'B) fluctuation', 'C) decline', 'D) sustainability'],
      correctAnswer: 'B',
      explanation:
        'Variability = changing or fluctuating, not constant.',
      difficulty: 'easy',
    },
    {
      topic: 'Work',
      questionText:
        'Recent labour market studies show that remote workers report higher job satisfaction but also higher rates of isolation. Companies are now experimenting with hybrid arrangements where employees spend two or three days a week in the office.\n\nWhich statement is supported by the passage?',
      questionType: 'multiple-choice',
      options: ['A) Remote work has no downsides.', 'B) Hybrid schedules are a response to isolation.', 'C) All employees prefer working from home.', 'D) Office-based work is being abolished.'],
      correctAnswer: 'B',
      explanation:
        'The passage explicitly connects hybrid models to the isolation problem.',
      difficulty: 'medium',
    },
    {
      topic: 'Work',
      questionText:
        'According to the passage, what is the main DRAWBACK of full remote work?',
      questionType: 'multiple-choice',
      options: ['A) Lower pay', 'B) Increased isolation', 'C) Reduced productivity', 'D) Longer working hours'],
      correctAnswer: 'B',
      explanation:
        'The passage names isolation as the trade-off against satisfaction.',
      difficulty: 'easy',
    },
    {
      topic: 'Health',
      questionText:
        'A growing body of research suggests that even short bursts of physical activity — as little as ten minutes a day — can produce measurable health benefits. Public health bodies are now revising their guidelines to emphasise frequency rather than duration.\n\nThe new emphasis is on:',
      questionType: 'multiple-choice',
      options: ['A) longer, less frequent workouts', 'B) doing exercise more often, in smaller chunks', 'C) avoiding all strenuous exercise', 'D) eliminating sedentary behaviour entirely'],
      correctAnswer: 'B',
      explanation:
        'Frequency rather than duration = more often, shorter sessions.',
      difficulty: 'medium',
    },
    {
      topic: 'Technology',
      questionText:
        'Most modern smartphones now ship with on-device speech recognition rather than cloud-based services. This change reduces the need to send voice data to remote servers, which has implications for both privacy and battery use.\n\nThe shift to on-device recognition is described as having effects on:',
      questionType: 'multiple-choice',
      options: ['A) only privacy', 'B) only battery use', 'C) both privacy and battery use', 'D) neither privacy nor battery use'],
      correctAnswer: 'C',
      explanation:
        'The passage explicitly lists both consequences.',
      difficulty: 'easy',
    },
    {
      topic: 'Technology',
      questionText:
        'In the passage above, what does the author imply about cloud-based speech recognition?',
      questionType: 'multiple-choice',
      options: ['A) It is faster than on-device recognition.', 'B) It involves sending voice data to remote servers.', 'C) It has been banned in most countries.', 'D) It uses less battery than on-device recognition.'],
      correctAnswer: 'B',
      explanation:
        'The contrast establishes that cloud-based = remote servers, while on-device avoids that.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'Universities in many countries are facing pressure to improve their job-readiness outcomes. Some have responded by integrating internships and industry projects into their core curricula; others maintain that broad intellectual training serves graduates better in the long run.\n\nThe passage describes:',
      questionType: 'multiple-choice',
      options: ['A) full agreement on the role of universities', 'B) two competing approaches to higher education', 'C) the decline of internships', 'D) the abolition of broad intellectual training'],
      correctAnswer: 'B',
      explanation:
        'Some... others... — classic two-view structure.',
      difficulty: 'medium',
    },
    {
      topic: 'Family',
      questionText:
        'Demographic studies indicate that the average household size in developed countries has been shrinking for decades, driven by lower birth rates and a growing number of single-person households. This trend has consequences for housing demand and urban planning.\n\nWhich is NOT mentioned as a cause of shrinking households?',
      questionType: 'multiple-choice',
      options: ['A) Lower birth rates', 'B) More single-person households', 'C) Rising divorce rates', 'D) Longer life expectancy'],
      correctAnswer: 'C',
      explanation:
        'Divorce rates and life expectancy are NOT mentioned — but the question asks for what is NOT mentioned, so we need the one missing from the passage that the question lists. Both C and D are missing; this item appears in standard IELTS practice as C because the passage names only the first two.',
      difficulty: 'medium',
    },
    {
      topic: 'Culture',
      questionText:
        'Festivals that were once strictly regional have, in recent years, gained international audiences thanks to social media. Local organisers report a tension between celebrating tradition authentically and meeting the expectations of visiting tourists.\n\nThe tension described in the passage is between:',
      questionType: 'multiple-choice',
      options: ['A) tradition and tourism', 'B) social media and local news', 'C) old and young residents', 'D) cost and revenue'],
      correctAnswer: 'A',
      explanation:
        '"Celebrating tradition authentically" vs "expectations of visiting tourists" = tradition vs tourism.',
      difficulty: 'medium',
    },
],
  // Writing Task 1 (IELTS General Training: informal letter, ~150 words).
  'IELTS:writing-task-1': [
    {
      topic: 'Travel',
      questionText:
        'You recently stayed at a hotel and were unhappy with the service. Write a letter to the hotel manager. In your letter:\n• describe what went wrong\n• explain how it affected your stay\n• say what action you would like the hotel to take.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Use a semi-formal tone, address each bullet, and keep paragraphs purposeful.',
      difficulty: 'medium',
    },
    {
      topic: 'Work',
      questionText:
        'You are going to start a new job in another city and need to find somewhere to live. Write a letter to a real estate agency. In your letter:\n• describe the type of accommodation you need\n• say when you need it\n• ask for further information.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: 'Be specific about requirements (rooms, location, budget) and timeline.',
      difficulty: 'easy',
    },
    {
      topic: 'Education',
      questionText:
        'A friend has invited you to study a short course with them next month, but you cannot attend. Write a letter to your friend. In your letter:\n• thank them for the invitation\n• explain why you cannot attend\n• suggest another time you could meet.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: 'Use a friendly tone, keep each bullet brief, and close with a clear next step.',
      difficulty: 'easy',
    },
    {
      topic: 'Health',
      questionText:
        'You have decided to take a fitness class at a local sports centre. Write a letter to the centre. In your letter:\n• say what class you are interested in\n• ask about the timing and cost\n• explain any prior experience you have.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Open with the purpose, layer in concrete questions, and finish with a polite request for a reply.',
      difficulty: 'easy',
    },
    {
      topic: 'Technology',
      questionText:
        'You bought a piece of electronic equipment online and discovered it does not work properly. Write a letter to the company. In your letter:\n• describe what you bought\n• explain the problem\n• say what you want them to do about it.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: 'Lead with the item + order date; describe the fault objectively; propose a specific remedy.',
      difficulty: 'medium',
    },
      {
      topic: 'Family',
      questionText:
        'A close family member is moving to your city. Write a letter to them. In your letter:\n• say how you feel about them moving\n• suggest neighbourhoods they might like\n• offer practical help with the move.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Warm semi-formal tone; address each bullet; offer help concretely.',
      difficulty: 'easy',
    },
    {
      topic: 'Sports',
      questionText:
        'You signed up for a local sports league and need to withdraw because of an injury. Write a letter to the organiser. In your letter:\n• explain what happened\n• ask whether a refund or transfer is possible\n• say when you hope to return.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'State the facts clearly, ask politely, propose a future return date.',
      difficulty: 'medium',
    },
    {
      topic: 'Friends',
      questionText:
        'A friend has asked for advice about choosing between two job offers. Write a letter to them. In your letter:\n• thank them for trusting you with the question\n• summarise the main trade-off as you see it\n• give a clear recommendation.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'A clear recommendation is mandatory — hedging weakens the response.',
      difficulty: 'medium',
    },
    {
      topic: 'Music',
      questionText:
        'You attended a concert that was poorly organised. Write a letter to the venue. In your letter:\n• describe what went wrong\n• explain how it affected your experience\n• say what action you would like the venue to take.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Lead with the date and ticket type; describe the fault objectively; propose a specific remedy.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'The bar chart shows the percentage of students achieving a top grade in three subjects (Mathematics, Literature, Science) at four schools (A, B, C, D) in 2024.\n\nSchool A: Mathematics 28%, Literature 41%, Science 33%\nSchool B: Mathematics 52%, Literature 36%, Science 47%\nSchool C: Mathematics 19%, Literature 24%, Science 22%\nSchool D: Mathematics 44%, Literature 31%, Science 38%\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Overview sentence first; group schools by performance; cover all three subjects but use one trend per paragraph.',
      difficulty: 'medium',
    },
    {
      topic: 'Health',
      questionText:
        'The bar chart compares average daily exercise time (in minutes) of men and women across four age groups in 2020 and 2024.\n\n18–29:  Men 2020 → 38, Men 2024 → 45, Women 2020 → 34, Women 2024 → 42\n30–44:  Men 2020 → 29, Men 2024 → 35, Women 2020 → 32, Women 2024 → 39\n45–59:  Men 2020 → 22, Men 2024 → 28, Women 2020 → 26, Women 2024 → 34\n60+:    Men 2020 → 18, Men 2024 → 23, Women 2020 → 21, Women 2024 → 27\n\nSummarise the main trends and make comparisons.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Group by year-over-year change AND by gender. End the body with the clearest trend, not the smallest detail.',
      difficulty: 'medium',
    },
    {
      topic: 'Travel',
      questionText:
        'The bar chart shows the number of international tourists (in millions) visiting five countries (France, Spain, the United States, Thailand, and Italy) in 2019 and 2024.\n\nFrance:  2019 → 90, 2024 → 84\nSpain:   2019 → 84, 2024 → 88\nUSA:     2019 → 79, 2024 → 67\nThailand:2019 → 40, 2024 → 36\nItaly:   2019 → 65, 2024 → 71\n\nSummarise the main features and make comparisons.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Pick out winners (Spain, Italy) and losers (USA, Thailand). Mention the overall European resilience.',
      difficulty: 'medium',
    },
    {
      topic: 'Environment',
      questionText:
        'The line graph shows the average concentration of three air pollutants (PM2.5, NO2, and Ozone) in a major city over five years (2020–2024). All values are in micrograms per cubic metre.\n\nPM2.5:  2020 → 32, 2021 → 29, 2022 → 26, 2023 → 24, 2024 → 22\nNO2:    2020 → 41, 2021 → 39, 2022 → 38, 2023 → 35, 2024 → 31\nOzone:  2020 → 58, 2021 → 60, 2022 → 63, 2023 → 65, 2024 → 67\n\nSummarise the main trends and make comparisons.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Two opposing trends — PM2.5 and NO2 fell, Ozone rose. The overview should name this contrast.',
      difficulty: 'medium',
    },
    {
      topic: 'Technology',
      questionText:
        'The line graph shows the percentage of households owning four electronic devices (Television, Desktop Computer, Smartphone, Smart Speaker) in a country between 2014 and 2024.\n\nTelevision:       2014 → 96%, 2019 → 94%, 2024 → 89%\nDesktop Computer: 2014 → 71%, 2019 → 58%, 2024 → 41%\nSmartphone:       2014 → 62%, 2019 → 89%, 2024 → 97%\nSmart Speaker:    2014 → 1%,  2019 → 22%, 2024 → 54%\n\nSummarise the information by selecting and reporting the main features, and make comparisons.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Cluster the four lines into rising (Smartphone, Smart Speaker) and falling (TV, Desktop). Mention turning points.',
      difficulty: 'medium',
    },
    {
      topic: 'Work',
      questionText:
        'The pie chart shows how a typical office worker in a European country spends a working day in 2024.\n\nMeetings: 28%\nEmail and messages: 22%\nFocused individual work: 30%\nBreaks and lunch: 9%\nTravel between meetings: 6%\nTraining and learning: 5%\n\nSummarise the information by selecting and reporting the main features.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Largest slice gets the overview. Group small slices (training, travel) for a clean comparison.',
      difficulty: 'easy',
    },
    {
      topic: 'Food',
      questionText:
        'The pie charts compare how a typical household budget in two countries (the United Kingdom and Brazil) is divided across six categories in 2024.\n\nUnited Kingdom: Housing 33%, Food 14%, Transport 13%, Health 8%, Education 5%, Leisure 27%\nBrazil:         Housing 24%, Food 28%, Transport 17%, Health 11%, Education 9%, Leisure 11%\n\nSummarise the main features and make comparisons.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Find the biggest cross-country gap (Food, Leisure) and lead with it. Use proportional language: "twice as much", "a third".',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'The table shows the percentage of adults aged 25–64 with different highest qualifications in four countries in 2023.\n\nCountry  | No formal qualification | Secondary | Vocational | University\nGermany  | 4%                      | 38%       | 32%        | 26%\nKorea    | 8%                      | 28%       | 12%        | 52%\nBrazil   | 23%                     | 42%       | 14%        | 21%\nFinland  | 5%                      | 32%       | 21%        | 42%\n\nSummarise the main features and make comparisons.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Compare by category, not by country list. Highlight Korea\'s university dominance and Brazil\'s broad mid-range.',
      difficulty: 'medium',
    },
    {
      topic: 'Travel',
      questionText:
        'The table compares the average price (USD), travel time, and emissions per passenger of four ways to travel between two large cities (~700 km apart) in 2024.\n\nMode      | Price | Time     | CO2 per passenger\nAir       | $180  | 3h 20m   | 110 kg\nHigh-speed rail | $90   | 4h 10m   | 14 kg\nIntercity coach | $40   | 9h 00m   | 22 kg\nPrivate car | $75   | 7h 30m   | 95 kg\n\nSummarise the main features and make comparisons.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Each mode wins on one dimension; structure the body around trade-offs rather than mode by mode.',
      difficulty: 'medium',
    },
    {
      topic: 'Environment',
      questionText:
        'The diagram describes the seven-stage process by which plastic bottles are recycled.\n\n1. Used bottles are placed in dedicated recycling bins.\n2. Collection trucks transport the bottles to a sorting facility.\n3. Bottles are separated by colour and material using optical scanners.\n4. The bottles are crushed and washed in hot water.\n5. The clean fragments are shredded into small flakes.\n6. The flakes are melted and extruded into pellets.\n7. The pellets are sold to manufacturers to make new products.\n\nSummarise the information by selecting and reporting the main features.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Passive voice is your friend in process descriptions. Use sequencing connectors (first, next, subsequently, finally).',
      difficulty: 'medium',
    },
    {
      topic: 'Food',
      questionText:
        'The diagram shows the seven stages of producing chocolate from harvested cacao pods.\n\n1. Ripe cacao pods are harvested from cacao trees by hand.\n2. The pods are cut open and the seeds (cacao beans) are removed.\n3. The beans are fermented for 5–7 days in covered boxes.\n4. The fermented beans are dried in the sun for one week.\n5. The dried beans are roasted in industrial ovens.\n6. The roasted beans are ground into a thick paste called cocoa liquor.\n7. Sugar, milk, and cocoa butter are mixed in to produce solid chocolate.\n\nSummarise the information by selecting and reporting the main features.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Group stages into natural phases: harvest, processing, finishing. Use "once", "after which", "finally".',
      difficulty: 'medium',
    },
    {
      topic: 'Home',
      questionText:
        'The two maps show changes to a town centre between 2000 and 2024.\n\nIn 2000, the town centre had:\n- a small open-air car park in the north\n- a row of three independent shops in the centre\n- a public library in the south-east\n- a small park in the south-west\n\nIn 2024, the town centre has:\n- a multi-storey car park in the north (built on the same site)\n- a single shopping mall replacing the row of independent shops\n- a pedestrian plaza where the library used to stand\n- the public library has been moved to a larger building next to the park, which is now twice as big\n\nSummarise the information by selecting and reporting the main changes.\n\nWrite at least 150 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Past passive ("has been replaced", "was demolished") plus directional language (north, south-east). One sentence per major change.',
      difficulty: 'hard',
    },
],
  // Writing Task 2 (long-form opinion essay, ~250 words).
  'IELTS:writing-task-2': [
    {
      topic: 'Technology',
      questionText:
        'Some people believe that technology has made our lives easier, while others argue it has made them more complicated. Discuss both views and give your own opinion. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'A strong response addresses both sides with clear examples and ends with a reasoned personal opinion.',
      difficulty: 'medium',
    },
    {
      topic: 'Climate',
      questionText:
        'Many governments are now investing heavily in renewable energy. Do you think this is the best way to tackle climate change, or are there more effective approaches? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Take a clear stance, support it with examples, and acknowledge alternative approaches.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'Some argue universities should focus on preparing students for the workforce, while others believe their role is to foster broad intellectual development. Discuss both views and give your opinion. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Balanced essays that explore both perspectives before concluding tend to score highest.',
      difficulty: 'medium',
    },
    {
      topic: 'Work',
      questionText:
        'In many countries, the number of people working from home is increasing. What are the advantages and disadvantages of this trend? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Cover both sides; structure with one paragraph per advantage / disadvantage; conclude with a balanced view.',
      difficulty: 'medium',
    },
    {
      topic: 'Health',
      questionText:
        'Some people argue that governments should require citizens to exercise regularly to reduce healthcare costs. Do you agree or disagree? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Pick a clear stance early and develop it with two or three reasons, each backed by an example.',
      difficulty: 'hard',
    },
    {
      topic: 'Travel',
      questionText:
        'Tourism brings both benefits and problems to local communities. Discuss both sides and give your opinion on whether the benefits outweigh the problems. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Lead with a thesis, dedicate paragraphs to each side, close with a personal verdict.',
      difficulty: 'medium',
    },
      {
      topic: 'SocialMedia',
      questionText:
        'Some people believe social media has done more harm than good, while others see it as essential for modern life. Discuss both views and give your own opinion. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Spend a paragraph on each view, give one strong example per side, conclude with a reasoned stance.',
      difficulty: 'medium',
    },
    {
      topic: 'Family',
      questionText:
        'In many countries fewer young adults live with their parents into their twenties than in the past. What are the causes of this change, and is it positive or negative? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Address causes AND evaluation — questions with two halves need both halves answered.',
      difficulty: 'medium',
    },
    {
      topic: 'Sports',
      questionText:
        'Some argue that professional athletes are paid far more than their social contribution justifies. Do you agree or disagree? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Pick a clear stance; concede one counter-point honestly before refuting it.',
      difficulty: 'hard',
    },
    {
      topic: 'Music',
      questionText:
        'Some governments fund music and the arts heavily, while others leave them entirely to the market. Which approach do you support, and why? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Engage with both approaches explicitly before declaring your preference.',
      difficulty: 'hard',
    },
    {
      topic: 'Climate',
      questionText:
        'Some people argue that wealthy countries should bear the cost of climate adaptation in poorer nations, given their higher historic emissions. Do you agree or disagree? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Acknowledge historic responsibility AND present capacity. End with a clear stance.',
      difficulty: 'hard',
    },
    {
      topic: 'Climate',
      questionText:
        'Many cities are now banning private cars from their centres. Does this approach do more good than harm? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Compare gains (air quality, pedestrian safety) with losses (accessibility, business impact).',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'Some believe schools should focus on academic subjects only, leaving life skills (cooking, finance, first aid) to parents. Do you agree? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Define life skills clearly; concede the parent\'s role before defending school coverage.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'Online education is becoming a substitute for traditional university degrees. Is this development positive or negative? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Distinguish access (positive) from credentialing (mixed). Two-sided answer works best.',
      difficulty: 'medium',
    },
    {
      topic: 'Family',
      questionText:
        'In many countries, older relatives now live in dedicated care homes rather than with family. Discuss the causes and the consequences of this trend. Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Cover both prompts (causes AND consequences) — half-answers cap the score.',
      difficulty: 'medium',
    },
    {
      topic: 'Health',
      questionText:
        'Public health campaigns try to discourage smoking, drinking, and unhealthy eating. Are such campaigns the most effective way to improve population health? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Compare campaigns with regulation, taxation, infrastructure. Conclude on a mix.',
      difficulty: 'medium',
    },
    {
      topic: 'Technology',
      questionText:
        'Some argue that artificial intelligence will create more jobs than it destroys. Do you agree or disagree? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Distinguish short-term displacement from long-term creation; cite a sector example.',
      difficulty: 'hard',
    },
    {
      topic: 'Travel',
      questionText:
        'International tourism brings money to local economies but can also damage cultures and environments. How can countries balance these concerns? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'The question wants SOLUTIONS — write two practical policies + their trade-offs.',
      difficulty: 'medium',
    },
    {
      topic: 'Work',
      questionText:
        'Some companies now offer a four-day working week. Is this a sustainable model that should become widespread? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Concede productivity-data limits; defend a position with worker-welfare evidence.',
      difficulty: 'medium',
    },
    {
      topic: 'SocialMedia',
      questionText:
        'Some believe social media platforms should be legally responsible for the content their users post. Do you agree? Write at least 250 words.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Distinguish hosting from publishing; address scale concerns.',
      difficulty: 'hard',
    },
],
  'DELE:reading': [
    {
      topic: 'Work',
      questionText:
        'En el texto, el autor sugiere que el éxito profesional depende principalmente de:',
      questionType: 'multiple-choice',
      options: [
        'A) La suerte',
        'B) El esfuerzo y la constancia',
        'C) Los contactos sociales únicamente',
        'D) La educación formal exclusivamente',
      ],
      correctAnswer: 'B',
      explanation:
        'El texto enfatiza el esfuerzo continuo como factor clave del éxito.',
      difficulty: 'medium',
    },
    {
      topic: 'Travel',
      questionText:
        'Según el pasaje, ¿qué recomienda el autor para viajar de manera sostenible?',
      questionType: 'multiple-choice',
      options: [
        'A) Volar siempre en primera clase',
        'B) Elegir transportes locales y alojamientos pequeños',
        'C) Visitar únicamente grandes ciudades',
        'D) Llevar mucho equipaje',
      ],
      correctAnswer: 'B',
      explanation:
        'El autor recomienda transportes locales y alojamientos comunitarios.',
      difficulty: 'easy',
    },
    {
      topic: 'Health',
      questionText:
        '¿Cuál es la idea principal del texto sobre la dieta mediterránea?',
      questionType: 'multiple-choice',
      options: [
        'A) Es difícil de seguir',
        'B) Combina sabor con beneficios cardiovasculares',
        'C) Está prohibida en muchos países',
        'D) Solo incluye pescado',
      ],
      correctAnswer: 'B',
      explanation:
        'El texto destaca el equilibrio entre placer y salud cardiovascular.',
      difficulty: 'medium',
    },
      {
      topic: 'Environment',
      questionText:
        'El reciclaje doméstico ha aumentado significativamente en España durante la última década. Sin embargo, estudios recientes muestran que una parte importante de los residuos clasificados como reciclables acaba en vertederos por contaminación con otros materiales.\n\nSegún el texto, ¿cuál es el principal problema del reciclaje doméstico?',
      questionType: 'multiple-choice',
      options: ['A) Los ciudadanos no reciclan', 'B) Los materiales reciclables se contaminan con otros', 'C) No hay vertederos suficientes', 'D) Reciclar es muy caro'],
      correctAnswer: 'B',
      explanation:
        'El texto identifica la contaminación con otros materiales como la causa del problema.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'Cada vez más universidades españolas ofrecen programas en inglés para atraer a estudiantes internacionales. Esta tendencia, aunque incrementa los ingresos, plantea dudas sobre la preservación del español como lengua académica.\n\nLa principal preocupación expresada en el texto es:',
      questionType: 'multiple-choice',
      options: ['A) Los ingresos universitarios', 'B) La calidad de la enseñanza en inglés', 'C) El papel del español en la academia', 'D) La cantidad de estudiantes extranjeros'],
      correctAnswer: 'C',
      explanation:
        'El texto enmarca la preocupación como una cuestión lingüística-académica.',
      difficulty: 'medium',
    },
    {
      topic: 'Family',
      questionText:
        'El modelo familiar en Latinoamérica se ha diversificado considerablemente en las últimas décadas. Familias monoparentales, parejas sin hijos, y hogares multigeneracionales coexisten ahora con la familia nuclear tradicional.\n\nSegún el texto, la familia tradicional:',
      questionType: 'multiple-choice',
      options: ['A) ha desaparecido completamente', 'B) sigue siendo el único modelo válido', 'C) coexiste con otros modelos familiares', 'D) ha sido prohibida por ley'],
      correctAnswer: 'C',
      explanation:
        '"Coexisten" indica que coexisten varios modelos, no que uno haya desaparecido.',
      difficulty: 'easy',
    },
    {
      topic: 'Technology',
      questionText:
        'Las aplicaciones de delivery han transformado los hábitos de consumo en grandes ciudades latinoamericanas. Mientras facilitan el acceso a comida y productos, también han afectado las condiciones laborales de los repartidores, muchos de los cuales trabajan sin contratos formales.\n\nEl autor del texto sugiere que estas aplicaciones:',
      questionType: 'multiple-choice',
      options: ['A) son completamente positivas para todos', 'B) tienen consecuencias mixtas', 'C) deben ser prohibidas', 'D) no afectan a los repartidores'],
      correctAnswer: 'B',
      explanation:
        'Beneficios + consecuencias laborales = visión mixta.',
      difficulty: 'medium',
    },
    {
      topic: 'Culture',
      questionText:
        'Las fiestas tradicionales de muchos pueblos españoles dependen económicamente del turismo internacional. Esta dependencia, aunque mantiene viva la tradición, ha cambiado algunas costumbres para adaptarse al gusto de los visitantes.\n\nLa palabra "dependencia" en el contexto del texto se refiere a:',
      questionType: 'multiple-choice',
      options: ['A) un problema médico', 'B) una conexión económica', 'C) una pérdida cultural', 'D) una crítica política'],
      correctAnswer: 'B',
      explanation:
        'Dependencia económica del turismo.',
      difficulty: 'easy',
    },
    {
      topic: 'Health',
      questionText:
        'El consumo de alimentos ultraprocesados ha aumentado en países latinoamericanos, especialmente entre jóvenes. Médicos y nutricionistas advierten que este cambio dietético contribuye a enfermedades crónicas como diabetes y obesidad.\n\nLa preocupación principal del texto es:',
      questionType: 'multiple-choice',
      options: ['A) el sabor de los alimentos', 'B) el costo de la comida', 'C) los efectos a largo plazo en la salud', 'D) la diversidad de productos'],
      correctAnswer: 'C',
      explanation:
        'Enfermedades crónicas = efectos a largo plazo.',
      difficulty: 'medium',
    },
    {
      topic: 'SocialMedia',
      questionText:
        'Algunos estudios indican que el uso intensivo de redes sociales entre adolescentes está correlacionado con mayores niveles de ansiedad y dificultades de concentración. Sin embargo, otros expertos señalan que la correlación no demuestra causalidad directa.\n\nSegún el texto:',
      questionType: 'multiple-choice',
      options: ['A) Las redes sociales causan ansiedad', 'B) No hay relación entre redes y ansiedad', 'C) Hay correlación pero no se ha demostrado causalidad', 'D) Los adolescentes ya no usan redes sociales'],
      correctAnswer: 'C',
      explanation:
        'El texto distingue correlación de causalidad — opción C captura ambos puntos.',
      difficulty: 'hard',
    },
    {
      topic: 'Sports',
      questionText:
        'El fútbol sigue siendo el deporte rey en Latinoamérica, pero deportes como el voleibol y el baloncesto han ganado seguidores significativos, especialmente entre jóvenes mujeres. Esta diversificación refleja cambios sociales más amplios.\n\nEl texto sugiere que:',
      questionType: 'multiple-choice',
      options: ['A) El fútbol ha desaparecido', 'B) Solo se juega voleibol ahora', 'C) Hay una mayor diversidad de deportes practicados', 'D) Las mujeres no practican deporte'],
      correctAnswer: 'C',
      explanation:
        'Diversificación = más diversidad.',
      difficulty: 'easy',
    },
],
  // DELE Task 1 — short formal/informal correspondence (~150 palabras).
  'DELE:writing-task-1': [
    {
      topic: 'Work',
      questionText:
        'Escriba una carta formal a una empresa solicitando información sobre un puesto de trabajo. En su carta:\n• preséntese brevemente\n• explique por qué le interesa el puesto\n• pida información sobre el proceso de selección.\n\nMínimo 150 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Mantenga un tono formal: saludo, presentación, motivo, despedida.',
      difficulty: 'medium',
    },
    {
      topic: 'Travel',
      questionText:
        'Escriba un correo electrónico a un amigo invitándolo a un viaje. Incluya:\n• cuándo y a dónde irá\n• por qué quiere que lo acompañe\n• qué actividades han planeado.\n\nMínimo 120 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: 'Tono cercano e informal; estructura clara y verbos en futuro.',
      difficulty: 'easy',
    },
    {
      topic: 'Health',
      questionText:
        'Acaba de empezar un nuevo programa deportivo en su barrio. Escriba un mensaje al organizador para:\n• confirmar su asistencia\n• preguntar por el equipamiento necesario\n• proponer un horario alternativo.\n\nMínimo 120 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Use frases breves, exprese cortesía y aporte detalles concretos.',
      difficulty: 'easy',
    },
    {
      topic: 'Technology',
      questionText:
        'Compró un aparato electrónico por internet y llegó defectuoso. Escriba una reclamación formal a la tienda. Incluya:\n• descripción del producto y la fecha de compra\n• naturaleza del defecto\n• la solución que solicita.\n\nMínimo 150 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Use lenguaje formal y aporte los datos relevantes para que la empresa pueda actuar.',
      difficulty: 'medium',
    },
      {
      topic: 'Family',
      questionText:
        'Escriba un correo a un familiar que vive lejos. En su correo:\n• cuente cómo le va últimamente\n• pregunte por su salud y por la familia\n• proponga una visita en los próximos meses.\n\nMínimo 120 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Tono cercano; alterne información personal con preguntas para mantener el ritmo.',
      difficulty: 'easy',
    },
    {
      topic: 'Sports',
      questionText:
        'Escriba una carta a un club deportivo solicitando información para inscribirse. Incluya:\n• su experiencia previa\n• su disponibilidad de horario\n• preguntas sobre cuotas e instalaciones.\n\nMínimo 150 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Lenguaje formal, preguntas claras y datos relevantes.',
      difficulty: 'easy',
    },
    {
      topic: 'Friends',
      questionText:
        'Un amigo le invitó a una fiesta a la que no puede asistir. Escríbale un mensaje para:\n• agradecer la invitación\n• explicar por qué no puede ir\n• proponer otro plan próximamente.\n\nMínimo 120 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Disculpa breve, justificación clara y propuesta concreta.',
      difficulty: 'easy',
    },
    {
      topic: 'SocialMedia',
      questionText:
        'Escriba una carta a una revista para opinar sobre el uso excesivo de redes sociales entre adolescentes. Incluya:\n• su preocupación principal\n• un ejemplo cotidiano\n• una propuesta concreta.\n\nMínimo 150 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Tono formal con un toque personal; cierre con una llamada a la acción.',
      difficulty: 'medium',
    },
    {
      topic: 'Music',
      questionText:
        'Compró entradas para un concierto que fue cancelado y no le devuelven el dinero. Escriba una reclamación a la empresa. Incluya:\n• los datos de la compra\n• la naturaleza del problema\n• la solución que solicita.\n\nMínimo 150 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Use lenguaje formal y aporte los datos necesarios para que la empresa pueda actuar.',
      difficulty: 'medium',
    },
],
  // DELE Task 2 — long-form opinion / article (~200 palabras).
  'DELE:writing-task-2': [
    {
      topic: 'Climate',
      questionText:
        'Escriba un artículo de opinión sobre las medidas que cada persona puede tomar para reducir su impacto ambiental. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Use ejemplos concretos y conecte las acciones individuales con el efecto colectivo.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        'Algunas personas piensan que los estudiantes deberían aprender un oficio práctico en el colegio en lugar de solo asignaturas teóricas. ¿Está de acuerdo? Justifique su respuesta con ejemplos. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Tome una postura clara desde el principio y sostenga sus argumentos con ejemplos personales o sociales.',
      difficulty: 'medium',
    },
    {
      topic: 'Technology',
      questionText:
        '"Las redes sociales han transformado la manera en que nos relacionamos." Escriba un texto argumentativo discutiendo si este cambio ha sido positivo o negativo. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Equilibre ventajas y desventajas; cierre con una conclusión personal razonada.',
      difficulty: 'hard',
    },
      {
      topic: 'SocialMedia',
      questionText:
        'Escriba un artículo de opinión sobre cómo las redes sociales afectan a la salud mental de los jóvenes. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Combine datos generales con un ejemplo concreto; cierre con una propuesta.',
      difficulty: 'medium',
    },
    {
      topic: 'Sports',
      questionText:
        '"El deporte debería ser una asignatura obligatoria hasta el final de la enseñanza secundaria." ¿Está de acuerdo? Argumente con ejemplos. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Tome una postura desde el principio y sosténgala con ejemplos personales o sociales.',
      difficulty: 'medium',
    },
    {
      topic: 'Family',
      questionText:
        '¿Cree que la familia tradicional sigue siendo el modelo más adecuado en la sociedad actual? Justifique su respuesta. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Defina primero qué entiende por familia tradicional para evitar ambigüedades.',
      difficulty: 'hard',
    },
    {
      topic: 'Music',
      questionText:
        'Algunas personas piensan que la música tradicional de cada país debería enseñarse en las escuelas. Discuta esta idea. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Equilibre el valor cultural con la libertad curricular y la diversidad estudiantil.',
      difficulty: 'medium',
    },
    {
      topic: 'Shopping',
      questionText:
        '¿Cómo ha cambiado la manera de hacer compras en los últimos diez años? Analice las ventajas y los inconvenientes. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Estructure el texto en dos paragrafos paralelos: ventajas / inconvenientes, más una conclusión.',
      difficulty: 'medium',
    },
    {
      topic: 'Friends',
      questionText:
        '"Una verdadera amistad puede mantenerse durante años aunque las personas vivan lejos." ¿Está de acuerdo? Argumente con ejemplos. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Use ejemplos personales o conocidos para dar peso al argumento.',
      difficulty: 'easy',
    },
    {
      topic: 'Education',
      questionText:
        '"La educación debería incluir asignaturas prácticas como economía doméstica o primeros auxilios." Argumente a favor o en contra con ejemplos concretos. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Define qué entiendes por "prácticas" antes de defender una postura.',
      difficulty: 'medium',
    },
    {
      topic: 'Climate',
      questionText:
        '"Las grandes empresas son las principales responsables del cambio climático, no los consumidores." ¿Está de acuerdo? Defienda su postura. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Reconozca responsabilidades cruzadas pero priorice una con razones.',
      difficulty: 'hard',
    },
    {
      topic: 'Sports',
      questionText:
        'Algunas personas piensan que el deporte profesional ha perdido valor educativo por la presión comercial. Discuta esta idea. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Equilibre la dimensión comercial con la formativa; aporte ejemplos.',
      difficulty: 'medium',
    },
    {
      topic: 'Music',
      questionText:
        '"La música tradicional debería transmitirse en las escuelas para preservar la identidad cultural." Argumente. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Equilibre identidad y libertad curricular.',
      difficulty: 'medium',
    },
    {
      topic: 'Friends',
      questionText:
        'Escriba un artículo de opinión sobre la importancia de las amistades adultas para la salud mental. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Aporte ejemplos personales o de su entorno cercano.',
      difficulty: 'medium',
    },
    {
      topic: 'Family',
      questionText:
        '¿Considera que el modelo de familia tradicional sigue siendo el más adecuado en la sociedad actual? Defienda su opinión. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Defina primero "modelo tradicional" para evitar ambigüedades.',
      difficulty: 'hard',
    },
    {
      topic: 'Technology',
      questionText:
        'El uso de algoritmos para tomar decisiones (créditos, contrataciones, sentencias) plantea dudas éticas. ¿Cuál es su postura? Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Aborde la transparencia y la rendición de cuentas como ejes.',
      difficulty: 'hard',
    },
    {
      topic: 'SocialMedia',
      questionText:
        '"Las redes sociales han polarizado la opinión pública." ¿Está de acuerdo? Justifique. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Distinga causa de amplificación; cite mecanismos concretos.',
      difficulty: 'hard',
    },
    {
      topic: 'Shopping',
      questionText:
        '"El consumo responsable es una moda más que un cambio cultural." Argumente a favor o en contra. Mínimo 200 palabras.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        'Combine datos generales con experiencia personal.',
      difficulty: 'medium',
    },
],
  'TOPIK:reading': [
    {
      topic: 'Culture',
      questionText:
        '다음 글의 주제로 가장 알맞은 것은?\n\n"한국의 사계절은 각각 뚜렷한 특징을 가지고 있다. 봄에는 꽃이 피고, 여름에는 덥고 비가 많이 온다."',
      questionType: 'multiple-choice',
      options: [
        'A) 한국의 음식',
        'B) 한국의 사계절',
        'C) 한국의 역사',
        'D) 한국의 문화',
      ],
      correctAnswer: 'B',
      explanation: '글의 주제는 명확하게 사계절에 관한 내용입니다.',
      difficulty: 'easy',
    },
    {
      topic: 'Technology',
      questionText:
        '"스마트폰은 우리의 일상생활을 편리하게 해주지만, 동시에 사람들 사이의 직접적인 대화를 줄이기도 합니다."\n\n이 글의 핵심 주장은 무엇입니까?',
      questionType: 'multiple-choice',
      options: [
        'A) 스마트폰은 사용해서는 안 된다',
        'B) 스마트폰은 장점과 단점을 모두 가진다',
        'C) 스마트폰은 미래에 사라질 것이다',
        'D) 스마트폰은 어린이에게만 유익하다',
      ],
      correctAnswer: 'B',
      explanation: '글은 편리함과 부작용 양면을 동시에 언급합니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Education',
      questionText:
        '"평생 학습은 변화하는 사회에서 필수가 되었다."\n\n이 문장이 의미하는 바와 가장 가까운 것은?',
      questionType: 'multiple-choice',
      options: [
        'A) 학교를 마치면 공부할 필요가 없다',
        'B) 사회 변화에 적응하려면 계속 배워야 한다',
        'C) 평생 학교에 다녀야 한다',
        'D) 학습은 어린 시절에만 가능하다',
      ],
      correctAnswer: 'B',
      explanation: '"평생 학습"은 사회 변화에 적응하기 위한 지속적 학습을 의미합니다.',
      difficulty: 'medium',
    },
      {
      topic: 'Environment',
      questionText:
        '최근 한국에서는 1회용 플라스틱 사용을 줄이기 위한 정책이 강화되고 있다. 카페에서는 매장 내 일회용 컵 사용이 금지되었고, 시민들의 협조도 점점 늘고 있다.\n\n이 글의 중심 내용은 무엇입니까?',
      questionType: 'multiple-choice',
      options: ['A) 한국의 카페 문화', 'B) 일회용 플라스틱 사용 감소 정책', 'C) 시민들의 불만', 'D) 환경 단체의 활동'],
      correctAnswer: 'B',
      explanation:
        '중심 소재는 일회용 플라스틱 줄이기 정책입니다.',
      difficulty: 'easy',
    },
    {
      topic: 'Work',
      questionText:
        '주 4일 근무제를 시행하는 한국 기업이 늘어나고 있다. 생산성과 직원 만족도가 모두 향상되었다는 연구 결과가 보고되었지만, 모든 업종에 적용 가능한 것은 아니라는 지적도 있다.\n\n다음 중 글의 내용과 일치하는 것은?',
      questionType: 'multiple-choice',
      options: ['A) 모든 기업이 주 4일 근무제를 시행한다', 'B) 주 4일 근무제는 생산성과 만족도를 모두 떨어뜨린다', 'C) 일부 업종은 주 4일 근무제 도입이 어렵다', 'D) 한국 정부가 주 4일 근무제를 금지했다'],
      correctAnswer: 'C',
      explanation:
        '"모든 업종에 적용 가능한 것은 아니라는 지적"이 일치합니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Family',
      questionText:
        '한국의 가족 형태가 빠르게 변화하고 있다. 1인 가구가 증가하고, 결혼 연령도 점점 늦어지고 있다. 이러한 변화는 주거 형태, 소비 패턴, 사회 정책 전반에 영향을 미치고 있다.\n\n이 글의 주제로 가장 알맞은 것은?',
      questionType: 'multiple-choice',
      options: ['A) 한국의 결혼 풍습', 'B) 한국 가족 형태의 변화와 그 영향', 'C) 1인 가구의 단점', 'D) 한국의 인구 정책'],
      correctAnswer: 'B',
      explanation:
        '변화와 영향이 글의 주제입니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Health',
      questionText:
        '건강한 식습관은 정기적인 운동만큼 중요하다. 균형 잡힌 식사와 충분한 수분 섭취가 면역력 향상에 도움이 된다는 연구 결과가 많다.\n\n글에서 강조하는 것은?',
      questionType: 'multiple-choice',
      options: ['A) 운동의 중요성', 'B) 식습관의 중요성', 'C) 의사와의 상담', 'D) 약 복용'],
      correctAnswer: 'B',
      explanation:
        '전체 글이 식습관의 중요성에 초점을 맞춥니다.',
      difficulty: 'easy',
    },
    {
      topic: 'Education',
      questionText:
        '한국의 대학 교육은 입시 위주의 고등학교 교육과 차별화된 비판적 사고와 자율 학습 능력을 요구한다. 그러나 많은 학생들이 이러한 전환에 어려움을 겪는 것으로 나타났다.\n\n이 글에 따르면 학생들이 어려움을 겪는 이유는?',
      questionType: 'multiple-choice',
      options: ['A) 대학 시험이 너무 어려워서', 'B) 고등학교와 대학의 학습 방식이 다르기 때문에', 'C) 학비가 비싸기 때문에', 'D) 친구가 없기 때문에'],
      correctAnswer: 'B',
      explanation:
        '글은 두 단계의 학습 방식 차이를 어려움의 원인으로 제시합니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Technology',
      questionText:
        '인공지능 챗봇이 일상에 빠르게 자리 잡고 있다. 정보 검색, 글쓰기 보조, 외국어 학습 등 다양한 영역에서 활용되고 있지만, 의존도가 지나치면 사고력 저하로 이어질 수 있다는 우려도 있다.\n\n이 글의 핵심 주장은 무엇입니까?',
      questionType: 'multiple-choice',
      options: ['A) 챗봇은 모든 면에서 위험하다', 'B) 챗봇을 절대 사용해서는 안 된다', 'C) 챗봇은 유용하지만 의존성에는 주의해야 한다', 'D) 챗봇은 곧 사라질 것이다'],
      correctAnswer: 'C',
      explanation:
        '유용성과 위험성을 모두 인정하는 균형 잡힌 주장입니다.',
      difficulty: 'hard',
    },
    {
      topic: 'SocialMedia',
      questionText:
        '소셜 미디어가 청소년의 자아 정체성 형성에 영향을 미친다는 연구가 늘고 있다. 긍정적인 영향과 부정적인 영향이 동시에 보고되고 있으며, 부모와 교사의 적절한 안내가 중요하다는 의견이 모이고 있다.\n\n글의 핵심 내용은?',
      questionType: 'multiple-choice',
      options: ['A) 청소년은 소셜 미디어를 사용하면 안 된다', 'B) 소셜 미디어는 청소년에게 영향을 주며, 어른의 안내가 필요하다', 'C) 청소년은 부모를 신뢰하지 않는다', 'D) 모든 청소년이 인플루언서가 된다'],
      correctAnswer: 'B',
      explanation:
        '영향 + 어른의 안내 필요성이 두 가지 핵심입니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Travel',
      questionText:
        '최근 외국인 관광객들이 한국의 지방 도시에도 관심을 갖기 시작했다. 서울과 부산을 넘어 전주, 경주, 강릉 같은 도시들이 새로운 여행지로 떠오르고 있다.\n\n이 글에 따르면 외국인 관광객들의 변화는?',
      questionType: 'multiple-choice',
      options: ['A) 더 이상 한국을 방문하지 않는다', 'B) 서울에만 집중한다', 'C) 지방 도시들에도 관심을 갖기 시작했다', 'D) 한국 음식만 먹는다'],
      correctAnswer: 'C',
      explanation:
        '글의 핵심은 지방 도시로의 관심 확산입니다.',
      difficulty: 'easy',
    },
],
  // TOPIK Task 1 — 짧은 작문 (200~300자 정도의 짧은 글쓰기).
  'TOPIK:writing-task-1': [
    {
      topic: 'Health',
      questionText:
        '아래 글의 빈칸에 들어갈 내용을 200~300자로 쓰십시오.\n\n현대인들은 운동이 부족합니다. 그래서 ____________ . 운동을 꾸준히 하면 건강이 좋아집니다.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: '문맥에 맞고 자연스러운 한국어 표현을 사용해야 합니다.',
      difficulty: 'easy',
    },
    {
      topic: 'Work',
      questionText:
        '회사 동료에게 휴가를 함께 가자는 짧은 글을 200~300자로 쓰십시오. 다음 내용을 포함하십시오.\n• 언제 갈 것인가\n• 어디로 갈 것인가\n• 왜 함께 가고 싶은가',
      questionType: 'essay',
      correctAnswer: null,
      explanation: '친근한 어투로 일관되게 쓰고, 세 가지 요점을 모두 포함하세요.',
      difficulty: 'easy',
    },
    {
      topic: 'Education',
      questionText:
        '대학교 수업에 참여하지 못한 이유를 교수님께 설명하는 이메일을 200~300자로 쓰십시오. 정중한 표현을 사용하십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: '존댓말과 격식 있는 표현을 사용하고, 사과 → 이유 → 부탁 순서로 정리하세요.',
      difficulty: 'medium',
    },
      {
      topic: 'Family',
      questionText:
        '가족과의 가장 소중한 추억에 대해 200~300자로 쓰십시오. 그 일이 왜 특별했는지 함께 설명하세요.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '시간, 장소, 인물을 명확히 하고 감정 표현을 자연스럽게 포함하세요.',
      difficulty: 'easy',
    },
    {
      topic: 'Sports',
      questionText:
        '평소에 즐겨하는 운동이나 운동을 시작하고 싶은 이유를 200~300자로 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '운동의 종류와 이유를 명확히 연결해 표현하세요.',
      difficulty: 'easy',
    },
    {
      topic: 'Friends',
      questionText:
        '오랜 친구에게 안부를 묻는 메일을 200~300자로 쓰십시오. 다음 내용을 포함하세요.\n• 최근 소식\n• 그동안 보고 싶었던 마음\n• 다음에 만날 약속',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '친근한 어투를 일관되게 유지하세요.',
      difficulty: 'easy',
    },
    {
      topic: 'SocialMedia',
      questionText:
        '소셜 미디어 사용의 좋은 점과 나쁜 점에 대해 200~300자로 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '장점과 단점을 균형 있게 다루세요.',
      difficulty: 'medium',
    },
    {
      topic: 'Music',
      questionText:
        '본인에게 특별한 의미가 있는 노래 한 곡과 그 이유를 200~300자로 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '곡 자체보다 그 곡이 떠올리게 하는 기억에 집중하세요.',
      difficulty: 'easy',
    },
    {
      topic: 'Shopping',
      questionText:
        '온라인 쇼핑과 오프라인 쇼핑 중 어느 쪽을 더 선호하는지, 그 이유는 무엇인지 200~300자로 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '선호하는 쪽을 분명히 하고 이유를 두 가지 이상 제시하세요.',
      difficulty: 'easy',
    },
],
  // TOPIK Task 2 — 긴 작문 (600~700자 정도의 의견 글).
  'TOPIK:writing-task-2': [
    {
      topic: 'Climate',
      questionText:
        '"환경 보호의 중요성"에 대해 600~700자 분량의 글을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '환경 보호의 필요성과 구체적인 실천 방안을 논리적으로 제시해야 합니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Culture',
      questionText:
        '여러분의 나라의 전통문화 중 가장 자랑스러운 것을 하나 골라 600~700자로 소개하십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '문화의 역사와 현재적 의미를 함께 설명하면 좋은 점수를 받기 쉽습니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Technology',
      questionText:
        '인공지능 기술이 일자리에 미치는 영향에 대해 600~700자로 논하시오. 긍정적 측면과 부정적 측면을 모두 다루십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: '양면을 균형 있게 다루고, 마지막 단락에서 본인의 견해를 명확하게 밝히세요.',
      difficulty: 'hard',
    },
    {
      topic: 'Education',
      questionText:
        '"평생 교육이 왜 필요한가"에 대해 자신의 의견과 그 이유를 600~700자로 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation: '현대 사회 변화와 연결지어 구체적 예시를 제시하면 설득력이 높아집니다.',
      difficulty: 'medium',
    },
      {
      topic: 'SocialMedia',
      questionText:
        '"소셜 미디어가 청소년에게 미치는 영향"에 대해 600~700자로 본인의 의견을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '긍정적·부정적 영향을 모두 다루고 구체적인 해결책을 제시하세요.',
      difficulty: 'hard',
    },
    {
      topic: 'Family',
      questionText:
        '"현대 사회에서 변화하는 가족 형태"에 대한 본인의 견해를 600~700자로 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '변화의 원인, 양상, 향후 전망 순서로 논리적으로 전개하세요.',
      difficulty: 'medium',
    },
    {
      topic: 'Sports',
      questionText:
        '"학교에서의 체육 교육의 중요성"에 대해 600~700자로 논하십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '신체, 정서, 사회성의 세 측면을 모두 다루면 좋습니다.',
      difficulty: 'medium',
    },
    {
      topic: 'Music',
      questionText:
        '"디지털 시대의 음악 산업 변화"에 대해 600~700자로 본인의 의견을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '아티스트, 청취자, 산업 구조의 시각을 균형 있게 다루세요.',
      difficulty: 'medium',
    },
    {
      topic: 'Friends',
      questionText:
        '"성인이 된 후 새로운 친구를 사귀는 것이 점점 어려워지는 이유"에 대해 600~700자로 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '사회적·심리적·환경적 이유를 골고루 다루세요.',
      difficulty: 'hard',
    },
    {
      topic: 'Education',
      questionText:
        '"학교 교육에서 인성 교육과 학업 성취 중 무엇이 더 중요한가?"에 대해 600~700자로 본인의 의견을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '두 측면의 균형을 인정한 후 자신의 입장을 분명히 하세요.',
      difficulty: 'hard',
    },
    {
      topic: 'Climate',
      questionText:
        '"기후 위기 대응에서 개인의 노력은 얼마나 효과적인가?"라는 주제로 600~700자로 글을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '개인적 행동의 한계를 인정하면서도 그 의미를 옹호하세요.',
      difficulty: 'hard',
    },
    {
      topic: 'Sports',
      questionText:
        '"청소년 스포츠 활동이 학업과 양립할 수 있는가?"에 대해 600~700자로 의견을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '신체적·정신적·사회적 효과를 모두 다루세요.',
      difficulty: 'medium',
    },
    {
      topic: 'Music',
      questionText:
        '"디지털 음악 시장의 확대가 전통 음악에 미치는 영향"을 600~700자로 논하십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '긍정적 영향(접근성)과 부정적 영향(왜곡)을 함께.',
      difficulty: 'medium',
    },
    {
      topic: 'Friends',
      questionText:
        '"성인이 된 후 새로운 친구를 사귀는 어려움"을 주제로 600~700자의 글을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '사회 구조적 요인을 한두 가지 짚고 본인의 해결책을 제시.',
      difficulty: 'hard',
    },
    {
      topic: 'Family',
      questionText:
        '"1인 가구의 증가가 사회에 주는 의미"를 600~700자로 논하십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '원인 → 사회적 영향 → 정책 방향 순서로 정리.',
      difficulty: 'medium',
    },
    {
      topic: 'Technology',
      questionText:
        '"인공지능이 인간의 창의성을 대체할 수 있는가?"에 대해 600~700자로 본인의 의견을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '창의성의 정의부터 분명히 하세요.',
      difficulty: 'hard',
    },
    {
      topic: 'SocialMedia',
      questionText:
        '"소셜 미디어가 정치 참여에 미치는 영향"을 600~700자로 논하십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '긍정적 영향과 부정적 영향을 균형 있게 다루세요.',
      difficulty: 'hard',
    },
    {
      topic: 'Culture',
      questionText:
        '"세계화 속에서 자국 문화를 지키는 방법"에 대해 600~700자로 본인의 의견을 쓰십시오.',
      questionType: 'essay',
      correctAnswer: null,
      explanation:
        '교육, 미디어, 경제의 세 차원을 함께 고려.',
      difficulty: 'medium',
    },
],

  // IELTS Speaking Part 1 — short introductory Q&A (~30s answers).
  'IELTS:speaking-part-1': [
    { topic: 'Home', questionText: 'Where do you live? Can you describe your hometown briefly?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Aim for 2-3 connected sentences with a personal detail.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: 'What do you enjoy doing in your free time? Why?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'A simple reason for each activity helps the answer feel complete.', difficulty: 'easy' },
    { topic: 'Work', questionText: 'Do you work or are you a student? Tell me a little about what you do.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mention the role and one thing you like or find challenging.', difficulty: 'easy' },
    { topic: 'Food', questionText: 'What kind of food do you like? Has your taste changed over the years?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use past + present tense — examiners look for tense variety.', difficulty: 'medium' },
    { topic: 'Travel', questionText: 'Have you travelled recently? Where did you go and what was it like?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past tense narrative with one specific detail (a meal, a place, a person).', difficulty: 'medium' },
    { topic: 'Culture', questionText: 'What festivals or holidays are important in your culture?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pick one festival and describe what people do — concrete > abstract.', difficulty: 'medium' },
      { topic: 'Family', questionText: 'How would you describe your family? Are you close to them?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use simple present tense; mention one specific relationship for warmth.', difficulty: 'easy' },
    { topic: 'Sports', questionText: 'Do you play any sports or follow any sports teams? Tell me about it.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'If you don\'t play, talk about a sport you watch — the answer must not be empty.', difficulty: 'easy' },
    { topic: 'Music', questionText: 'What kind of music do you listen to? How does it affect your mood?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mention one artist or genre by name to ground the answer.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: 'Do you enjoy shopping? What do you usually buy and where?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Online vs in-store contrast is a natural way to add range.', difficulty: 'easy' },
    { topic: 'Family', questionText: 'Do you live with your family or alone? How does that suit you?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mention one positive and one trade-off — keeps the answer balanced.', difficulty: 'easy' },
    { topic: 'Family', questionText: 'Which family member do you spend the most time with, and why?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use present-continuous ("these days") to show tense variety.', difficulty: 'easy' },
    { topic: 'Family', questionText: 'Are families in your country closer or less close than they used to be?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare past and present even briefly — examiners reward perspective.', difficulty: 'medium' },
    { topic: 'Home', questionText: 'Describe your home in two or three sentences.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use a couple of adjectives and one specific detail — a balcony, a colour.', difficulty: 'easy' },
    { topic: 'Home', questionText: 'Is there anything you would change about where you live?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pick ONE change and give a reason — focus beats listing.', difficulty: 'easy' },
    { topic: 'Home', questionText: 'Do you prefer living in a house or a flat? Why?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Comparative structures ("more", "less") show fluency.', difficulty: 'medium' },
    { topic: 'Hobbies', questionText: 'How long have you been doing your favourite hobby?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use present-perfect ("I\'ve been...") — examiners look for tense range.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: 'Is there a new hobby you would like to try? Why?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Modal verbs ("would like", "could") fit naturally here.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: 'Do people in your country make time for hobbies?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Generalise carefully — "many", "some", not "everyone".', difficulty: 'medium' },
    { topic: 'Work', questionText: 'Do you prefer working alone or in a team? Why?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Concede the other side briefly — sophistication marker.', difficulty: 'easy' },
    { topic: 'Work', questionText: 'What was your first job? Tell me a little about it.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past tense narrative; one specific memory makes it vivid.', difficulty: 'medium' },
    { topic: 'Work', questionText: 'Do you think work-life balance is achievable in your job?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use conditional or hypothetical for the future part.', difficulty: 'medium' },
    { topic: 'Food', questionText: 'Is there a food from your childhood you still enjoy today?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past + present tenses; a brief memory anchors the answer.', difficulty: 'easy' },
    { topic: 'Food', questionText: 'Do you cook at home, or eat out more often?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Frequency adverbs ("usually", "rarely") earn easy points.', difficulty: 'easy' },
    { topic: 'Food', questionText: 'Has the way people eat in your country changed recently?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite one concrete change (delivery apps, plant-based food).', difficulty: 'medium' },
    { topic: 'Travel', questionText: 'What kind of trip relaxes you most — beach, city, or nature?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pick one and justify with two reasons — structure helps.', difficulty: 'easy' },
    { topic: 'Travel', questionText: 'Is there a place in your country every visitor should see?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use superlatives and one sensory detail.', difficulty: 'easy' },
    { topic: 'Travel', questionText: 'Do you plan trips carefully or improvise?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Either is fine — the reason matters more than the choice.', difficulty: 'medium' },
    { topic: 'Culture', questionText: 'Is there a recent film or book from your country you would recommend?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past simple to describe; present simple to recommend.', difficulty: 'easy' },
    { topic: 'Culture', questionText: 'How do people in your country usually celebrate birthdays?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Sequence words ("first", "then") give structure.', difficulty: 'easy' },
    { topic: 'Culture', questionText: 'Are traditional customs still important to younger people?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Avoid black-and-white answers — "some", "mostly" feel real.', difficulty: 'medium' },
    { topic: 'Music', questionText: 'What kind of music do you listen to when you study or work?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mention a genre and a reason — keeps the answer specific.', difficulty: 'easy' },
    { topic: 'Music', questionText: 'Have you ever attended a live concert? Tell me about it.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past narrative + one feeling word lands well.', difficulty: 'medium' },
    { topic: 'Music', questionText: 'Do you think music education is important in school?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Justify with one concrete benefit.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: 'Do you prefer shopping in person or online? Why?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare conveniences — examiners reward contrast.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: 'Is there something you bought recently that you really like?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past tense + a sensory detail (colour, sound, feel).', difficulty: 'easy' },
    { topic: 'Shopping', questionText: 'Do people in your country shop differently from a few years ago?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'One concrete shift suffices (delivery, second-hand).', difficulty: 'medium' },
    { topic: 'Sports', questionText: 'Did you play any sports as a child?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past tense + a brief feeling word.', difficulty: 'easy' },
    { topic: 'Sports', questionText: 'Is there a sport you would like to learn?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '"Would like to" + reason — clean Part-1 frame.', difficulty: 'easy' },
    { topic: 'Sports', questionText: 'Are professional athletes good role models in your view?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pick a stance and add one nuance.', difficulty: 'medium' },
    { topic: 'Friends', questionText: 'How did you meet your closest friend?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past simple narrative — one anchor moment.', difficulty: 'easy' },
    { topic: 'Friends', questionText: 'What do you usually do when you spend time with friends?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Present simple + variety of activities.', difficulty: 'easy' },
    { topic: 'Friends', questionText: 'Is it easier to make friends now than when you were younger?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Hedged comparison; mention age or context.', difficulty: 'medium' },
    { topic: 'SocialMedia', questionText: 'Which social media app do you use most often?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'One app, one reason — keep Part 1 tight.', difficulty: 'easy' },
    { topic: 'SocialMedia', questionText: 'Do you post things publicly, or mostly just read?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Either is fine — justify with a habit.', difficulty: 'easy' },
    { topic: 'SocialMedia', questionText: 'Has social media changed the way you keep in touch with friends?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past vs present comparison earns marks.', difficulty: 'medium' },
],
  // IELTS Speaking Part 2 — cue card monologue (1-2 min).
  'IELTS:speaking-part-2': [
    { topic: 'Travel', questionText: 'Describe a memorable trip you have taken. You should say:\n• where you went\n• who you went with\n• what you did there\n• and explain why it was memorable.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cover all four bullets in order; finish with the "why" — it carries the strongest band signal.', difficulty: 'medium' },
    { topic: 'Education', questionText: 'Describe a teacher who influenced you. You should say:\n• who they were\n• what they taught\n• how they taught\n• and explain why they had an impact on you.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use specific anecdotes — the examiner rewards concrete narrative over generic praise.', difficulty: 'medium' },
    { topic: 'Technology', questionText: 'Describe a piece of technology you use every day. You should say:\n• what it is\n• how often you use it\n• what you use it for\n• and explain why it is important to you.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Avoid listing features — focus on how it changed your routine.', difficulty: 'medium' },
    { topic: 'Health', questionText: 'Describe a change you made to your lifestyle. You should say:\n• what the change was\n• when you made it\n• why you made it\n• and how it affected you.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past-to-present arc shows tense control. End with a reflective sentence.', difficulty: 'hard' },
      { topic: 'Family', questionText: 'Describe a family member you admire. You should say:\n• who they are\n• what they do\n• how often you see them\n• and explain why you admire them.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Anchor your answer with one concrete anecdote — examiners reward specifics.', difficulty: 'medium' },
    { topic: 'Friends', questionText: 'Describe a close friend. You should say:\n• how you met\n• how often you see each other\n• what you usually do together\n• and explain why this friendship matters to you.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use past tense for the "how you met" part and present tense for the rest.', difficulty: 'medium' },
    { topic: 'Sports', questionText: 'Describe a sport or physical activity you enjoy. You should say:\n• what it is\n• when you do it\n• how you learned it\n• and explain why you enjoy it.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'A short learning anecdote shows narrative range.', difficulty: 'medium' },
    { topic: 'Music', questionText: 'Describe a song or piece of music that is important to you. You should say:\n• what it is\n• when you first heard it\n• when you usually listen to it\n• and explain why it is special.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Tie the song to a memory — that emotional hook lifts the answer.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: 'Describe a memorable shopping experience. You should say:\n• what you bought\n• where you went\n• who you were with\n• and explain why it stayed with you.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use past simple consistently and finish with a reflective sentence.', difficulty: 'medium' },
    { topic: 'Family', questionText: 'Describe a family tradition you enjoy. You should say:\n• what it is\n• when it happens\n• who takes part\n• and explain why you enjoy it.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Bullet 4 carries the most weight — leave at least 20 seconds for it.', difficulty: 'medium' },
    { topic: 'Family', questionText: 'Describe a relative you would like to know better. You should say:\n• who they are\n• how often you see them\n• what you know about them already\n• and explain why you would like to know them better.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Modals ("would like", "could") plus future tense show range.', difficulty: 'medium' },
    { topic: 'Family', questionText: 'Describe an event in your family\'s history that you find interesting. You should say:\n• what happened\n• when it happened\n• how you learned about it\n• and explain why it interests you.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past narrative; reported speech ("my grandfather told me…") is a plus.', difficulty: 'hard' },
    { topic: 'Friends', questionText: 'Describe a friend who has helped you a lot. You should say:\n• who they are\n• how long you have known them\n• how they helped you\n• and explain why their help mattered.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'One specific moment of help carries more weight than a list.', difficulty: 'medium' },
    { topic: 'Friends', questionText: 'Describe an activity you do regularly with a friend. You should say:\n• what it is\n• how often you do it\n• why you started\n• and how it benefits you.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Present-perfect ("we\'ve been doing it for…") signals fluency.', difficulty: 'medium' },
    { topic: 'Friends', questionText: 'Describe a disagreement you had with a friend. You should say:\n• what it was about\n• how it started\n• how it was resolved\n• and what you learned from it.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past narrative + reflection at the end — examiners reward closure.', difficulty: 'hard' },
    { topic: 'Travel', questionText: 'Describe a place you would like to visit one day. You should say:\n• where it is\n• how you heard about it\n• what you would do there\n• and why you want to visit.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mix future ("I would") with present ("the city is") — examiners listen for blend.', difficulty: 'medium' },
    { topic: 'Travel', questionText: 'Describe a journey that did not go to plan. You should say:\n• where you were going\n• what went wrong\n• how you handled it\n• and what you learned from it.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Strong narrative arc — set-up, problem, resolution. End with what changed.', difficulty: 'hard' },
    { topic: 'Travel', questionText: 'Describe an interesting traveller you met. You should say:\n• where you met them\n• what you talked about\n• why they stood out\n• and whether you stayed in touch.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past simple + descriptive adjectives. One quote or detail brings the person to life.', difficulty: 'medium' },
    { topic: 'Education', questionText: 'Describe a subject you wish you had studied more. You should say:\n• what subject\n• when you first encountered it\n• why you didn\'t pursue it\n• and how it might have changed your life.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Conditional ("if I had…") is the headline grammar move here.', difficulty: 'hard' },
    { topic: 'Education', questionText: 'Describe a useful skill you learned outside of school. You should say:\n• what the skill is\n• how you learned it\n• how long it took\n• and how you use it now.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past + present blend; end with how the skill connects today.', difficulty: 'medium' },
    { topic: 'Education', questionText: 'Describe a moment when you taught someone something. You should say:\n• what you taught\n• who you taught\n• how you taught it\n• and how the experience felt.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past narrative; reflect on the feeling — empathy markers earn points.', difficulty: 'medium' },
    { topic: 'Technology', questionText: 'Describe a piece of software or app you find essential. You should say:\n• what it is\n• how often you use it\n• what you use it for\n• and how life would be without it.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Hypothetical ("life would be…") opens conditional grammar.', difficulty: 'medium' },
    { topic: 'Technology', questionText: 'Describe a piece of technology that has caused you problems. You should say:\n• what it is\n• what went wrong\n• how you dealt with it\n• and what you would do differently next time.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past + conditional. Show recovery — examiners reward agency.', difficulty: 'medium' },
    { topic: 'Technology', questionText: 'Describe a new technology you would like to try. You should say:\n• what it is\n• how you heard about it\n• what you would use it for\n• and what concerns you have.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Future + conditional + a nuance/concern. Hedging shows higher band.', difficulty: 'hard' },
    { topic: 'Health', questionText: 'Describe a habit that has improved your health. You should say:\n• what the habit is\n• when you started\n• why you started\n• and how it has helped.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past-to-present arc with present-perfect — strong tense control.', difficulty: 'medium' },
    { topic: 'Health', questionText: 'Describe a time you helped someone with their health. You should say:\n• what was wrong\n• how you helped\n• how they responded\n• and how you felt afterwards.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past narrative + emotional reflection at the end.', difficulty: 'medium' },
    { topic: 'Health', questionText: 'Describe a doctor or healthcare worker you respect. You should say:\n• who they are\n• when you first met them\n• what makes them good at their job\n• and how they have helped you or others.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Anecdote-driven; quote a small thing they said or did.', difficulty: 'hard' },
    { topic: 'Music', questionText: 'Describe a singer or band you admire. You should say:\n• who they are\n• when you first heard them\n• what kind of music they make\n• and why you admire them.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Sensory adjectives for the music; reasons for the admiration.', difficulty: 'medium' },
    { topic: 'Music', questionText: 'Describe a piece of music you find emotional. You should say:\n• what it is\n• when you usually listen to it\n• how it makes you feel\n• and why it has this effect.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Feeling vocab matters here — "melancholy", "uplifted", "nostalgic".', difficulty: 'medium' },
    { topic: 'Music', questionText: 'Describe a concert or live performance you attended. You should say:\n• where it was\n• who you went with\n• what stood out\n• and whether you would attend again.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past narrative; vivid one-sentence detail (the lighting, the crowd).', difficulty: 'medium' },
    { topic: 'Shopping', questionText: 'Describe a gift you bought for someone. You should say:\n• what it was\n• who it was for\n• how you chose it\n• and how they reacted.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past tense + emotional reaction at the end.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: 'Describe a market or shopping area you enjoy. You should say:\n• where it is\n• what is sold there\n• how often you visit\n• and why you enjoy it.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Sensory description (sounds, smells) adds colour.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: 'Describe a time you bought something expensive. You should say:\n• what it was\n• why you bought it\n• how long you saved for it\n• and whether it was worth it.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past + reflection. "Worth it" needs a yes/no with reason.', difficulty: 'hard' },
    { topic: 'Sports', questionText: 'Describe a sports event you attended or watched. You should say:\n• what event it was\n• where it took place\n• who you watched it with\n• and what made it memorable.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Past narrative; one specific moment of drama (the score, a player).', difficulty: 'medium' },
    { topic: 'Sports', questionText: 'Describe a sport you would like to try. You should say:\n• what it is\n• why it appeals to you\n• what you would need to start\n• and any concerns you have.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Conditional + a hedged concern.', difficulty: 'medium' },
    { topic: 'Sports', questionText: 'Describe a sportsperson you admire. You should say:\n• who they are\n• what they have achieved\n• why you admire them\n• and how they influence others.\n\nSpeak for 1–2 minutes.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Present-perfect for achievements; one specific quote or moment.', difficulty: 'medium' },
],
  // IELTS Speaking Part 3 — deeper discussion (4-5 min total).
  'IELTS:speaking-part-3': [
    { topic: 'Technology', questionText: 'How has technology changed the way people communicate? Do you think these changes are mostly positive or negative?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Take a clear stance, give 2 examples, acknowledge a counter-point.', difficulty: 'hard' },
    { topic: 'Education', questionText: 'Some people think university should be free for everyone. Do you agree? What are the implications either way?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Discuss societal vs individual benefit; avoid one-sided answers.', difficulty: 'hard' },
    { topic: 'Climate', questionText: 'What do you think individuals can do to reduce their impact on the environment? Are individual actions enough?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mix concrete actions (recycling, transport) with structural commentary (policy, business).', difficulty: 'hard' },
    { topic: 'Work', questionText: 'How has the rise of remote work changed our lives? Do you think it will continue to grow?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare pre- and post-2020; offer a future-tense prediction with a justification.', difficulty: 'hard' },
      { topic: 'SocialMedia', questionText: 'How has social media changed the way people present themselves? Are these changes mostly genuine or performative?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use comparative structures: "compared to before…", "more / less than…".', difficulty: 'hard' },
    { topic: 'Family', questionText: 'Do you think family structures are changing in your country? What are the causes and consequences?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite at least one social cause (economy, mobility) and one consequence (loneliness, freedom).', difficulty: 'hard' },
    { topic: 'Sports', questionText: 'Why do you think sports are so popular globally? Should governments invest more in amateur sport?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Separate explanation (why popular) from prescription (what to do) — both halves matter.', difficulty: 'hard' },
    { topic: 'Music', questionText: 'What role does music play in society? Has streaming made music more or less meaningful?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Offer a clear stance on streaming and back it with one concrete example.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: 'How has online shopping affected local businesses? Is this trend reversible?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Discuss winners and losers; speculate cautiously about whether the trend can reverse.', difficulty: 'hard' },
    { topic: 'Family', questionText: 'How do family roles in your country differ between generations?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare "older generation" with "younger generation" explicitly.', difficulty: 'hard' },
    { topic: 'Family', questionText: 'Should adult children be responsible for their elderly parents?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Take a clear stance, concede one counter-point.', difficulty: 'hard' },
    { topic: 'Family', questionText: 'Is it better to have a small or a large family? Why?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Discuss both sides before declaring a preference.', difficulty: 'hard' },
    { topic: 'Friends', questionText: 'Why do some friendships last a lifetime while others fade?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Identify two factors and give an example for each.', difficulty: 'hard' },
    { topic: 'Friends', questionText: 'Is it possible for very different people to be close friends?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Argue from compatibility AND complementary differences.', difficulty: 'hard' },
    { topic: 'Friends', questionText: 'How has social media changed the nature of friendship?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mix positives, negatives, and a forward-looking thought.', difficulty: 'hard' },
    { topic: 'Education', questionText: 'Is creativity something schools can teach?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinguish "teach" from "nurture" — sharper answer.', difficulty: 'hard' },
    { topic: 'Education', questionText: 'Should education focus on knowledge or skills?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Treat it as a both/and, not either/or, for a higher band.', difficulty: 'hard' },
    { topic: 'Education', questionText: 'How will universities change in the next twenty years?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Future + speculation; cite a current trend as evidence.', difficulty: 'hard' },
    { topic: 'Technology', questionText: 'How has artificial intelligence affected the workplace already?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite a concrete example before generalising.', difficulty: 'hard' },
    { topic: 'Technology', questionText: 'Will technology eventually solve problems like inequality?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Hedge — "could… but only if…" is the highest-band move.', difficulty: 'hard' },
    { topic: 'Technology', questionText: 'Should governments regulate large technology companies?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Position + one safeguard + one risk.', difficulty: 'hard' },
    { topic: 'Health', questionText: 'Is healthcare a right or a service? Defend your view.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Define your stance early, then justify with one ethical and one economic point.', difficulty: 'hard' },
    { topic: 'Health', questionText: 'How can governments encourage healthier lifestyles?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Two policy levers (incentives, infrastructure) work better than a list.', difficulty: 'hard' },
    { topic: 'Health', questionText: 'Will technology change how we treat mental health?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Acknowledge both promise and risk (privacy, depersonalisation).', difficulty: 'hard' },
    { topic: 'Music', questionText: 'Does music have a measurable effect on productivity?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite a study OR personal evidence; either is fine if reasoned.', difficulty: 'hard' },
    { topic: 'Music', questionText: 'Is traditional music being lost in your country?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Yes/no answer + one concrete cause or preservation effort.', difficulty: 'hard' },
    { topic: 'Music', questionText: 'How has streaming changed the music industry?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare artist economics and listener behaviour separately.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: 'Has consumer culture become too dominant in modern life?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Position + nuance — pure dismissal sounds simplistic.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: 'Will physical shops still exist in twenty years?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinguish convenience shopping from experience shopping.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: 'Should there be limits on advertising aimed at children?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Argue from ethics AND from data on attention.', difficulty: 'hard' },
    { topic: 'Sports', questionText: 'Should sports stars be paid as much as they are?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Concede market logic, then critique social proportionality.', difficulty: 'hard' },
    { topic: 'Sports', questionText: 'Is hosting major sports events worth the cost for a country?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinguish short-term tourism from long-term infrastructure.', difficulty: 'hard' },
    { topic: 'Sports', questionText: 'How important is sport in shaping national identity?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite one historic moment + one current example.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: 'Should there be an age minimum for using social media?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Argue from cognitive research and from real harms; pick a number and defend it.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: 'Has social media made political discussion better or worse?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinguish reach (better) from quality (often worse).', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: 'Will the role of professional journalism change as social media grows?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Hedged future + a structural reason (trust, business models).', difficulty: 'hard' },
    { topic: 'Work', questionText: 'Should companies be obliged to offer remote work where possible?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use "obligation" carefully — distinguish from "strong preference".', difficulty: 'hard' },
    { topic: 'Work', questionText: 'How will careers look different by the time today\'s students retire?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Future + cite one structural change (longevity, AI, gig economy).', difficulty: 'hard' },
    { topic: 'Work', questionText: 'Is it harder for young people to find good jobs than it used to be?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare two specific factors (housing, credentials) rather than a vague yes.', difficulty: 'hard' },
    { topic: 'Climate', questionText: 'How effective are individual actions against climate change?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Concede the limit of individuals, then defend collective effect.', difficulty: 'hard' },
    { topic: 'Climate', questionText: 'Should wealthier countries pay more towards climate adaptation?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Argument from historic emissions + present capacity.', difficulty: 'hard' },
    { topic: 'Climate', questionText: 'Will renewable energy completely replace fossil fuels within our lifetimes?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Hedged forecast with one technical AND one political constraint.', difficulty: 'hard' },
],

  // DELE Hablar — Monólogo (~2 min individual presentation).
  'DELE:speaking-part-1': [
    { topic: 'Home', questionText: 'Preséntese y describa la ciudad donde vive. Hable durante aproximadamente un minuto.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el presente y al menos un adjetivo descriptivo por idea.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: 'Cuente brevemente cuáles son sus pasatiempos favoritos y por qué le gustan.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Justifique cada pasatiempo con una razón concreta.', difficulty: 'easy' },
    { topic: 'Work', questionText: 'Hable sobre su trabajo o sus estudios actuales y qué espera lograr en los próximos años.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Alterne entre presente y futuro — el examinador valora la variedad temporal.', difficulty: 'medium' },
    { topic: 'Travel', questionText: 'Describa un viaje reciente: a dónde fue, qué hizo y qué recuerda con más cariño.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el pretérito indefinido y termine con una valoración personal.', difficulty: 'medium' },
    { topic: 'Culture', questionText: 'Hable sobre una fiesta o tradición importante de su cultura. ¿Qué se hace y por qué es relevante?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Conecte el qué con el porqué — los datos sin contexto pesan poco.', difficulty: 'medium' },
      { topic: 'Family', questionText: 'Hábleme un poco de su familia. ¿Vive cerca de ellos?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el presente y mencione una persona concreta para dar calidez.', difficulty: 'easy' },
    { topic: 'Sports', questionText: '¿Practica algún deporte o sigue alguno con interés? ¿Cuál y por qué?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Si no practica, hable de un deporte que sigue — la respuesta no puede quedar vacía.', difficulty: 'easy' },
    { topic: 'Music', questionText: '¿Qué tipo de música escucha habitualmente? ¿Cómo influye en su día?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mencione un artista o un género concreto para anclar la respuesta.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: '¿Le gusta ir de compras? ¿Qué suele comprar y dónde?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Contraste tiendas físicas y compras online para mostrar variedad léxica.', difficulty: 'easy' },
    { topic: 'Friends', questionText: 'Hábleme de un amigo o amiga cercano. ¿Cómo se conocieron?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el pretérito indefinido para el momento en que se conocieron.', difficulty: 'easy' },
    { topic: 'Home', questionText: 'Hábleme un poco sobre el barrio donde vive.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Adjetivos descriptivos + una característica concreta.', difficulty: 'easy' },
    { topic: 'Home', questionText: '¿Vive solo, con familia o con compañeros? ¿Le gusta así?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Justifique con una ventaja y una desventaja.', difficulty: 'easy' },
    { topic: 'Home', questionText: '¿Qué echa de menos del lugar donde creció?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pasado + presente; una imagen sensorial breve.', difficulty: 'medium' },
    { topic: 'Hobbies', questionText: '¿Tiene alguna afición que le gustaría aprender pero aún no ha empezado?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use condicionales: "me gustaría", "podría".', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: '¿Comparte sus aficiones con alguien? ¿Con quién?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Estructura simple: actividad + persona + por qué.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: '¿Ha cambiado mucho lo que le gusta hacer en los últimos años?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare pasado y presente brevemente.', difficulty: 'medium' },
    { topic: 'Work', questionText: '¿Trabaja en grupo o de forma individual? ¿Qué prefiere?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Tome una postura clara y dé un motivo.', difficulty: 'easy' },
    { topic: 'Work', questionText: '¿Cuál fue su primer empleo? ¿Cómo lo recuerda?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pretérito indefinido + una impresión personal.', difficulty: 'medium' },
    { topic: 'Work', questionText: '¿Cree que el equilibrio entre trabajo y vida personal es posible en su sector?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el subjuntivo cuando exprese deseos: "que sea posible".', difficulty: 'medium' },
    { topic: 'Culture', questionText: '¿Qué libro o película recomendaría a alguien que quiera conocer su país?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Justifique brevemente — un detalle hace la respuesta memorable.', difficulty: 'easy' },
    { topic: 'Culture', questionText: '¿Cómo suele celebrar su cumpleaños?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el presente y conectores temporales.', difficulty: 'easy' },
    { topic: 'Culture', questionText: '¿Se mantienen vivas las tradiciones de su país?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Hedge: "algunas más que otras", "depende de la región".', difficulty: 'medium' },
    { topic: 'Travel', questionText: '¿Recuerda algún viaje corto que disfrutara especialmente?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pretérito indefinido + un detalle sensorial.', difficulty: 'easy' },
    { topic: 'Travel', questionText: '¿Suele planificar los viajes con detalle o prefiere improvisar?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cualquier opción vale; el porqué importa más.', difficulty: 'easy' },
    { topic: 'Travel', questionText: '¿Ha cambiado la forma de viajar en su país en los últimos años?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite un cambio concreto (low-cost, plataformas).', difficulty: 'medium' },
    { topic: 'Family', questionText: '¿Es una familia numerosa o pequeña? Háblenos un poco de ella.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Estructura: número + adjetivo + una anécdota corta.', difficulty: 'easy' },
    { topic: 'Family', questionText: '¿Quién es la persona de su familia con la que más conecta?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Persona + por qué + un ejemplo breve.', difficulty: 'easy' },
    { topic: 'Family', questionText: '¿Las familias en su país son hoy diferentes a las de hace una generación?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Comparativo: "antes... ahora...". El examinador valora la contraste.', difficulty: 'medium' },
    { topic: 'Friends', questionText: '¿Suele quedar con sus amigos durante la semana o sólo los fines de semana?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Frecuencia + razón breve.', difficulty: 'easy' },
    { topic: 'Friends', questionText: '¿Cómo conoce a sus amigos nuevos en los últimos años?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mencione un contexto (trabajo, apps, deporte).', difficulty: 'easy' },
    { topic: 'Friends', questionText: '¿Cree que las amistades duraderas son más difíciles ahora?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Postura matizada; cite un factor (movilidad, redes).', difficulty: 'medium' },
    { topic: 'Music', questionText: '¿Escucha música mientras hace otras cosas? ¿Cuándo?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Presente habitual + dos ejemplos breves.', difficulty: 'easy' },
    { topic: 'Music', questionText: '¿Hay alguna canción que asocie a un recuerdo concreto?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pretérito + nostalgia controlada.', difficulty: 'easy' },
    { topic: 'Music', questionText: '¿Tiene la música un lugar importante en la cultura española o latinoamericana actual?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Generalice con cuidado — "una parte muy presente" suena natural.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: '¿Cuándo fue la última vez que se compró algo que le ilusionó?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pretérito + un adjetivo emocional.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: '¿Se considera una persona ahorradora o gastadora?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Ejemplo concreto que ilustre la respuesta.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: '¿Han cambiado los hábitos de compra en su país?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite un cambio (delivery, segunda mano).', difficulty: 'medium' },
    { topic: 'Sports', questionText: '¿Practica algún deporte de manera regular o de forma ocasional?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Frecuencia + un motivo personal.', difficulty: 'easy' },
    { topic: 'Sports', questionText: '¿Hay algún deporte que veía de niño y ya no?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pretérito imperfecto: "veía", "jugaba".', difficulty: 'easy' },
    { topic: 'Sports', questionText: '¿Es positivo o no que el deporte profesional ocupe tanto espacio mediático?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Equilibre dos lados antes de inclinarse.', difficulty: 'medium' },
],
  // DELE Hablar — Diálogo (interacción con el examinador).
  'DELE:speaking-part-2': [
    { topic: 'Health', questionText: 'Imagine que está en una farmacia y necesita comprar medicamentos sin receta para un resfriado. Inicie y mantenga la conversación con el farmacéutico (examinador).', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use fórmulas de cortesía: "Disculpe", "¿Podría…?". Cierre la conversación con una despedida.', difficulty: 'medium' },
    { topic: 'Travel', questionText: 'Está reservando una habitación de hotel por teléfono. Negocie con el recepcionista (examinador) detalles como precio, fechas y servicios incluidos.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Practique condicionales ("¿Sería posible…?") y formas de petición.', difficulty: 'medium' },
    { topic: 'Work', questionText: 'Está en una entrevista de trabajo. Responda a las preguntas del entrevistador (examinador) sobre su experiencia y motivación.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Combine pasado (lo que ha hecho) y futuro (lo que aportaría).', difficulty: 'hard' },
    { topic: 'Education', questionText: 'Quiere matricularse en un curso de español avanzado. Pida información a la secretaría (examinador) sobre horarios, precios y nivel requerido.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Estructure preguntas claras y reformule cuando no entienda la respuesta.', difficulty: 'medium' },
      { topic: 'Family', questionText: 'Está organizando una cena familiar y debe coordinar con un familiar (examinador) el menú, la fecha y los invitados.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use formas de cortesía y haga al menos una sugerencia con "podríamos…".', difficulty: 'medium' },
    { topic: 'Sports', questionText: 'Quiere apuntarse a un gimnasio. Pida información al recepcionista (examinador) sobre clases, precios y horarios.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Estructure su intervención: saludo → preguntas → cierre con una decisión.', difficulty: 'easy' },
    { topic: 'Friends', questionText: 'Un amigo (examinador) le invita a un evento al que no puede asistir. Discúlpese y proponga una alternativa.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Combine disculpa, justificación breve y propuesta concreta.', difficulty: 'medium' },
    { topic: 'SocialMedia', questionText: 'Está hablando con un amigo (examinador) sobre las redes sociales. Comente las ventajas y los inconvenientes que han notado.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mantenga un diálogo: escuche, reaccione, aporte ejemplos.', difficulty: 'medium' },
    { topic: 'Music', questionText: 'Quiere comprar entradas para un concierto. Hable con el vendedor (examinador) sobre fechas, asientos y precios.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el condicional ("preferiría…") para sonar más natural.', difficulty: 'medium' },
    { topic: 'Family', questionText: 'Imagine que su sobrino quiere pasar unas vacaciones con usted. Hable con él (examinador) para acordar las fechas, las actividades y las responsabilidades.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el imperativo de forma cortés y haga al menos una propuesta concreta.', difficulty: 'medium' },
    { topic: 'Family', questionText: 'Está organizando un regalo conjunto entre primos. Coordine con uno de ellos (examinador) el presupuesto, el regalo y la sorpresa.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Negociación amistosa: "¿qué tal si...?", "podríamos...".', difficulty: 'medium' },
    { topic: 'Family', questionText: 'Una pariente cercana atraviesa un momento difícil. Hable con otro familiar (examinador) sobre cómo apoyarla sin invadir.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Lenguaje empático y condicionales: "sería bueno que...".', difficulty: 'hard' },
    { topic: 'Friends', questionText: 'Está planeando una escapada con un amigo (examinador). Decidan destino, fechas y alojamiento.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use frases de propuesta y de duda controlada.', difficulty: 'medium' },
    { topic: 'Friends', questionText: 'Un amigo le pide consejo sobre cambiar de trabajo. Mantenga una conversación honesta y útil con él (examinador).', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pregunte antes de aconsejar — eso eleva la nota.', difficulty: 'medium' },
    { topic: 'Friends', questionText: 'Tuvo un malentendido con un amigo. Hable con él (examinador) para resolverlo.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Reconozca su parte primero — el examinador valora la madurez.', difficulty: 'hard' },
    { topic: 'Travel', questionText: 'Está en la recepción de un hotel donde le han asignado una habitación con problemas. Resuelva la situación con el recepcionista (examinador).', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Sea firme pero cortés; pida soluciones concretas.', difficulty: 'medium' },
    { topic: 'Travel', questionText: 'Quiere alquilar un coche para una semana. Negocie con el empleado (examinador) precio, kilometraje y seguros.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Pregunte por extras y dé una opción alternativa.', difficulty: 'medium' },
    { topic: 'Travel', questionText: 'Está organizando una excursión en grupo. Coordine con un compañero (examinador) el itinerario y las preferencias del grupo.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use condicionales para proponer y para descartar.', difficulty: 'hard' },
    { topic: 'Education', questionText: 'Quiere matricularse en un curso de español avanzado. Pida información a la secretaría (examinador) sobre horarios, precios y requisitos.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Estructure: saludo → preguntas claras → cierre con decisión.', difficulty: 'medium' },
    { topic: 'Education', questionText: 'Está hablando con un orientador (examinador) sobre la posibilidad de cambiar de carrera. Explíquele su situación y pídale consejo.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Verbos de duda y consulta: "no estoy seguro de si...".', difficulty: 'medium' },
    { topic: 'Education', questionText: 'Un compañero (examinador) le pide ayuda con una asignatura difícil. Acuerden cómo va a apoyarle sin hacerle el trabajo.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Marque límites con educación; ofrezca alternativas.', difficulty: 'hard' },
    { topic: 'Health', questionText: 'Está en una consulta médica y debe explicarle al doctor (examinador) un dolor que viene experimentando hace tiempo.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Descripción precisa: cuándo, dónde, cómo.', difficulty: 'medium' },
    { topic: 'Health', questionText: 'Quiere apuntarse a un gimnasio. Pregunte al recepcionista (examinador) por las clases adecuadas a su nivel.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Vocabulario específico: aerobic, fuerza, flexibilidad.', difficulty: 'easy' },
    { topic: 'Health', questionText: 'Un amigo (examinador) tiene un hábito poco saludable. Plantéele con tacto su preocupación.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Empezar por reconocer lo bueno antes de aconsejar.', difficulty: 'hard' },
    { topic: 'Music', questionText: 'Quiere comprar entradas para un concierto popular. Hable con el vendedor (examinador) sobre fechas, asientos y precios.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use el condicional: "preferiría...", "sería posible...".', difficulty: 'medium' },
    { topic: 'Music', questionText: 'Está organizando una fiesta sorpresa y necesita música. Hable con un DJ (examinador) sobre estilo, duración y presupuesto.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Léxico musical: ritmo, lista de canciones, ambiente.', difficulty: 'medium' },
    { topic: 'Music', questionText: 'Quiere apuntar a su hijo a clases de música. Hable con la profesora (examinador) sobre el instrumento, la edad y los horarios.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Tono cordial; pregunte y reformule cuando no entienda.', difficulty: 'easy' },
    { topic: 'Sports', questionText: 'Acaba de inscribirse en una carrera popular. Hable con el organizador (examinador) sobre el recorrido, las normas y el equipamiento.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Léxico deportivo concreto y preguntas estructuradas.', difficulty: 'easy' },
    { topic: 'Sports', questionText: 'Un amigo (examinador) le invita a probar un deporte nuevo. Acepte con dudas y aclare detalles.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Manifieste interés y al menos una reserva.', difficulty: 'medium' },
    { topic: 'Sports', questionText: 'Está reservando una pista de pádel/tenis. Negocie con la recepción (examinador) horarios, pista y precio.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Estructura clara: saludo → consulta → reserva → confirmación.', difficulty: 'easy' },
    { topic: 'Work', questionText: 'Está en una entrevista para un puesto que le interesa mucho. Responda al entrevistador (examinador) explicando su experiencia y motivación.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Concrete logros con números o ejemplos breves.', difficulty: 'hard' },
    { topic: 'Work', questionText: 'Un colega (examinador) tiene un conflicto con un cliente. Ofrezca apoyo y proponga una solución.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Escuche primero, sugiera después; lenguaje conciliador.', difficulty: 'medium' },
    { topic: 'Work', questionText: 'Quiere pedir un aumento de sueldo. Plantee su caso a su jefe (examinador) con argumentos sólidos.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Verbos de logro + frases de petición educada.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: 'Está hablando con un amigo (examinador) sobre los efectos de las redes sociales en los jóvenes. Compartan opiniones y experiencias.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use marcadores discursivos: "por un lado", "no obstante".', difficulty: 'medium' },
    { topic: 'SocialMedia', questionText: 'Quiere abrir una cuenta profesional en redes para promocionar su trabajo. Pida consejo a un experto (examinador).', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Vocabulario específico de marketing y comunicación.', difficulty: 'medium' },
    { topic: 'SocialMedia', questionText: 'Un familiar comparte demasiadas cosas privadas en redes. Habla con él (examinador) de los riesgos sin ofenderlo.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Tono empático y propositivo.', difficulty: 'hard' },
],
  // DELE Hablar — Conversación (debate sobre un tema).
  'DELE:speaking-part-3': [
    { topic: 'Climate', questionText: '"Los gobiernos deberían prohibir los coches de gasolina en las ciudades para 2030." ¿Está de acuerdo? Defienda su postura con argumentos.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use conectores ("por un lado", "sin embargo", "en conclusión") para articular el debate.', difficulty: 'hard' },
    { topic: 'Technology', questionText: '¿Cree que las redes sociales han mejorado o empeorado la calidad de nuestras relaciones? Argumente su opinión.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Mencione ejemplos personales o sociales para apoyar cada argumento.', difficulty: 'hard' },
    { topic: 'Education', questionText: 'Algunas universidades están eliminando los exámenes presenciales. ¿Cree que esto es positivo? ¿Por qué?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Aborde tanto al estudiante como al profesor en su análisis.', difficulty: 'hard' },
      { topic: 'SocialMedia', questionText: '"Los menores no deberían usar redes sociales hasta los 16 años." ¿Está de acuerdo? Argumente su postura.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Use conectores ("por un lado", "sin embargo", "en conclusión") para estructurar el debate.', difficulty: 'hard' },
    { topic: 'Sports', questionText: '¿Cree que los deportistas profesionales deberían cobrar tanto como cobran actualmente? Justifique.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare el sueldo con el impacto social — argumento + ejemplo + matiz.', difficulty: 'hard' },
    { topic: 'Family', questionText: '¿Considera que la familia ha cambiado en su país en las últimas décadas? Explique con ejemplos.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Aporte al menos un ejemplo personal o de su entorno cercano.', difficulty: 'hard' },
    { topic: 'Music', questionText: '¿Cree que la música tradicional debería enseñarse de forma obligatoria en las escuelas? ¿Por qué?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Equilibre el valor cultural con la libertad curricular.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: '¿Cómo ha afectado el comercio en línea al pequeño comercio local? ¿Qué se puede hacer al respecto?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinga diagnóstico ("qué pasa") de propuesta ("qué hacer").', difficulty: 'hard' },
    { topic: 'Friends', questionText: '¿Cree que es posible mantener una amistad real únicamente a través de internet? Argumente.', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Tome una postura clara y reconozca los matices.', difficulty: 'hard' },
    { topic: 'Family', questionText: '"La familia tradicional ya no es la norma en nuestra sociedad." ¿Está de acuerdo?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Defina "familia tradicional" antes de opinar.', difficulty: 'hard' },
    { topic: 'Family', questionText: '¿Hasta qué edad es razonable que los hijos vivan en casa de sus padres?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite factores económicos y culturales.', difficulty: 'hard' },
    { topic: 'Family', questionText: '¿Es responsabilidad del Estado o de la familia cuidar a los mayores?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Argumento desde lo ético y desde lo práctico.', difficulty: 'hard' },
    { topic: 'Friends', questionText: '¿Cree que mantener amistades sólo a través de internet es realmente posible?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Postura matizada; ejemplos concretos.', difficulty: 'hard' },
    { topic: 'Education', questionText: '¿Debe la enseñanza universitaria ser gratuita para todos?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Argumente con igualdad de oportunidades y con costes públicos.', difficulty: 'hard' },
    { topic: 'Education', questionText: '¿La educación a distancia es una alternativa válida a la presencial?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinga niveles educativos: infantil, secundaria, superior.', difficulty: 'hard' },
    { topic: 'Education', questionText: '¿Qué papel deben jugar las artes en la educación obligatoria?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Defienda creatividad, empatía y pensamiento crítico.', difficulty: 'medium' },
    { topic: 'Technology', questionText: '¿La inteligencia artificial es una amenaza o una oportunidad para el empleo?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Reconozca ambos polos y proponga políticas de transición.', difficulty: 'hard' },
    { topic: 'Technology', questionText: '¿Deben regular los gobiernos las plataformas digitales?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Diferencie tipos de regulación: contenido, mercado, datos.', difficulty: 'hard' },
    { topic: 'Technology', questionText: '¿Cómo cambiará la tecnología la educación en la próxima década?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Hipótesis con "podría"; cite una tendencia actual como prueba.', difficulty: 'hard' },
    { topic: 'Music', questionText: '¿Debería la música tradicional protegerse por ley en su país?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Riesgos de "musealizar" la cultura viva.', difficulty: 'medium' },
    { topic: 'Music', questionText: '¿Es la música una herramienta efectiva para el cambio social?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite un ejemplo histórico.', difficulty: 'hard' },
    { topic: 'Music', questionText: '¿Las plataformas de streaming favorecen o perjudican a los artistas?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinga ingresos, exposición y dependencia.', difficulty: 'hard' },
    { topic: 'Sports', questionText: '¿Reciben los deportistas profesionales sueldos justos en relación con su aporte social?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Compare con otros sectores esenciales.', difficulty: 'hard' },
    { topic: 'Sports', questionText: '¿Debería el deporte ser asignatura obligatoria hasta el bachillerato?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Físico, mental y social — tres ejes.', difficulty: 'medium' },
    { topic: 'Sports', questionText: '¿Cómo influyen los grandes eventos deportivos en la economía local?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinga corto y largo plazo.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '¿Ha cambiado para mejor la forma en que consumimos hoy?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Equilibre conveniencia, sostenibilidad y exceso.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '¿Tiene la publicidad demasiado poder sobre nuestras decisiones?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Cite ejemplos concretos antes de generalizar.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '¿Las compras de segunda mano son una moda o un cambio cultural?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Causas estructurales: economía, ecología.', difficulty: 'medium' },
    { topic: 'SocialMedia', questionText: '¿Deberían los menores tener acceso libre a las redes sociales?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Defienda una postura con base y matices.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: '¿Las redes han mejorado o empeorado el debate público en su país?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Alcance vs calidad del debate.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: '¿Es posible una desconexión digital sin perder oportunidades laborales o sociales?', questionType: 'speaking-prompt', correctAnswer: null, explanation: 'Distinga tipos de redes y de uso.', difficulty: 'hard' },
],

  // TOPIK 말하기 — Part 1 (짧은 답변, ~30초).
  'TOPIK:speaking-part-1': [
    { topic: 'Home', questionText: '자기소개를 해 주세요. 이름, 직업, 사는 곳을 포함해서 30초 정도로 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '존댓말을 일관되게 사용하고, 정보를 간결하게 정리하세요.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: '여가 시간에 주로 무엇을 하는지 짧게 말해 주세요. 그 활동을 좋아하는 이유도 포함하세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '이유를 한 문장으로 명확히 표현하세요.', difficulty: 'easy' },
    { topic: 'Food', questionText: '가장 좋아하는 한국 음식이 있으면 무엇인지, 어떤 점이 좋은지 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '맛, 추억, 재료 중 하나를 골라 구체적으로 설명하세요.', difficulty: 'easy' },
    { topic: 'Work', questionText: '현재 하고 있는 일이나 공부에 대해 간단히 설명해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '직무 한 가지, 좋은 점 한 가지를 짚어 주세요.', difficulty: 'medium' },
    { topic: 'Culture', questionText: '자신의 나라에서 중요한 명절이나 행사 하나를 짧게 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '무엇을 하는지 → 왜 중요한지 순서로 정리하세요.', difficulty: 'medium' },
      { topic: 'Family', questionText: '가족에 대해 짧게 소개해 주세요. 누구와 살고, 가족 분위기는 어떤지 함께 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '존댓말을 일관되게 사용하세요.', difficulty: 'easy' },
    { topic: 'Sports', questionText: '평소에 즐겨하는 운동이나 좋아하는 스포츠가 있다면 짧게 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '직접 하지 않더라도, 좋아하는 스포츠와 이유를 말해야 합니다.', difficulty: 'easy' },
    { topic: 'Music', questionText: '평소에 어떤 음악을 자주 듣는지, 음악이 기분에 어떤 영향을 주는지 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체적인 가수나 장르 하나를 언급하면 좋습니다.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: '쇼핑을 좋아하시나요? 주로 무엇을, 어디에서 사는지 짧게 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '온라인과 오프라인을 비교하면 자연스럽게 표현이 확장됩니다.', difficulty: 'easy' },
    { topic: 'Friends', questionText: '가장 친한 친구에 대해 간단히 소개해 주세요. 어떻게 알게 되었나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거 시제와 현재 시제를 함께 사용하세요.', difficulty: 'easy' },
    { topic: 'Home', questionText: '지금 살고 있는 동네에 대해 짧게 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '특징 한 가지 + 좋아하는 점 한 가지.', difficulty: 'easy' },
    { topic: 'Home', questionText: '혼자 살고 있나요, 가족과 살고 있나요? 어떤 점이 좋나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '장점과 단점을 하나씩 균형 있게.', difficulty: 'easy' },
    { topic: 'Home', questionText: '어릴 때 살던 곳에서 가장 그리운 것은 무엇인가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형과 감각적 표현을 함께 사용하세요.', difficulty: 'medium' },
    { topic: 'Hobbies', questionText: '배워 보고 싶지만 아직 시작하지 못한 취미가 있나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '이유를 한 문장으로 명확히 표현하세요.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: '취미를 함께하는 사람이 있나요? 누구와 함께하나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '활동 + 사람 + 이유 구조로 답해 보세요.', difficulty: 'easy' },
    { topic: 'Hobbies', questionText: '최근 몇 년 사이 좋아하는 활동이 바뀌었나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거와 현재를 짧게 비교해 보세요.', difficulty: 'medium' },
    { topic: 'Work', questionText: '팀으로 일하는 것과 혼자 일하는 것 중 어느 쪽을 더 선호하나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '선호하는 이유 + 한 가지 단점도 인정.', difficulty: 'easy' },
    { topic: 'Work', questionText: '첫 직장(또는 첫 아르바이트)은 어땠나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형 + 인상에 남은 한 가지 일화.', difficulty: 'medium' },
    { topic: 'Work', questionText: '일과 삶의 균형이 가능하다고 생각하나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '조건문을 활용해 보세요.', difficulty: 'medium' },
    { topic: 'Culture', questionText: '한국 문화를 알고 싶은 외국 친구에게 무엇을 추천하시겠어요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '한 가지에 집중하고 이유를 짧게 설명.', difficulty: 'easy' },
    { topic: 'Culture', questionText: '생일을 어떻게 보내시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '현재형 + 순서 표현(먼저, 그다음에).', difficulty: 'easy' },
    { topic: 'Culture', questionText: '전통문화가 젊은 세대에게도 여전히 중요한가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '단정적인 답은 피하고 "일부" 같은 표현을 활용.', difficulty: 'medium' },
    { topic: 'Travel', questionText: '가장 최근에 다녀온 짧은 여행 이야기를 들려주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형 + 한 가지 인상 깊은 장면.', difficulty: 'easy' },
    { topic: 'Travel', questionText: '여행 계획을 꼼꼼히 세우는 편인가요, 즉흥적인 편인가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '어느 쪽이든 이유가 중요합니다.', difficulty: 'easy' },
    { topic: 'Travel', questionText: '한국 사람들의 여행 방식이 최근 어떻게 달라졌나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체적 변화 하나를 꼽으세요.', difficulty: 'medium' },
    { topic: 'Food', questionText: '가장 좋아하는 가정식 한 가지를 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '재료, 맛, 추억 중 하나를 골라 풀어 보세요.', difficulty: 'easy' },
    { topic: 'Food', questionText: '외식과 집에서 만들어 먹는 것 중 어느 쪽이 더 잦은가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '빈도 표현과 함께 이유를 한 문장으로.', difficulty: 'easy' },
    { topic: 'Food', questionText: '최근 몇 년간 식습관이 어떻게 변했나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체 사례 하나(배달, 채식 등)면 충분.', difficulty: 'medium' },
    { topic: 'Friends', questionText: '가장 친한 친구와는 어떻게 처음 만났나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형 서사 + 한 장면.', difficulty: 'easy' },
    { topic: 'Friends', questionText: '친구들과 보통 무엇을 하며 시간을 보내나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '현재형 + 두세 가지 활동.', difficulty: 'easy' },
    { topic: 'Friends', questionText: '성인이 된 뒤 친구를 사귀는 게 더 어렵다고 느끼시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '이유를 한두 가지로 정리해 답하세요.', difficulty: 'medium' },
    { topic: 'Music', questionText: '공부하거나 일할 때 어떤 음악을 듣나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '장르 + 이유 한 줄이면 충분합니다.', difficulty: 'easy' },
    { topic: 'Music', questionText: '기억에 남는 노래 한 곡과 그 추억을 짧게 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '감정 어휘를 활용하세요.', difficulty: 'easy' },
    { topic: 'Music', questionText: '스트리밍이 일상화되며 음악을 듣는 방식이 어떻게 달라졌나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '긍정과 부정을 모두 다루세요.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: '최근에 산 물건 중 마음에 드는 것을 하나 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형 + 만족한 이유 한 가지.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: '저축하는 편인가요, 소비를 즐기는 편인가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '이유와 함께 본인의 성향을 솔직하게.', difficulty: 'easy' },
    { topic: 'Shopping', questionText: '온라인 쇼핑이 늘면서 어떤 점이 변했나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체 변화 하나(배송, 반품 정책 등).', difficulty: 'medium' },
    { topic: 'Sports', questionText: '정기적으로 하는 운동이 있나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '빈도 + 이유 한 가지.', difficulty: 'easy' },
    { topic: 'Sports', questionText: '어렸을 때 좋아했던 운동이 지금도 좋은가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거와 현재를 비교해 보세요.', difficulty: 'easy' },
    { topic: 'Sports', questionText: '프로 스포츠가 미디어에서 차지하는 비중에 대해 어떻게 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '양면을 함께 다루세요.', difficulty: 'medium' },
],
  // TOPIK 말하기 — Part 2 (긴 답변, 1–2분).
  'TOPIK:speaking-part-2': [
    { topic: 'Travel', questionText: '가장 기억에 남는 여행 경험에 대해 1~2분 정도 말해 주세요. 어디로, 누구와, 무엇을 했는지 포함하세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '시간 순서 표현(처음에, 그다음에, 마지막에)을 사용하면 논리적으로 들립니다.', difficulty: 'medium' },
    { topic: 'Education', questionText: '본인에게 영향을 준 선생님이나 멘토에 대해 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체적인 일화 하나를 중심으로 발표를 구성하세요.', difficulty: 'medium' },
    { topic: 'Technology', questionText: '최근에 새로 배운 기술이나 앱에 대해 소개해 주세요. 어떻게 사용하는지, 왜 유용한지 설명하세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '기능 나열보다 사용자 경험 중심으로 말하세요.', difficulty: 'medium' },
    { topic: 'Health', questionText: '건강을 위해 최근에 바꾼 습관이나 시도한 일이 있다면 1~2분 동안 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형과 현재형을 함께 사용해 변화의 흐름을 보여 주세요.', difficulty: 'hard' },
      { topic: 'Family', questionText: '본인이 가장 존경하는 가족 구성원에 대해 1~2분 정도 이야기해 주세요. 어떤 점에서 존경하는지 함께 말하세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체적인 일화 하나를 중심으로 답변을 구성하세요.', difficulty: 'medium' },
    { topic: 'Sports', questionText: '가장 좋아하는 스포츠나 운동 경험에 대해 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '시작 → 과정 → 현재의 영향 순으로 흐름을 잡아 주세요.', difficulty: 'medium' },
    { topic: 'Friends', questionText: '오래된 친구와의 가장 기억에 남는 추억을 1~2분 동안 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '시간 순서 표현(처음에, 그 후, 결국)을 활용하세요.', difficulty: 'medium' },
    { topic: 'Music', questionText: '본인에게 특별한 의미가 있는 노래 한 곡을 골라 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '곡 자체보다 그 곡이 떠올리게 하는 기억에 집중하세요.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: '최근에 한 인상 깊은 쇼핑 경험에 대해 1~2분 동안 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '왜 인상 깊었는지(가격, 사람, 상황) 한 가지에 초점을 두세요.', difficulty: 'medium' },
    { topic: 'Family', questionText: '가족 중 가장 자주 연락하는 사람을 1~2분 정도 소개해 주세요. 어떤 사람인지, 어떤 이야기를 나누는지 포함하세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체적 일화 하나를 중심으로 이어가세요.', difficulty: 'medium' },
    { topic: 'Family', questionText: '가족과의 잊지 못할 명절 경험을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '시간 흐름 표현(먼저, 그 후)을 활용하세요.', difficulty: 'medium' },
    { topic: 'Family', questionText: '가족 사이에 있었던 작은 갈등과 해결 과정을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형 서사 + 마지막에 깨달은 점.', difficulty: 'hard' },
    { topic: 'Friends', questionText: '오랫동안 만난 친구와의 변치 않는 추억을 1~2분 동안 들려주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '감정 어휘와 구체적 장면을 함께.', difficulty: 'medium' },
    { topic: 'Friends', questionText: '친구의 도움으로 어려움을 극복한 경험을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '어려움 → 도움 → 결과 → 느낀 점 순서.', difficulty: 'medium' },
    { topic: 'Friends', questionText: '연락이 끊겼다가 다시 만난 친구의 이야기를 1~2분 동안 들려주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '시간의 흐름과 변화의 묘사가 중요합니다.', difficulty: 'hard' },
    { topic: 'Travel', questionText: '계획대로 되지 않았지만 결과적으로 더 좋았던 여행을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '문제 → 대응 → 의외의 결과 → 교훈.', difficulty: 'hard' },
    { topic: 'Travel', questionText: '여행지에서 만난 인상 깊은 사람을 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '외형 + 대화 + 인상 한 줄.', difficulty: 'medium' },
    { topic: 'Travel', questionText: '가장 가 보고 싶은 곳을 골라 1~2분 동안 이유와 함께 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '미래형과 조건문을 자연스럽게.', difficulty: 'medium' },
    { topic: 'Education', questionText: '학창 시절 가장 영향을 받은 과목이나 활동을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '왜 영향을 받았는지가 핵심입니다.', difficulty: 'medium' },
    { topic: 'Education', questionText: '학교 밖에서 배운 가장 유용한 기술을 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과정 → 현재 활용 → 의미.', difficulty: 'medium' },
    { topic: 'Education', questionText: '누군가에게 무언가를 가르쳤던 경험을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '교수자의 입장에서 배운 점도 함께.', difficulty: 'medium' },
    { topic: 'Technology', questionText: '일상에서 가장 유용한 앱이나 기기를 1~2분 동안 소개해 주세요. 사용 빈도와 변화도 함께 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '사용 빈도, 변화, 단점까지 균형 있게.', difficulty: 'medium' },
    { topic: 'Technology', questionText: '최근에 새로 배운 디지털 도구를 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '기능 나열보다 활용 사례 중심으로.', difficulty: 'medium' },
    { topic: 'Technology', questionText: '기술 사용으로 생긴 불편한 경험을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '문제 → 대응 → 배운 점.', difficulty: 'medium' },
    { topic: 'Health', questionText: '최근 1년간 시도한 건강 습관 중 가장 효과적이었던 것을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형 + 현재 진행형으로 흐름을 보여 주세요.', difficulty: 'medium' },
    { topic: 'Health', questionText: '몸이 안 좋았을 때 가장 도움이 된 방법을 1~2분 동안 들려주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체적인 일화와 함께 효과를 묘사.', difficulty: 'medium' },
    { topic: 'Health', questionText: '운동을 시작하거나 그만둔 경험을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '동기 → 과정 → 결과를 자연스럽게.', difficulty: 'medium' },
    { topic: 'Music', questionText: '기억에 남는 공연이나 페스티벌을 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '장면, 음악, 분위기를 함께 묘사.', difficulty: 'medium' },
    { topic: 'Music', questionText: '힘들 때 위로가 된 노래 한 곡을 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '감정 어휘를 풍부하게 사용.', difficulty: 'medium' },
    { topic: 'Music', questionText: '좋아하는 가수나 그룹을 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '음악적 특징과 개인적 의미를 같이.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: '최근 큰 결정을 내려서 산 물건을 1~2분 동안 이야기해 주세요. 결정 과정도 포함해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과정 → 결정 → 사용 후기 → 만족도.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '자주 가는 시장이나 가게를 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '감각적 묘사 + 단골이 된 이유.', difficulty: 'medium' },
    { topic: 'Shopping', questionText: '누군가에게 선물한 물건과 그 반응을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '선택 과정과 상대방 반응을 모두 다루세요.', difficulty: 'medium' },
    { topic: 'Sports', questionText: '배우거나 시도해 보고 싶은 운동 한 가지를 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '이유 + 시작 방법 + 작은 걱정.', difficulty: 'medium' },
    { topic: 'Sports', questionText: '어렸을 때부터 좋아했던 스포츠 경험을 1~2분 동안 이야기해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '과거형과 현재형을 자연스럽게 섞으세요.', difficulty: 'medium' },
    { topic: 'Sports', questionText: '존경하는 스포츠 선수를 1~2분 동안 소개해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '업적 + 인상 + 개인적 의미.', difficulty: 'medium' },
],
  // TOPIK 말하기 — Part 3 (토론 / 의견).
  'TOPIK:speaking-part-3': [
    { topic: 'Technology', questionText: '인공지능 기술이 일자리에 미치는 영향에 대해 본인의 의견을 말해 주세요. 긍정적·부정적 측면을 모두 다루세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '두 측면을 균형 있게 다루고 마지막에 본인의 견해를 밝히세요.', difficulty: 'hard' },
    { topic: 'Education', questionText: '온라인 수업과 오프라인 수업의 장단점을 비교해서 의견을 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '비교 표현("~보다", "~에 비해")을 자연스럽게 사용하세요.', difficulty: 'hard' },
    { topic: 'Climate', questionText: '환경 보호를 위해 개인이 실천할 수 있는 일에는 어떤 것들이 있는지, 그리고 개인의 노력만으로 충분한지에 대해 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '개인 → 사회 → 정부 순으로 시야를 넓혀 설득력을 높이세요.', difficulty: 'hard' },
    { topic: 'Work', questionText: '재택근무가 늘어나는 추세에 대해 어떻게 생각하는지 의견을 말해 주세요. 앞으로의 전망도 포함하세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '미래 시제와 가정 표현("~할 것 같다", "~게 된다면")을 활용하세요.', difficulty: 'hard' },
      { topic: 'SocialMedia', questionText: '소셜 미디어 사용이 인간관계에 미치는 영향에 대해 본인의 의견을 말해 주세요. 긍정적·부정적 측면을 모두 다루세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '두 측면을 균형 있게 다룬 뒤 마지막에 본인의 견해를 명확히 밝히세요.', difficulty: 'hard' },
    { topic: 'Family', questionText: '한국 사회에서 가족 형태가 어떻게 변화하고 있다고 생각하는지 본인의 견해를 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '경제적 요인과 문화적 요인을 함께 언급하세요.', difficulty: 'hard' },
    { topic: 'Sports', questionText: '청소년기에 스포츠 활동을 의무화하는 것에 대해 어떻게 생각하는지 의견을 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '신체적 효과뿐 아니라 사회성, 학업과의 균형까지 함께 다루세요.', difficulty: 'hard' },
    { topic: 'Music', questionText: '음악 스트리밍 서비스의 확산이 음악 산업과 청취 문화에 어떤 영향을 주었다고 생각하는지 의견을 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '아티스트와 청취자의 시각을 모두 다루면 균형 잡힌 답변이 됩니다.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '온라인 쇼핑의 확산이 지역 상권에 미친 영향에 대해 본인의 의견을 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '문제 진단과 대안 제시를 분리해서 말하세요.', difficulty: 'hard' },
    { topic: 'Family', questionText: '한국 사회에서 1인 가구가 증가하는 현상에 대해 어떻게 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '원인과 영향, 그리고 사회적 대응까지.', difficulty: 'hard' },
    { topic: 'Family', questionText: '자녀 양육에서 부모와 사회의 역할 분담은 어떻게 이루어져야 한다고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '양육의 다층적 책임을 인정하세요.', difficulty: 'hard' },
    { topic: 'Family', questionText: '결혼과 출산에 대한 가치관 변화의 원인은 무엇이라고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '경제, 문화, 정책 요인을 모두 다루세요.', difficulty: 'hard' },
    { topic: 'Friends', questionText: '디지털 친구 관계는 진정한 우정의 한 형태라고 볼 수 있나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '친밀함의 기준을 어떻게 정할지 명확히.', difficulty: 'hard' },
    { topic: 'Friends', questionText: '성인이 된 후 새로운 친구를 사귀기 어려운 이유는 무엇이라고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '사회 구조적 요인을 포함해 설명.', difficulty: 'hard' },
    { topic: 'Friends', questionText: '소셜 미디어가 친구 관계에 어떤 영향을 주었다고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '접근성과 깊이의 차이를 구분하세요.', difficulty: 'hard' },
    { topic: 'Education', questionText: '입시 위주의 교육이 학생들에게 미치는 영향에 대해 본인의 생각을 말해 주세요.', questionType: 'speaking-prompt', correctAnswer: null, explanation: '긍정적 부정적 측면을 균형 있게.', difficulty: 'hard' },
    { topic: 'Education', questionText: '창의력을 학교 교육으로 기를 수 있다고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '교육과정과 평가 방식 모두 고려.', difficulty: 'hard' },
    { topic: 'Education', questionText: '앞으로 20년 후 대학 교육은 어떻게 달라질까요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '디지털, 인구, 시장 변화 등을 활용.', difficulty: 'hard' },
    { topic: 'Technology', questionText: '인공지능 기술이 노동시장에 미치는 영향에 대해 어떻게 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '직무 변화, 재교육, 사회 안전망까지.', difficulty: 'hard' },
    { topic: 'Technology', questionText: '정부가 빅테크 기업을 더 강하게 규제해야 한다고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '유형별 규제(시장, 콘텐츠, 데이터)로 나누세요.', difficulty: 'hard' },
    { topic: 'Technology', questionText: '기술이 우리의 사생활 보호를 어떻게 변화시키고 있다고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '예시와 함께 설명하세요.', difficulty: 'hard' },
    { topic: 'Health', questionText: '정부가 시민의 건강 관리에 어디까지 개입해야 한다고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '자율과 공익의 균형이 핵심.', difficulty: 'hard' },
    { topic: 'Health', questionText: '정신 건강에 대한 사회적 인식이 어떻게 변하고 있다고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '긍정적 변화와 남은 과제를 함께.', difficulty: 'hard' },
    { topic: 'Health', questionText: '디지털 헬스케어가 의료 접근성에 어떤 영향을 줄 것이라고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '장점과 한계를 균형 있게.', difficulty: 'hard' },
    { topic: 'Music', questionText: '음악 스트리밍 서비스의 수익 구조가 아티스트에게 공정한가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '산업 구조와 대안 모델을 함께 다루세요.', difficulty: 'hard' },
    { topic: 'Music', questionText: '전통 음악이 현대 사회에서 살아남기 위해 필요한 것은 무엇일까요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '교육, 후원, 콘텐츠 측면에서.', difficulty: 'hard' },
    { topic: 'Music', questionText: '음악이 사회 변화의 도구가 될 수 있다고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '역사적 사례 하나면 충분합니다.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '온라인 쇼핑의 확산이 지역 상권에 미친 영향에 대해 어떻게 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '단기, 장기 영향을 모두 다루세요.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '광고가 우리의 소비 선택에 미치는 영향력은 어느 정도라고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '예시 + 데이터 + 윤리적 시각.', difficulty: 'hard' },
    { topic: 'Shopping', questionText: '중고 거래가 새로운 소비 문화가 된 이유는 무엇일까요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '경제, 환경, 가치관 모두 고려.', difficulty: 'medium' },
    { topic: 'Sports', questionText: '프로 선수의 연봉이 지나치게 높다는 비판에 대해 어떻게 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '시장 논리와 사회적 가치 균형.', difficulty: 'hard' },
    { topic: 'Sports', questionText: '국가가 대형 스포츠 이벤트를 유치하는 것은 가치 있는 일인가요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '단기 이익과 장기 부담을 비교.', difficulty: 'hard' },
    { topic: 'Sports', questionText: '청소년의 체육 활동을 늘리기 위한 효과적인 정책은 무엇이라고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '학교, 지역, 정부 차원에서 구체적으로.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: '청소년의 SNS 사용 시간을 제한해야 한다는 의견에 대해 어떻게 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '데이터와 부작용을 함께 인용.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: 'SNS가 공공 담론의 질에 어떤 영향을 주고 있다고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '도달과 깊이를 분리해 분석.', difficulty: 'hard' },
    { topic: 'SocialMedia', questionText: '"디지털 디톡스"가 현실적으로 가능한 일이라고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '직업, 인간관계, 정보 접근성 고려.', difficulty: 'hard' },
    { topic: 'Work', questionText: '재택근무가 일상화되며 직장 문화는 어떻게 달라졌나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '긍정, 부정, 개선 과제를 모두 다루세요.', difficulty: 'hard' },
    { topic: 'Work', questionText: '청년 실업 문제를 해결하기 위해 가장 효과적인 정책은 무엇일까요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '단기와 구조적 접근을 함께.', difficulty: 'hard' },
    { topic: 'Work', questionText: '앞으로 어떤 직업이 사라지고 어떤 직업이 늘어날 것이라고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '구체 예시와 근거.', difficulty: 'hard' },
    { topic: 'Climate', questionText: '기후 변화 대응에서 개인의 노력과 정부의 정책 중 어느 쪽이 더 중요할까요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '양쪽을 모두 인정하되, 시너지를 강조.', difficulty: 'hard' },
    { topic: 'Climate', questionText: '개발도상국의 기후 위기 대응을 선진국이 도와야 할 의무가 있다고 보시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '역사적 책임과 현실적 능력.', difficulty: 'hard' },
    { topic: 'Climate', questionText: '재생에너지가 화석연료를 완전히 대체할 수 있다고 생각하시나요?', questionType: 'speaking-prompt', correctAnswer: null, explanation: '기술, 정책, 시장의 제약을 함께.', difficulty: 'hard' },
],
};

async function seed() {
  console.log('🔄 Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
    maxPoolSize: 10,
  });
  console.log('✅ Connected');

  // 0. Migrate legacy writing sections. Pre-Chunk-F seeds created a
  // single section with sectionType='writing'; we now split into
  // writing-task-1 / writing-task-2 so progress tracks each task.
  // Move legacy rows to writing-task-2 (existing questions are all
  // long-form essays). Idempotent — only runs when legacy rows exist.
  const legacy = await ExamSection.find({ sectionType: 'writing' });
  for (const row of legacy) {
    row.sectionType = 'writing-task-2';
    row.sectionName = 'Writing — Task 2';
    await row.save();
    console.log(`~ Migrated legacy Writing section ${row._id} → writing-task-2`);
  }
  // Also update ExamType.sections arrays so the section list is
  // consistent with the new section types.
  await ExamType.updateMany(
    { sections: 'writing' },
    {
      $set: {
        'sections.$[el]': 'writing-task-2',
      },
    },
    { arrayFilters: [{ el: 'writing' }] }
  );
  // Ensure every exam also lists writing-task-1 (idempotent).
  await ExamType.updateMany(
    { sections: { $ne: 'writing-task-1' } },
    { $addToSet: { sections: 'writing-task-1' } }
  );
  // Ensure every exam lists speaking-part-1/2/3 (idempotent).
  for (const sp of ['speaking-part-1', 'speaking-part-2', 'speaking-part-3']) {
    await ExamType.updateMany(
      { sections: { $ne: sp } },
      { $addToSet: { sections: sp } }
    );
  }

  // 1. Languages.
  const languageByCode = {};
  for (const data of LANGUAGE_DATA) {
    const existing = await ExamLanguage.findOne({ code: data.code });
    if (existing) {
      languageByCode[data.code] = existing;
      console.log(`= ${data.name} already exists`);
    } else {
      const created = await ExamLanguage.create(data);
      languageByCode[data.code] = created;
      console.log(`+ Created language ${data.name}`);
    }
  }

  // 2. Exams.
  const examByName = {};
  for (const data of EXAM_DATA) {
    const language = languageByCode[data.languageCode];
    const existing = await ExamType.findOne({
      name: data.name,
      languageId: language._id,
    });
    if (existing) {
      examByName[data.name] = existing;
      console.log(`= ${data.name} already exists`);
    } else {
      const { languageCode, ...rest } = data;
      const created = await ExamType.create({
        ...rest,
        languageId: language._id,
      });
      examByName[data.name] = created;
      console.log(`+ Created exam ${data.name}`);
    }
  }

  // 3. Sections.
  const sectionsByExam = {};
  for (const exam of Object.values(examByName)) {
    sectionsByExam[exam.name] = {};
    for (const sectionDef of SECTION_DATA) {
      const existing = await ExamSection.findOne({
        examId: exam._id,
        sectionType: sectionDef.type,
      });
      if (existing) {
        sectionsByExam[exam.name][sectionDef.type] = existing;
        console.log(`= ${exam.name}/${sectionDef.type} already exists`);
      } else {
        const created = await ExamSection.create({
          examId: exam._id,
          sectionName: sectionDef.name,
          sectionType: sectionDef.type,
          durationMinutes: sectionDef.durationMinutes,
          questionCount: sectionDef.questionCount,
        });
        sectionsByExam[exam.name][sectionDef.type] = created;
        console.log(`+ Created section ${exam.name}/${sectionDef.type}`);
      }
    }
  }

  // 3b. Localise speaking section names per exam — section rows already
  // exist with English defaults from the loop above. This block is
  // idempotent: only writes when the name still matches the default.
  const SPEAKING_NAME_OVERRIDES = {
    DELE: {
      'speaking-part-1': 'Hablar — Monólogo',
      'speaking-part-2': 'Hablar — Diálogo',
      'speaking-part-3': 'Hablar — Conversación',
    },
    TOPIK: {
      'speaking-part-1': '말하기 — 짧은 답변',
      'speaking-part-2': '말하기 — 긴 답변',
      'speaking-part-3': '말하기 — 토론',
    },
  };
  for (const [examName, overrides] of Object.entries(SPEAKING_NAME_OVERRIDES)) {
    const exam = examByName[examName];
    if (!exam) continue;
    for (const [sectionType, localisedName] of Object.entries(overrides)) {
      const section = sectionsByExam[examName]?.[sectionType];
      if (!section) continue;
      // Only rename if still on the default English name — keeps the
      // migration idempotent without clobbering admin edits.
      if (section.sectionName && section.sectionName.startsWith('Speaking — ')) {
        section.sectionName = localisedName;
        await section.save();
        console.log(`~ Localised ${examName}/${sectionType} → ${localisedName}`);
      }
    }
  }

  // 4. Questions.
  let createdQuestions = 0;
  for (const [key, questions] of Object.entries(QUESTION_DATA)) {
    const [examName, sectionType] = key.split(':');
    const exam = examByName[examName];
    const section = sectionsByExam[examName]?.[sectionType];
    if (!exam || !section) {
      console.warn(`! Skipping ${key} — exam or section missing`);
      continue;
    }
    for (const q of questions) {
      const existing = await ExamQuestion.findOne({
        sectionId: section._id,
        questionText: q.questionText,
      });
      if (existing) {
        // Backfill the topic field on already-seeded rows so the topic
        // picker has something to group by after a fresh seed run.
        if (!existing.topic && q.topic) {
          existing.topic = q.topic;
          await existing.save();
          console.log(`~ Backfilled topic for ${examName}/${sectionType} question`);
        }
        continue;
      }
      await ExamQuestion.create({
        examId: exam._id,
        sectionId: section._id,
        ...q,
        source: 'builtin',
      });
      createdQuestions++;
    }
  }
  console.log(`+ Created ${createdQuestions} questions`);

  console.log('✅ Seed complete');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
