/**
 * Roleplay scenarios catalog.
 *
 * Each scenario gives the tutor a specific role to play and the user
 * a clear goal. The AI plays the "other side" of the conversation
 * (waiter, interviewer, etc.) and grades the user on success criteria
 * at the end of the session. All copy is English; the AI conducts
 * the actual roleplay in the user's target language at their level.
 */

const SCENARIOS = [
  {
    id: 'restaurant_order',
    emoji: '🍝',
    title: 'Order at a restaurant',
    summary: 'Order a meal, ask about ingredients, request the bill.',
    goal: 'Successfully order a 2-course meal and pay.',
    aiRole: 'a friendly waiter at a casual restaurant',
    successCriteria: [
      'User greeted the waiter',
      'User ordered a main course',
      'User asked at least one question about the menu',
      'User asked for the bill politely',
    ],
    minTurns: 6,
  },
  {
    id: 'job_interview',
    emoji: '💼',
    title: 'Job interview',
    summary: 'Introduce yourself, answer common interview questions.',
    goal: 'Make a strong first impression in a 5-minute interview.',
    aiRole: 'a professional hiring manager conducting a first-round interview',
    successCriteria: [
      'User introduced themselves clearly',
      'User answered why they want the job',
      'User asked at least one question back',
      'User used appropriate formal register',
    ],
    minTurns: 8,
  },
  {
    id: 'hotel_checkin',
    emoji: '🏨',
    title: 'Check in at a hotel',
    summary: 'Confirm your reservation, ask about amenities.',
    goal: 'Check in successfully and find out about breakfast hours.',
    aiRole: 'a friendly hotel front-desk clerk',
    successCriteria: [
      'User confirmed name and booking',
      'User asked about at least one amenity (breakfast, wifi, gym...)',
      'User asked for a wake-up call OR late checkout',
    ],
    minTurns: 5,
  },
  {
    id: 'asking_directions',
    emoji: '🧭',
    title: 'Ask for directions',
    summary: 'Find your way to a landmark using only spoken directions.',
    goal: 'Get clear directions to the nearest train station.',
    aiRole: 'a helpful local on the street',
    successCriteria: [
      'User politely got the local\'s attention',
      'User asked for the train station',
      'User confirmed they understood (or asked for repetition)',
      'User thanked the local',
    ],
    minTurns: 5,
  },
  {
    id: 'doctor_visit',
    emoji: '🩺',
    title: 'Doctor visit',
    summary: 'Describe a symptom and ask follow-up questions.',
    goal: 'Get a clear next-step recommendation from the doctor.',
    aiRole: 'a calm general-practice doctor',
    successCriteria: [
      'User described a symptom with duration',
      'User answered the doctor\'s clarifying question',
      'User asked about treatment OR follow-up',
    ],
    minTurns: 6,
  },
  {
    id: 'coffee_shop',
    emoji: '☕',
    title: 'Order a coffee',
    summary: 'Casual coffee shop order — quick and friendly.',
    goal: 'Order your drink with one customization.',
    aiRole: 'a chatty barista',
    successCriteria: [
      'User ordered a specific drink',
      'User specified one customization (size, milk, sugar...)',
      'User responded to small talk',
    ],
    minTurns: 4,
  },
];

const list = () => SCENARIOS.map(s => ({
  id: s.id,
  emoji: s.emoji,
  title: s.title,
  summary: s.summary,
  goal: s.goal,
  minTurns: s.minTurns,
}));

const findById = (id) => SCENARIOS.find(s => s.id === id);

module.exports = { list, findById };
