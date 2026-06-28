/**
 * Migration: seed curated study tips for each exam.
 *
 * Idempotent — dedup by (examId, title). Re-running adds only the new
 * entries. Run after seedExamStudy.js (exams must already exist).
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

const ExamType = require('../models/ExamType');
const ExamStudyTip = require('../models/ExamStudyTip');

// Each entry: { examName, sectionType, category, title, body, order, tags }
// sectionType=null means "applies across the whole exam".
const TIPS = [
  // =========================================================================
  // IELTS
  // =========================================================================
  // Overall strategy
  { examName: 'IELTS', sectionType: null, category: 'strategy',
    title: 'The 4-criterion mindset',
    body:
      'IELTS Writing and Speaking are scored on FOUR equal criteria. Memorise them:\n\n' +
      '• Task Response / Fluency & Coherence  — did you actually answer?\n' +
      '• Lexical Resource — vocabulary range and precision\n' +
      '• Grammatical Range & Accuracy — variety of structures\n' +
      '• Coherence & Cohesion / Pronunciation — flow and clarity\n\n' +
      'You can be band 8 in three of them and still get band 6 overall if one drops sharply. Practise the weakest criterion first.',
    order: 0, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: null, category: 'time-management',
    title: 'Use the 1-2-3-4 plan in Writing',
    body:
      'IELTS Writing gives you 60 minutes for two tasks. Most candidates run out on Task 2.\n\n' +
      '• 1 minute — read both questions and underline keywords\n' +
      '• 20 minutes — Task 1 (write 150+ words)\n' +
      '• 35 minutes — Task 2 (write 250+ words; this carries 2× the weight)\n' +
      '• 4 minutes — proofread BOTH essays, fix tense and article errors first\n\n' +
      'Task 2 is worth twice as much — never sacrifice it to polish Task 1.',
    order: 0, tags: ['band-booster'] },
  // Reading
  { examName: 'IELTS', sectionType: 'reading', category: 'strategy',
    title: 'Skim before scanning',
    body:
      'IELTS Reading has 40 questions in 60 minutes — one minute per question average. Reading the passage word-for-word is impossible.\n\n' +
      '1. Skim the passage in 2 minutes — read titles, first/last sentences, any bold words.\n' +
      '2. Read the QUESTIONS next, underlining keywords (names, dates, numbers).\n' +
      '3. Now scan the passage for those keywords. Read 2–3 sentences around each match.\n\n' +
      'Never read the whole passage before seeing the questions.',
    order: 0, tags: ['time-management'] },
  { examName: 'IELTS', sectionType: 'reading', category: 'common-mistakes',
    title: 'TRUE / FALSE / NOT GIVEN traps',
    body:
      'The most common reading mistake: choosing FALSE when the correct answer is NOT GIVEN.\n\n' +
      '• TRUE       — the passage states this directly\n' +
      '• FALSE      — the passage states the OPPOSITE\n' +
      '• NOT GIVEN  — the passage does not address this point at all\n\n' +
      'If you cannot point to the sentence that contradicts the statement, the answer is NOT GIVEN — not FALSE. When in doubt, NOT GIVEN.',
    order: 1, tags: [] },
  // Writing Task 1 (Academic charts)
  { examName: 'IELTS', sectionType: 'writing-task-1', category: 'strategy',
    title: 'Open with an overview',
    body:
      'Academic Task 1 (chart description) MUST have an overview sentence that names the 1–2 biggest trends. Without it, you are capped at band 5 — even with perfect grammar.\n\n' +
      'Template:\n' +
      '"Overall, [X showed the most growth / [X] and [Y] outperformed all others / the most striking feature is [Z]."\n\n' +
      'Put the overview as the SECOND paragraph (after the introduction), before any detailed comparisons.',
    order: 0, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: 'writing-task-1', category: 'grammar',
    title: 'Comparative language essentials',
    body:
      'Task 1 lives on comparisons. Build a personal "comparative phrase bank":\n\n' +
      'INCREASE: rose, climbed, soared (sharp), edged up (slight)\n' +
      'DECREASE: fell, dropped, plummeted (sharp), dipped (slight)\n' +
      'EQUAL: remained stable, plateaued, was unchanged at\n' +
      'CONTRAST: in contrast, by comparison, whereas\n\n' +
      'Use 2–3 different verbs per essay so you don\'t repeat "increased" five times.',
    order: 1, tags: ['lexical-resource'] },
  { examName: 'IELTS', sectionType: 'writing-task-1', category: 'time-management',
    title: '20-minute plan for Task 1',
    body:
      '• 2 min — read the chart and circle the 2 biggest features\n' +
      '• 3 min — write the overview sentence and the introduction\n' +
      '• 12 min — body paragraphs (one paragraph per cluster of data, NOT one per data point)\n' +
      '• 3 min — proofread, fix tense ("the chart shows" stays present), add ONE comparison if you have time',
    order: 2, tags: [] },
  // Writing Task 2
  { examName: 'IELTS', sectionType: 'writing-task-2', category: 'strategy',
    title: 'Pick a stance — even on "discuss both views"',
    body:
      'Examiners reward candidates who commit. Even on "discuss both views and give your opinion" questions, your conclusion MUST clearly state your position.\n\n' +
      'Weak: "Both sides have valid arguments and it depends on the situation."\n' +
      'Strong: "Despite the merits of [X], I firmly believe [Y] because [reason]."\n\n' +
      'Hedge inside paragraphs ("largely", "tends to") but NOT in the conclusion.',
    order: 0, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: 'writing-task-2', category: 'grammar',
    title: 'Mix simple, compound, and complex sentences',
    body:
      'Grammatical Range & Accuracy is 25% of your score. To hit band 7+ you need:\n\n' +
      '• Conditionals: "If governments invested more, citizens would benefit."\n' +
      '• Relative clauses: "Children who grow up in cities tend to..."\n' +
      '• Passive voice: "It could be argued that..."\n' +
      '• Cleft sentences: "What concerns me most is..."\n\n' +
      'Aim for one of each per essay — but never sacrifice clarity for complexity.',
    order: 1, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: 'writing-task-2', category: 'common-mistakes',
    title: "Don't memorise full essays",
    body:
      'Examiners are trained to spot memorised content. If they sense you\'re reciting a pre-learned essay, your Task Response score drops to band 5 or lower regardless of quality.\n\n' +
      'What\'s SAFE to memorise:\n' +
      '• Linking phrases ("On the other hand", "It is widely acknowledged that")\n' +
      '• Topic-neutral vocabulary ("significant", "implications")\n\n' +
      'What\'s DANGEROUS:\n' +
      '• Full paragraphs about climate / technology / education\n' +
      '• Pre-written conclusions',
    order: 2, tags: [] },
  // Speaking
  { examName: 'IELTS', sectionType: 'speaking-part-1', category: 'strategy',
    title: 'Extend every answer — but only a little',
    body:
      'Part 1 questions deserve 2–3 sentence answers, not one-word replies or 5-minute monologues.\n\n' +
      'WEAK: "Yes, I do."\n' +
      'IDEAL: "Yes, I do. I usually go cycling at weekends because it helps me clear my head after a long week. Mountain trails are my favourite, though I sometimes settle for the local park."\n\n' +
      'Add a REASON or an EXAMPLE — never both unless asked.',
    order: 0, tags: ['fluency'] },
  { examName: 'IELTS', sectionType: 'speaking-part-2', category: 'strategy',
    title: 'Use the cue card structure',
    body:
      'Part 2 gives you a card with 3–4 bullets and 1 minute to prepare. Cover bullets in order, BUT:\n\n' +
      '• Bullets 1–3 take ~25% of your speaking time each\n' +
      '• The final bullet ("explain why...") deserves 30%+ of your time — it carries the strongest band signal\n\n' +
      'If the examiner stops you before bullet 4, your overall score drops. Pace yourself with a phrase: "Let me come back to that — first..."',
    order: 0, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: 'speaking-part-3', category: 'strategy',
    title: 'Show you can discuss abstractly',
    body:
      'Part 3 is the abstract-discussion section. Personal anecdotes alone won\'t reach band 7+.\n\n' +
      'Move UP in abstraction:\n' +
      '• Personal ("In my family...")\n' +
      '• Societal ("In my country...")\n' +
      '• Global / abstract ("There seems to be a worldwide trend toward...")\n' +
      '• Future-facing ("This will likely lead to...")\n\n' +
      'Include all four levels across the 4–5 minute discussion.',
    order: 0, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: 'speaking-part-3', category: 'grammar',
    title: 'Hedge like a band-9 speaker',
    body:
      'Confident absolutes ("definitely", "always", "never") sound less sophisticated than calibrated language.\n\n' +
      'Replace:\n' +
      'always → tend to / by and large\n' +
      'never  → rarely / hardly ever\n' +
      'all    → most / the majority of\n' +
      'will   → is likely to / may well\n\n' +
      'Hedging shows the examiner you can handle nuance — a band 8+ marker.',
    order: 1, tags: ['band-booster'] },
  // Listening (general)
  { examName: 'IELTS', sectionType: 'listening', category: 'common-mistakes',
    title: 'Spelling and number formats matter',
    body:
      'In IELTS Listening, an answer with the correct meaning but wrong spelling is marked WRONG. Common slips:\n\n' +
      '• "Wednesday" not "wendsday" / "wendesday"\n' +
      '• "accommodation" — double c, double m\n' +
      '• Phone numbers: "double 7" not "77" unless you write the digits\n' +
      '• Dates: 5 May or 5/5 — both fine, but be consistent\n\n' +
      'Use the FINAL 10 minutes (transfer time) to double-check spellings.',
    order: 0, tags: ['time-management'] },
  // General
  { examName: 'IELTS', sectionType: null, category: 'pronunciation',
    title: 'Word stress > accent reduction',
    body:
      'Examiners assess clarity, not accent. A strong national accent does NOT lower your score. What hurts is misplaced word stress:\n\n' +
      '• PHO-to-graph (noun) / pho-TO-graph-er (person)\n' +
      '• "des-ERT" (verb: to abandon) vs "DES-ert" (noun: dry place)\n' +
      '• "co-MMU-ni-cate" not "COM-mu-ni-cate"\n\n' +
      'Listening to high-quality audio and shadowing it is the fastest fix.',
    order: 0, tags: [] },
  { examName: 'IELTS', sectionType: null, category: 'vocabulary',
    title: 'Build topic-based word groups',
    body:
      'Random vocabulary lists don\'t stick. Learn words in TOPIC CLUSTERS so retrieval is natural under exam pressure:\n\n' +
      'Environment: emissions, sustainability, carbon footprint, renewable, biodiversity\n' +
      'Education: curriculum, pedagogy, rote learning, critical thinking\n' +
      'Technology: automation, artificial intelligence, surveillance, encryption\n\n' +
      'Aim for 6–10 high-utility words per topic — quality beats sheer quantity.',
    order: 0, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: null, category: 'cultural-notes',
    title: 'The examiner is on your side',
    body:
      'Speaking examiners are trained to draw out your best English, not to catch you out. Treat the exam like a friendly chat with a stranger.\n\n' +
      '• Eye contact and small smiles signal engagement\n' +
      '• If you don\'t understand, ASK: "Sorry, could you rephrase that?" — examiners cannot penalise clarification\n' +
      '• Brief silence to think is fine ("Let me think... I would say...")',
    order: 0, tags: [] },
  { examName: 'IELTS', sectionType: null, category: 'common-mistakes',
    title: "Off-topic answers cost more than weak grammar",
    body:
      'A grammatically simple but on-topic answer scores higher than a sophisticated but off-topic one. If the question asks "What did you like about it?", do NOT drift into when you went or who you went with.\n\n' +
      'Listen to the QUESTION WORD: what, why, how, when, who, do you think, do you agree. Answer THAT.',
    order: 1, tags: ['band-booster'] },
  { examName: 'IELTS', sectionType: 'vocabulary', category: 'band-booster',
    title: 'Use 1 idiom — not 5',
    body:
      'Band 7+ Lexical Resource requires "some less common items including idiomatic vocabulary". The trap: overdoing it.\n\n' +
      'STRONG: One well-placed idiom per essay, used correctly.\n' +
      'RISKY:  Five idioms; one used in the wrong context tanks the score.\n\n' +
      'Safe collocations to study: bear in mind, take into account, it goes without saying, by and large, when push comes to shove.',
    order: 0, tags: ['band-booster'] },

  // =========================================================================
  // DELE
  // =========================================================================
  { examName: 'DELE', sectionType: null, category: 'strategy',
    title: 'Estructura tus respuestas con claridad',
    body:
      'El examinador valora una estructura clara antes que un vocabulario extenso.\n\n' +
      'Para cualquier respuesta extendida:\n' +
      '1. INTRODUCCIÓN — di brevemente de qué vas a hablar\n' +
      '2. DESARROLLO   — dos ideas con ejemplos concretos\n' +
      '3. CONCLUSIÓN   — cierra con una valoración personal\n\n' +
      'Conectores claves: "para empezar", "en primer lugar", "por otro lado", "en definitiva".',
    order: 0, tags: [] },
  { examName: 'DELE', sectionType: null, category: 'grammar',
    title: 'Domina el subjuntivo en contextos típicos',
    body:
      'El subjuntivo se evalúa con frecuencia en DELE B2 y superior. Memorízalo en contextos donde es OBLIGATORIO:\n\n' +
      '• Deseo: "Espero que llegues pronto."\n' +
      '• Duda: "No creo que sea posible."\n' +
      '• Después de "para que": "Llámame para que hablemos."\n' +
      '• Tras "cuando" + futuro: "Cuando termines, avísame."\n\n' +
      'Aprende estas cuatro estructuras de memoria — son las más frecuentes.',
    order: 0, tags: ['band-booster'] },
  { examName: 'DELE', sectionType: 'reading', category: 'strategy',
    title: 'Lee primero las preguntas',
    body:
      'En la Tarea 1 de Comprensión de Lectura, los textos son extensos. Lee primero las preguntas y subraya las palabras clave; luego busca esas palabras en el texto.\n\n' +
      'No leas el texto entero antes de las preguntas. La técnica de "scanning" te ahorra al menos 5 minutos por tarea.',
    order: 0, tags: ['time-management'] },
  { examName: 'DELE', sectionType: 'reading', category: 'common-mistakes',
    title: 'Cuidado con los falsos amigos',
    body:
      'Palabras que parecen similares al inglés u otros idiomas pero significan algo distinto:\n\n' +
      '• "embarazada" = pregnant (NO embarrassed)\n' +
      '• "constipado" = with a cold (NO constipated)\n' +
      '• "actualmente" = currently (NO actually)\n' +
      '• "carpeta" = folder (NO carpet)\n' +
      '• "éxito" = success (NO exit)\n\n' +
      'Lee con atención; los exámenes incluyen estas trampas intencionalmente.',
    order: 1, tags: ['vocabulary'] },
  { examName: 'DELE', sectionType: 'writing-task-1', category: 'strategy',
    title: 'Adapta el registro a la situación',
    body:
      'La Tarea 1 de Expresión Escrita es siempre una carta o correo. El registro debe coincidir con el destinatario:\n\n' +
      'FORMAL (a empresa, autoridad):\n' +
      '"Estimado Sr. / Sra. ..." → "Atentamente,"\n' +
      'Usa "usted" siempre, evita contracciones.\n\n' +
      'INFORMAL (a amigo, familiar):\n' +
      '"Querido/a..." → "Un abrazo,"\n' +
      'Usa "tú" o "vosotros", lenguaje cercano.\n\n' +
      'Confundir el registro reduce tu nota incluso con gramática perfecta.',
    order: 0, tags: ['band-booster'] },
  { examName: 'DELE', sectionType: 'writing-task-2', category: 'strategy',
    title: 'Argumenta con ejemplos concretos',
    body:
      'En la Tarea 2 (artículo de opinión), las generalizaciones débilitan tu nota:\n\n' +
      'DÉBIL: "Mucha gente piensa que las redes sociales son malas."\n' +
      'FUERTE: "Según un estudio reciente del Instituto Cervantes, el 65% de los adolescentes utiliza redes sociales más de 3 horas al día."\n\n' +
      'Aunque inventes el dato con criterio razonable, el examinador valora el USO de evidencia, no su veracidad exacta.',
    order: 0, tags: [] },
  { examName: 'DELE', sectionType: 'writing-task-2', category: 'grammar',
    title: 'Conectores para articular argumentos',
    body:
      'Memoriza este conjunto mínimo de conectores. Úsalos en cada texto:\n\n' +
      'AÑADIR: además, asimismo, por otra parte\n' +
      'CONTRASTAR: sin embargo, no obstante, por el contrario\n' +
      'EJEMPLIFICAR: por ejemplo, en concreto, a saber\n' +
      'CONCLUIR: en conclusión, en resumen, para terminar\n\n' +
      'Dos o tres conectores variados elevan inmediatamente la coherencia textual.',
    order: 1, tags: ['band-booster'] },
  { examName: 'DELE', sectionType: 'speaking-part-1', category: 'strategy',
    title: 'Prepara fórmulas de cortesía',
    body:
      'En el monólogo, abrir y cerrar con frases formales transmite control:\n\n' +
      'APERTURA:\n' +
      '"Buenos días. Voy a hablar sobre..."\n' +
      '"En primer lugar, me gustaría señalar que..."\n\n' +
      'CIERRE:\n' +
      '"En definitiva, podemos concluir que..."\n' +
      '"Muchas gracias por su atención."\n\n' +
      'Memoriza estas frases — te dan un respiro de 5 segundos para pensar el contenido.',
    order: 0, tags: [] },
  { examName: 'DELE', sectionType: 'speaking-part-2', category: 'strategy',
    title: 'Mantén la conversación con preguntas',
    body:
      'En el diálogo con el examinador, no respondas solo: PREGUNTA también.\n\n' +
      'En lugar de:\n' +
      '"Sí, está bien. Quiero la habitación doble."\n\n' +
      'Mejor:\n' +
      '"Sí, está bien. ¿Y el desayuno está incluido? ¿A qué hora podría hacer el check-in?"\n\n' +
      'Las preguntas demuestran fluidez y manejo del intercambio comunicativo — claves para la nota.',
    order: 0, tags: ['fluency'] },
  { examName: 'DELE', sectionType: 'speaking-part-3', category: 'strategy',
    title: 'Estructura del debate',
    body:
      'Para defender una postura en la conversación:\n\n' +
      '1. Toma una postura clara: "Creo que..."\n' +
      '2. Da dos razones: "En primer lugar... En segundo lugar..."\n' +
      '3. Concede algo al lado contrario: "Es cierto que... sin embargo..."\n' +
      '4. Cierra con tu postura reforzada: "Por todo ello, mantengo que..."\n\n' +
      'La concesión es lo que separa un C1 de un B2.',
    order: 0, tags: ['band-booster'] },
  { examName: 'DELE', sectionType: null, category: 'vocabulary',
    title: 'Sinónimos para evitar repeticiones',
    body:
      'Repetir la misma palabra reduce la nota léxica. Aprende parejas:\n\n' +
      '• problema → cuestión / asunto / inconveniente\n' +
      '• importante → fundamental / esencial / crucial\n' +
      '• bueno → adecuado / acertado / beneficioso\n' +
      '• malo → perjudicial / contraproducente / lamentable\n' +
      '• dijo → afirmó / señaló / manifestó\n\n' +
      'Un sinónimo por párrafo es suficiente — no fuerces.',
    order: 0, tags: ['band-booster'] },
  { examName: 'DELE', sectionType: null, category: 'pronunciation',
    title: 'Cuidado con las vocales',
    body:
      'El español es un idioma de vocales puras (a, e, i, o, u). Cada vocal se pronuncia siempre igual.\n\n' +
      '• "casa" — KAH-sah (NO kei-sah)\n' +
      '• "libro" — LEE-broh (NO LAI-broh)\n' +
      '• "uno" — OO-noh (NO YU-noh)\n\n' +
      'Estabilizar las vocales es la mejora más rápida de pronunciación para hablantes de inglés.',
    order: 0, tags: [] },
  { examName: 'DELE', sectionType: null, category: 'cultural-notes',
    title: 'Diferencias entre España y Latinoamérica',
    body:
      'DELE acepta cualquier variante del español. Pero sé CONSISTENTE en una variante:\n\n' +
      'ESPAÑA: "vosotros", "coger" (tomar), "ordenador", "vale"\n' +
      'LATAM:  "ustedes", "tomar" (coger es vulgar en algunos países), "computadora", "está bien"\n\n' +
      'Mezclar variantes en la misma respuesta confunde al examinador. Decide tu variante y mantenla.',
    order: 0, tags: [] },
  { examName: 'DELE', sectionType: null, category: 'time-management',
    title: 'Reparto del tiempo en cada prueba',
    body:
      'DELE B2 dura unas 4 horas. Reparte el tiempo así:\n\n' +
      '• Lectura (70 min): 18 min por tarea, 5 min final para revisar\n' +
      '• Audición (40 min): no se puede repetir — cuidado con la atención\n' +
      '• Escritura (80 min): Tarea 1 → 25 min, Tarea 2 → 45 min, revisión → 10 min\n' +
      '• Hablar (15 min): no hay tiempo extra — la práctica previa es lo único que ayuda',
    order: 0, tags: ['time-management'] },
  { examName: 'DELE', sectionType: null, category: 'common-mistakes',
    title: 'Errores que cuestan puntos',
    body:
      'Errores frecuentes que los examinadores penalizan especialmente:\n\n' +
      '• Confundir "ser" y "estar"\n' +
      '• Concordancia de género: "el problema" (masculino, no "la problema")\n' +
      '• Por vs Para: "por la mañana" (durante), "para mañana" (plazo)\n' +
      '• Acentos olvidados: "está" (verbo) vs "esta" (demostrativo)\n\n' +
      'Estos errores en B2 limitan la nota a 60-70%. Revísalos siempre.',
    order: 1, tags: [] },
  { examName: 'DELE', sectionType: null, category: 'strategy',
    title: 'Construye tu propio banco de frases',
    body:
      'Crea una lista personal de "frases gancho" que puedas adaptar:\n\n' +
      '• "Desde mi punto de vista,..."\n' +
      '• "No cabe duda de que..."\n' +
      '• "Si bien es cierto que..., también lo es que..."\n' +
      '• "Para ilustrarlo con un ejemplo,..."\n' +
      '• "Cabe destacar que..."\n\n' +
      '5–10 frases bien aprendidas son más útiles que un vocabulario amplio sin práctica.',
    order: 1, tags: ['band-booster'] },
  { examName: 'DELE', sectionType: 'vocabulary', category: 'band-booster',
    title: 'Modismos seguros — uno por respuesta',
    body:
      'Para nivel C1+, integra UN modismo por respuesta extendida. Modismos seguros:\n\n' +
      '• "echar una mano" (ayudar)\n' +
      '• "estar al día" (mantenerse informado)\n' +
      '• "dar en el clavo" (acertar)\n' +
      '• "no hay mal que por bien no venga"\n\n' +
      'Más de uno por respuesta suena forzado. Uno bien colocado eleva la nota.',
    order: 0, tags: ['band-booster'] },
  { examName: 'DELE', sectionType: null, category: 'pronunciation',
    title: 'La "r" rolled',
    body:
      'La "rr" doble (perro, carro) y la "r" inicial (rojo, ratón) requieren vibración. Si no la dominas:\n\n' +
      '• Practica con "tr" o "dr" primero: tres, drama\n' +
      '• Repite secuencias: "rojo ratón roe roble"\n' +
      '• La inteligibilidad importa más que la perfección — un sonido fuerte basta',
    order: 1, tags: [] },
  { examName: 'DELE', sectionType: 'speaking-part-1', category: 'fluency',
    title: 'Evita la traducción mental',
    body:
      'Si traduces frase por frase desde tu idioma, hablarás 3× más lento y con errores estructurales.\n\n' +
      'Estrategias:\n' +
      '• Piensa en "trozos" (chunks): "me gusta", "tengo que", "lo que pasa es que..."\n' +
      '• Si no sabes una palabra exacta, parafrasea: "una persona que enseña niños" en lugar de "maestro"\n' +
      '• Practica narrar tu día EN ESPAÑOL como rutina diaria — entrena el músculo',
    order: 1, tags: ['fluency'] },

  // =========================================================================
  // TOPIK
  // =========================================================================
  { examName: 'TOPIK', sectionType: null, category: 'strategy',
    title: 'TOPIK 등급 이해하기',
    body:
      'TOPIK은 6단계 자격 시험입니다. 자신의 목표 등급을 명확히 하면 공부의 우선순위가 잡힙니다.\n\n' +
      '• TOPIK I (1–2급): 기초 — 일상 대화\n' +
      '• TOPIK II 3–4급: 중급 — 대학·일반 사무\n' +
      '• TOPIK II 5–6급: 고급 — 학술·전문 분야\n\n' +
      '대학 입학에는 보통 4급 이상, 한국 기업 취업에는 5급 이상이 요구됩니다. 목표에 맞춰 학습 전략을 세우세요.',
    order: 0, tags: [] },
  { examName: 'TOPIK', sectionType: null, category: 'time-management',
    title: '시간 배분의 원칙',
    body:
      'TOPIK II는 3시간이라는 긴 시험입니다. 시간 배분 전략:\n\n' +
      '• 듣기 (60분 / 50문항): 한 문항당 약 70초 — 절대 한 문제에 매달리지 마세요\n' +
      '• 읽기 (70분 / 50문항): 짧은 글부터 풀어 시간 확보\n' +
      '• 쓰기 (50분 / 4문항): 짧은 단답 → 짧은 글 → 긴 글 순서로\n\n' +
      '쓰기는 시간이 가장 부족합니다. 긴 글에 25분은 반드시 남겨 두세요.',
    order: 0, tags: ['time-management'] },
  { examName: 'TOPIK', sectionType: 'reading', category: 'strategy',
    title: '주제 찾기 문제의 핵심',
    body:
      'TOPIK 읽기에서 가장 자주 나오는 유형: "이 글의 주제로 알맞은 것은?"\n\n' +
      '전략:\n' +
      '1. 첫 문장과 마지막 문장만 빠르게 읽기\n' +
      '2. "그러므로", "따라서", "결국" 같은 결론어 다음 문장을 주목\n' +
      '3. 본문에서 반복되는 핵심 명사가 답의 단서\n\n' +
      '세부 정보를 묻는 문제와 주제를 묻는 문제는 풀이 방식이 다릅니다. 질문 유형을 먼저 확인하세요.',
    order: 0, tags: [] },
  { examName: 'TOPIK', sectionType: 'reading', category: 'common-mistakes',
    title: '문장 순서 정렬 문제 풀이법',
    body:
      'TOPIK 읽기의 어려운 유형 중 하나는 문장을 올바른 순서로 배열하는 문제입니다.\n\n' +
      '단서:\n' +
      '• 첫 문장에는 보통 일반적인 내용이나 주제 도입\n' +
      '• 지시어("이", "그", "이러한")가 있으면 앞 문장과 연결\n' +
      '• 접속사("그러나", "또한", "따라서")는 문장 시작에서 흐름을 알려줌\n' +
      '• 시간 표현 순서: 처음에 → 그 후 → 마지막에\n\n' +
      '단서 단어들을 표시하면 답이 보입니다.',
    order: 1, tags: [] },
  { examName: 'TOPIK', sectionType: 'writing-task-1', category: 'strategy',
    title: '빈칸 채우기 문제 (51, 52번)',
    body:
      'TOPIK 쓰기 51–52번은 두 개의 빈칸을 채우는 문제입니다.\n\n' +
      '핵심 원칙:\n' +
      '• 앞뒤 문맥에 맞는 자연스러운 한국어 표현 사용\n' +
      '• 격식체("-습니다", "-입니다") 유지 — 반말 금지\n' +
      '• 문장 끝을 정확히 마무리하기\n' +
      '• 짧고 명확하게 (10–25자 정도)\n\n' +
      '문법보다 자연스러움이 중요. 너무 어려운 표현은 피하세요.',
    order: 0, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: 'writing-task-1', category: 'grammar',
    title: '53번 짧은 글 (200–300자)',
    body:
      'TOPIK 쓰기 53번은 그래프나 통계를 설명하는 200–300자의 짧은 글입니다.\n\n' +
      '구조:\n' +
      '1. 그래프 도입: "조사 결과에 따르면..."\n' +
      '2. 수치 비교: "X는 Y보다 ~%p 높았다 / 낮았다."\n' +
      '3. 변화 양상: "꾸준히 증가하다 / 감소하다."\n' +
      '4. 결론: "이를 통해 ~을 알 수 있다."\n\n' +
      '글자 수를 맞추세요 — 부족하거나 넘쳐도 감점입니다.',
    order: 1, tags: [] },
  { examName: 'TOPIK', sectionType: 'writing-task-2', category: 'strategy',
    title: '54번 긴 글 (600–700자) 구조',
    body:
      'TOPIK 쓰기 54번은 600–700자의 의견 글입니다. 50분에서 25분 이상은 이 문제에 할당하세요.\n\n' +
      '5-단락 구조:\n' +
      '1. 서론 (100자) — 주제 도입 + 본인의 입장 명시\n' +
      '2. 본론 1 (150자) — 첫 번째 근거 + 예시\n' +
      '3. 본론 2 (150자) — 두 번째 근거 + 예시\n' +
      '4. 반대 의견 인정 (100자) — "물론 ~라는 견해도 있지만..."\n' +
      '5. 결론 (100자) — 본인의 입장 재강조 + 마무리',
    order: 0, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: 'writing-task-2', category: 'grammar',
    title: '문어체 어휘 사용',
    body:
      '쓰기 시험에서는 구어체("같다", "괜찮다", "그래서")를 피하고 문어체로 통일하세요:\n\n' +
      '• 같다 → 동일하다 / 유사하다\n' +
      '• 좋다 → 바람직하다 / 유리하다\n' +
      '• 그래서 → 따라서 / 그러므로\n' +
      '• 너무 → 매우 / 지나치게\n' +
      '• 보다 → 살펴보다 / 검토하다\n\n' +
      '문어체 표현 10개만 익혀도 어휘 점수가 크게 오릅니다.',
    order: 1, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: null, category: 'grammar',
    title: '존댓말 일관성 유지',
    body:
      '한국어는 존댓말 체계가 복잡합니다. TOPIK에서는 다음과 같이 사용하세요:\n\n' +
      '• 쓰기 / 격식 있는 말하기: "-(스/이)ㅂ니다", "-(스/이)ㅂ시오"\n' +
      '• 일상 말하기: "-아요/어요"\n' +
      '• 친한 사이: "-야/-아" (시험에서 사용 금지)\n\n' +
      '한 답변 안에서 격식이 바뀌면 감점. 시작부터 끝까지 같은 등급의 종결어미를 사용하세요.',
    order: 0, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: 'speaking-part-1', category: 'strategy',
    title: '짧은 답변 (질문에 답하기) 요령',
    body:
      'TOPIK 말하기 1번 유형은 짧은 답변입니다. 30초 정도의 답이 적절합니다.\n\n' +
      '구조:\n' +
      '1. 인사 또는 도입: "안녕하세요. 저는..."\n' +
      '2. 핵심 정보 (1–2문장)\n' +
      '3. 짧은 보충 정보 또는 이유\n\n' +
      '예시: "안녕하세요. 저는 김민수라고 합니다. 한국에서 한국어와 역사를 공부하고 있는 대학생입니다. 한국 문화에 관심이 많아서 이번 시험에 응시하게 되었습니다."',
    order: 0, tags: [] },
  { examName: 'TOPIK', sectionType: 'speaking-part-2', category: 'strategy',
    title: '긴 답변에서 시제 변화 보여주기',
    body:
      'TOPIK 말하기 2–4번은 긴 답변(1–2분)이 필요합니다. 점수를 높이는 핵심은 시제의 다양성입니다.\n\n' +
      '• 과거: "예전에 ~했습니다."\n' +
      '• 현재: "지금은 ~고 있습니다."\n' +
      '• 미래: "앞으로는 ~할 것 같습니다."\n' +
      '• 현재완료적 표현: "~한 적이 있습니다."\n\n' +
      '한 답변에 3–4가지 시제가 자연스럽게 섞이면 고급으로 평가됩니다.',
    order: 0, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: 'speaking-part-3', category: 'strategy',
    title: '의견 말하기 — 양면을 보여주세요',
    body:
      '말하기 6번(고급 의견) 유형에서는 한쪽 의견만 말하면 점수가 낮습니다.\n\n' +
      '권장 구조:\n' +
      '1. 본인 입장 명시: "저는 ~라고 생각합니다."\n' +
      '2. 첫 번째 근거 + 예시\n' +
      '3. 반대 측 인정: "물론 ~라는 의견도 있을 수 있습니다."\n' +
      '4. 그러나 본인 입장 재강조: "그러나 결국..."\n\n' +
      '"양면 → 본인 견해"의 흐름이 5–6급의 핵심 마커입니다.',
    order: 0, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: null, category: 'vocabulary',
    title: '한자어 어휘 학습',
    body:
      'TOPIK 고급에서는 한자어(漢字語)의 사용이 중요합니다. 같은 의미라도 한자어가 더 격식 있습니다.\n\n' +
      '• 도와주다 (고유어) → 지원하다 (한자어)\n' +
      '• 만들다 → 제작하다 / 생산하다\n' +
      '• 알다 → 파악하다 / 인지하다\n' +
      '• 보다 → 검토하다 / 확인하다\n' +
      '• 생각하다 → 사고하다 / 판단하다\n\n' +
      '쓰기와 말하기 모두에서 한자어를 적절히 섞으면 등급이 올라갑니다.',
    order: 0, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: null, category: 'pronunciation',
    title: '한국어 받침 발음',
    body:
      '한국어 받침은 7가지 대표음(ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅇ)으로 발음됩니다.\n\n' +
      '예:\n' +
      '• 옷 [옫] (ㅅ → ㄷ 발음)\n' +
      '• 부엌 [부억] (ㅋ → ㄱ 발음)\n' +
      '• 잎 [입] (ㅍ → ㅂ 발음)\n\n' +
      '연음 규칙도 중요:\n' +
      '• 음악 → [으막] (ㅁ + ㅇ → ㅁ이 다음으로 넘어감)\n\n' +
      '받침 발음이 부정확하면 청자가 단어를 알아듣지 못해 의사소통에 실패합니다.',
    order: 0, tags: [] },
  { examName: 'TOPIK', sectionType: null, category: 'cultural-notes',
    title: '한국식 사고 방식 이해하기',
    body:
      'TOPIK 시험은 한국 사회와 문화에 대한 이해를 전제로 합니다. 자주 등장하는 주제:\n\n' +
      '• 정 (情) — 인간관계의 깊은 유대\n' +
      '• 효 (孝) — 부모와 어른에 대한 존경\n' +
      '• 빨리빨리 문화 — 효율성 추구\n' +
      '• 집단주의 vs 개인주의 — "우리"의 사용\n' +
      '• 학벌 사회 — 교육열과 입시 문화\n\n' +
      '이러한 개념을 표현할 어휘를 미리 익혀 두면 듣기와 읽기에서 유리합니다.',
    order: 0, tags: [] },
  { examName: 'TOPIK', sectionType: null, category: 'common-mistakes',
    title: '자주 틀리는 조사',
    body:
      '한국어 조사는 외국인이 가장 어려워하는 부분입니다. 자주 틀리는 것들:\n\n' +
      '• "을/를" (목적격) vs "이/가" (주격) — 동사가 자동사인지 타동사인지 확인\n' +
      '• "에" (장소·시간) vs "에서" (행동의 장소)\n' +
      '   ~ "도서관에 갑니다" / "도서관에서 공부합니다"\n' +
      '• "은/는" (대조·주제) vs "이/가" (새 정보)\n' +
      '• "도" (~도) vs "만" (~만 — 한정)\n\n' +
      '문장을 쓸 때 조사부터 점검하는 습관을 들이세요.',
    order: 1, tags: [] },
  { examName: 'TOPIK', sectionType: 'listening', category: 'strategy',
    title: '듣기 — 키워드 먼저 표시하기',
    body:
      'TOPIK 듣기는 한 번만 들려줍니다. 음성을 듣기 전에 문제와 보기를 빠르게 훑어보세요.\n\n' +
      '단계:\n' +
      '1. 음성 시작 전 5초 동안 문제와 선택지의 핵심 명사·동사 표시\n' +
      '2. 음성이 나오는 동안 표시한 단어에 집중\n' +
      '3. 음성이 끝나기 전에 답 결정 — 다음 문제 미리 보기\n\n' +
      '"이제 들으세요" 직후가 가장 집중력이 필요한 순간입니다.',
    order: 0, tags: ['time-management'] },
  { examName: 'TOPIK', sectionType: null, category: 'time-management',
    title: '시험 전 1주 — 마무리 전략',
    body:
      '시험 직전 1주일에는 새로운 것을 배우기보다 마무리에 집중하세요:\n\n' +
      '• 1–3일 전: 지난 기출문제 1회 더 풀기 (실전 모드)\n' +
      '• 4–5일 전: 약점 영역 집중 — 보통 쓰기와 듣기\n' +
      '• 6–7일 전: 어휘 정리 (자주 등장한 단어 200개)\n\n' +
      '시험 전날에는 가벼운 복습만 하고 충분히 잠을 자는 것이 가장 효과적입니다.',
    order: 0, tags: [] },
  { examName: 'TOPIK', sectionType: 'vocabulary', category: 'band-booster',
    title: '고급 어휘 — 추상명사',
    body:
      'TOPIK 5–6급에서는 추상명사의 정확한 사용이 평가됩니다:\n\n' +
      '• 가치 (價値) — 어떤 것의 중요성\n' +
      '• 의미 (意味) — 함의·중요성\n' +
      '• 영향 (影響) — 작용·결과\n' +
      '• 본질 (本質) — 사물의 핵심\n' +
      '• 관점 (觀點) — 보는 입장·시각\n' +
      '• 차원 (次元) — 수준·층위\n\n' +
      '"의미가 있다", "영향을 미치다", "관점에서 보면" 같은 콜로케이션을 함께 익히세요.',
    order: 0, tags: ['band-booster'] },
  { examName: 'TOPIK', sectionType: 'speaking-part-2', category: 'fluency',
    title: '담화 표지어 (Discourse Markers)',
    body:
      '긴 말하기에서 담화 표지어를 사용하면 자연스럽고 논리적인 흐름이 만들어집니다:\n\n' +
      '• 우선 / 먼저 — 첫 번째 요점\n' +
      '• 그뿐만 아니라 / 더 나아가 — 추가\n' +
      '• 한편 / 반면에 — 대조\n' +
      '• 예를 들어 / 가령 — 예시\n' +
      '• 다시 말해 / 즉 — 부연설명\n' +
      '• 따라서 / 결국 — 결론\n\n' +
      '한 답변에 3–4개를 자연스럽게 섞으면 5급 이상으로 평가받습니다.',
    order: 1, tags: ['band-booster'] },
];

async function seed() {
  console.log('\u{1f504} Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
    maxPoolSize: 10,
  });
  console.log('✅ Connected');

  // Look up exams by name.
  const examByName = {};
  for (const code of ['IELTS', 'DELE', 'TOPIK']) {
    const exam = await ExamType.findOne({ name: code });
    if (!exam) throw new Error(`Exam ${code} not found — run seedExamStudy.js first`);
    examByName[code] = exam;
  }

  let created = 0;
  let skipped = 0;
  for (const t of TIPS) {
    const exam = examByName[t.examName];
    const exists = await ExamStudyTip.findOne({ examId: exam._id, title: t.title });
    if (exists) {
      skipped += 1;
      continue;
    }
    await ExamStudyTip.create({
      examId: exam._id,
      sectionType: t.sectionType,
      category: t.category,
      title: t.title,
      body: t.body,
      tags: t.tags || [],
      order: t.order || 0,
    });
    created += 1;
  }

  console.log(`+ Created ${created} study tips (${skipped} already existed)`);
  console.log('✅ Seed complete');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
