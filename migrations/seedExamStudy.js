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
