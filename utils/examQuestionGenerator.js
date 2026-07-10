const { READING_TEMPLATES, WRITING_TEMPLATES, SPEAKING_TEMPLATES } = require('./questionTemplates');

// Language-specific topics and content
const LANGUAGE_CONFIG = {
  en: {
    name: 'English',
    topics: {
      reading: ['Climate and Environment', 'Technology and Innovation', 'Education and Learning', 'Work and Career', 'Health and Wellness', 'Travel and Culture', 'Family and Relationships', 'Food and Nutrition', 'Sports and Recreation', 'Media and Communication', 'Ethics and Values', 'Arts and Creativity', 'Finance and Economics', 'Social Issues', 'Science and Discovery', 'History and Heritage', 'Urban Life', 'Nature and Wildlife', 'Transportation', 'Entertainment'],
      speaking: ['Hobbies', 'Travel', 'Work', 'Education', 'Family', 'Technology', 'Environment', 'Health', 'Culture', 'Sports', 'Food', 'Media', 'Relationships', 'Career', 'Social Issues', 'Art', 'Money and Finance', 'Local Customs', 'Current Events', 'Future Plans']
    }
  },
  fr: {
    name: 'French',
    topics: {
      reading: ['Environnement et climat', 'Technologie et innovation', 'Éducation et apprentissage', 'Travail et carrière', 'Santé et bien-être', 'Voyages et culture', 'Famille et relations', 'Alimentation et nutrition', 'Sports et loisirs', 'Médias et communication', 'Éthique et valeurs', 'Arts et créativité', 'Finance et économie', 'Questions sociales', 'Science et découverte', 'Histoire et patrimoine', 'Vie urbaine', 'Nature et faune', 'Transport', 'Divertissement'],
      speaking: ['Loisirs', 'Voyage', 'Travail', 'Éducation', 'Famille', 'Technologie', 'Environnement', 'Santé', 'Culture', 'Sports', 'Nourriture', 'Médias', 'Relations', 'Carrière', 'Questions sociales', 'Art', 'Finances', 'Traditions locales', 'Événements actuels', 'Plans futurs']
    }
  },
  de: {
    name: 'German',
    topics: {
      reading: ['Umwelt und Klima', 'Technologie und Innovation', 'Bildung und Lernen', 'Arbeit und Karriere', 'Gesundheit und Wohlbefinden', 'Reisen und Kultur', 'Familie und Beziehungen', 'Ernährung und Nahrung', 'Sport und Freizeit', 'Medien und Kommunikation', 'Ethik und Werte', 'Kunst und Kreativität', 'Finanzen und Wirtschaft', 'Soziale Themen', 'Wissenschaft und Entdeckung', 'Geschichte und Erbe', 'Stadtleben', 'Natur und Wildnis', 'Verkehr', 'Unterhaltung'],
      speaking: ['Hobbys', 'Reisen', 'Arbeit', 'Bildung', 'Familie', 'Technologie', 'Umwelt', 'Gesundheit', 'Kultur', 'Sport', 'Essen', 'Medien', 'Beziehungen', 'Karriere', 'Soziale Fragen', 'Kunst', 'Finanzen', 'Lokale Traditionen', 'Aktuelle Ereignisse', 'Zukunftspläne']
    }
  },
  zh: {
    name: 'Chinese',
    topics: {
      reading: ['环境与气候', '科技与创新', '教育与学习', '工作与职业', '健康与健身', '旅游与文化', '家庭与关系', '食物与营养', '运动与娱乐', '媒体与通讯', '伦理与价值观', '艺术与创意', '金融与经济', '社会问题', '科学与发现', '历史与遗产', '城市生活', '自然与野生动物', '交通运输', '娱乐'],
      speaking: ['爱好', '旅游', '工作', '教育', '家庭', '技术', '环境', '健康', '文化', '运动', '食物', '媒体', '关系', '职业', '社会问题', '艺术', '金融', '当地习俗', '时事新闻', '未来计划']
    }
  },
  ja: {
    name: 'Japanese',
    topics: {
      reading: ['環境と気候', '技術と革新', '教育と学習', '仕事とキャリア', '健康とウェルネス', '旅行と文化', '家族と関係', '食事と栄養', 'スポーツとレクリエーション', 'メディアと通信', '倫理と価値観', '芸術と創意工夫', '金融と経済', '社会問題', '科学と発見', '歴史と遺産', '都市生活', '自然と野生動物', '交通手段', 'エンターテイメント'],
      speaking: ['趣味', '旅行', '仕事', '教育', '家族', '技術', '環境', '健康', '文化', 'スポーツ', '食べ物', 'メディア', '関係', 'キャリア', '社会問題', '芸術', '金融', '地域の習慣', '時事ニュース', '将来の計画']
    }
  },
  pt: {
    name: 'Portuguese',
    topics: {
      reading: ['Ambiente e clima', 'Tecnologia e inovação', 'Educação e aprendizagem', 'Trabalho e carreira', 'Saúde e bem-estar', 'Viagem e cultura', 'Família e relacionamentos', 'Alimentação e nutrição', 'Esportes e recreação', 'Mídia e comunicação', 'Ética e valores', 'Artes e criatividade', 'Finanças e economia', 'Questões sociais', 'Ciência e descoberta', 'História e patrimônio', 'Vida urbana', 'Natureza e vida selvagem', 'Transporte', 'Entretenimento'],
      speaking: ['Hobbies', 'Viagem', 'Trabalho', 'Educação', 'Família', 'Tecnologia', 'Ambiente', 'Saúde', 'Cultura', 'Esportes', 'Comida', 'Mídia', 'Relacionamentos', 'Carreira', 'Questões sociais', 'Arte', 'Finanças', 'Costumes locais', 'Eventos atuais', 'Planos futuros']
    }
  },
  it: {
    name: 'Italian',
    topics: {
      reading: ['Ambiente e clima', 'Tecnologia e innovazione', 'Istruzione e apprendimento', 'Lavoro e carriera', 'Salute e benessere', 'Viaggi e cultura', 'Famiglia e relazioni', 'Cibo e nutrizione', 'Sport e ricreazione', 'Media e comunicazione', 'Etica e valori', 'Arti e creatività', 'Finanza ed economia', 'Questioni sociali', 'Scienza e scoperta', 'Storia e patrimonio', 'Vita urbana', 'Natura e fauna', 'Trasporto', 'Intrattenimento'],
      speaking: ['Hobby', 'Viaggio', 'Lavoro', 'Istruzione', 'Famiglia', 'Tecnologia', 'Ambiente', 'Salute', 'Cultura', 'Sport', 'Cibo', 'Media', 'Relazioni', 'Carriera', 'Questioni sociali', 'Arte', 'Finanza', 'Tradizioni locali', 'Eventi attuali', 'Piani futuri']
    }
  },
  es: {
    name: 'Spanish',
    topics: {
      reading: ['Ambiente y clima', 'Tecnología e innovación', 'Educación y aprendizaje', 'Trabajo y carrera', 'Salud y bienestar', 'Viajes y cultura', 'Familia y relaciones', 'Alimentos y nutrición', 'Deportes y recreación', 'Medios de comunicación', 'Ética y valores', 'Artes y creatividad', 'Finanzas y economía', 'Cuestiones sociales', 'Ciencia y descubrimiento', 'Historia y patrimonio', 'Vida urbana', 'Naturaleza y vida silvestre', 'Transporte', 'Entretenimiento'],
      speaking: ['Pasatiempos', 'Viaje', 'Trabajo', 'Educación', 'Familia', 'Tecnología', 'Ambiente', 'Salud', 'Cultura', 'Deporte', 'Comida', 'Medios', 'Relaciones', 'Carrera', 'Cuestiones sociales', 'Arte', 'Finanzas', 'Costumbres locales', 'Eventos actuales', 'Planes futuros']
    }
  },
  ko: {
    name: 'Korean',
    topics: {
      reading: ['환경과 기후', '기술과 혁신', '교육과 학습', '일과 경력', '건강과 웰빙', '여행과 문화', '가족과 관계', '음식과 영양', '스포츠와 레크리에이션', '미디어와 통신', '윤리와 가치', '예술과 창의성', '금융과 경제', '사회 문제', '과학과 발견', '역사와 유산', '도시 생활', '자연과 야생동물', '교통', '엔터테인먼트'],
      speaking: ['취미', '여행', '일', '교육', '가족', '기술', '환경', '건강', '문화', '스포츠', '음식', '미디어', '관계', '경력', '사회 문제', '예술', '금융', '지역 관습', '시사', '미래 계획']
    }
  }
};

function getLanguageConfig(languageCode) {
  const config = LANGUAGE_CONFIG[languageCode] || LANGUAGE_CONFIG['en'];
  return config;
}

function generateLanguageSpecificReadingQuestion(topic, questionType, language, questionNumber) {
  // Language-specific reading question templates
  const templates = {
    en: {
      mainIdea: [
        `Which of the following best summarizes the passage about ${topic}?`,
        `The main idea of the text on ${topic} is that:`,
        `According to the passage about ${topic}, the author primarily argues:`,
      ],
      vocabulary: [
        `In the passage about ${topic}, the word "essential" most closely means:`,
        `What does the term related to ${topic} refer to in the context?`,
      ],
      inference: [
        `Based on the text about ${topic}, it can be inferred that:`,
        `The passage about ${topic} suggests that in the future:`,
      ],
      newsArticle: [
        `According to the article about ${topic}, what is the main development?`,
        `In the news report on ${topic}, the primary focus is:`,
      ],
      opinionPiece: [
        `The author's main argument regarding ${topic} is that:`,
        `Based on the opinion piece about ${topic}, the writer believes:`,
      ],
      technicalContent: [
        `In the technical passage about ${topic}, the process involves:`,
        `According to the text, the key function of ${topic} is:`,
      ]
    },
    fr: {
      mainIdea: [
        `Quel énoncé résume le mieux le texte sur ${topic} ?`,
        `L'idée principale du texte sur ${topic} est que :`,
        `Selon le passage sur ${topic}, l'auteur affirme principalement :`,
      ],
      vocabulary: [
        `Dans le texte sur ${topic}, le mot \"essentiel\" signifie le plus :`,
        `Quel terme dans le contexte de ${topic} signifie :`,
      ],
      inference: [
        `Basé sur le texte sur ${topic}, on peut en déduire que :`,
        `Le passage sur ${topic} suggère que à l'avenir :`,
      ]
    },
    de: {
      mainIdea: [
        `Welche Aussage fasst den Text über ${topic} am besten zusammen?`,
        `Die Hauptidee des Textes über ${topic} ist, dass :`,
        `Nach dem Absatz über ${topic} argumentiert der Autor hauptsächlich :`,
      ],
      vocabulary: [
        `Im Text über ${topic} bedeutet das Wort \"wesentlich\" am nächsten :`,
        `Was bedeutet der Begriff im Zusammenhang mit ${topic} :`,
      ]
    },
    zh: {
      mainIdea: [
        `关于${topic}的文章的主要思想是：`,
        `根据关于${topic}的段落，作者主要论证：`,
      ],
      vocabulary: [
        `在关于${topic}的文章中，"关键"这个词最接近的意思是：`,
        `在${topic}的背景下，该术语指的是：`,
      ]
    },
    ja: {
      mainIdea: [
        `${topic}に関するテキストの主な思想は次のとおりです。`,
        `${topic}に関する段落に基づいて、著者は主に主張しています。`,
      ],
      vocabulary: [
        `${topic}に関するテキストでは、「本質的」という言葉は最も一致する意味は。`,
        `${topic}の文脈では、その用語は以下を指しています。`,
      ]
    },
    pt: {
      mainIdea: [
        `Qual afirmação resume melhor o texto sobre ${topic}?`,
        `A ideia principal do texto sobre ${topic} é que :`,
      ],
      vocabulary: [
        `No texto sobre ${topic}, a palavra \"essencial\" significa mais :`,
        `Qual termo no contexto de ${topic} significa :`,
      ]
    },
    it: {
      mainIdea: [
        `Quale affermazione riassume meglio il testo su ${topic}?`,
        `L'idea principale del testo su ${topic} è che :`,
      ],
      vocabulary: [
        `Nel testo su ${topic}, la parola \"essenziale\" significa più :`,
        `Quale termine nel contesto di ${topic} significa :`,
      ]
    },
    es: {
      mainIdea: [
        `¿Cuál afirmación resume mejor el texto sobre ${topic}?`,
        `La idea principal del texto sobre ${topic} es que :`,
      ],
      vocabulary: [
        `En el texto sobre ${topic}, la palabra \"esencial\" significa más :`,
        `¿Qué término en el contexto de ${topic} significa :`,
      ]
    },
    ko: {
      mainIdea: [
        `${topic}에 관한 텍스트의 주요 아이디어는 다음과 같습니다.`,
        `${topic}에 관한 단락에 따르면 저자는 주로 주장하고 있습니다.`,
      ],
      vocabulary: [
        `${topic}에 관한 텍스트에서 \"필수\"라는 단어는 가장 가깝게 의미합니다.`,
        `${topic}의 맥락에서 그 용어는 다음을 의미합니다.`,
      ]
    }
  };

  const languageTemplates = templates[language] || templates['en'];
  const questionTemplates = languageTemplates[questionType] || languageTemplates['mainIdea'];
  return questionTemplates[questionNumber % questionTemplates.length];
}

function generateReadingQuestions(count, language = 'en') {
  const questions = [];
  const config = getLanguageConfig(language);
  const topicsToUse = config.topics.reading;
  const readingTypes = ['mainIdea', 'vocabulary', 'inference', 'newsArticle', 'opinionPiece', 'technicalContent'];

  for (let i = 0; i < count; i++) {
    const questionType = readingTypes[i % readingTypes.length];
    const topic = topicsToUse[i % topicsToUse.length];
    const difficulty = ['easy', 'medium', 'hard'][Math.floor(i / (count / 3))];

    const questionText = generateLanguageSpecificReadingQuestion(topic, questionType, language, i);

    const question = {
      topic: topic,
      questionText: `${questionText} (Question ${i + 1})`,
      questionType: 'multiple-choice',
      options: generateLanguageSpecificOptions(language, difficulty),
      correctAnswer: 'B',
      explanation: `This question tests comprehension of the concept of ${topic}.`,
      difficulty: difficulty,
      source: 'builtin',
    };

    questions.push(question);
  }

  return questions;
}

function generateLanguageSpecificWritingPrompt(topic, type, language) {
  const prompts = {
    en: {
      letter: `Write a letter to a local authority about ${topic}. Include: • what the issue is • why it affects you • what action you want them to take.`,
      essay: `Write an essay about ${topic}. Discuss: • what it is • its importance • your perspective. Write at least 250 words.`,
      email: `Write a professional email to your manager about ${topic}. Include: • the purpose • key details • your request or suggestion.`,
      creativePiece: `Write a creative piece inspired by ${topic}. You can write a short story, dialogue, or descriptive narrative. Include vivid details.`,
      summary: `Summarize the key points about ${topic} in no more than 150 words. Include only the most important information.`,
      report: `Write a report on ${topic}. Include: • an overview • your findings • recommendations for improvement.`,
      review: `Write a review about ${topic}. Include: • what it is • your experience or opinion • your recommendation to others.`,
      proposal: `Write a proposal to address ${topic}. Include: • the problem • your proposed solution • expected benefits.`,
      formalLetter: `Write a formal business letter regarding ${topic}. Use proper formatting, professional tone, and clear paragraphs to present your message.`,
    },
    fr: {
      letter: `Écrivez une lettre à une autorité locale au sujet de ${topic}. Incluez : • quel est le problème • pourquoi cela vous affecte • quelle action vous voulez qu'ils prennent.`,
      essay: `Rédigez un essai sur ${topic}. Discutez : • ce que c'est • son importance • votre perspective. Écrivez au moins 250 mots.`,
      email: `Écrivez un email professionnel à votre manager sur ${topic}. Incluez : • le but • les détails clés • votre demande ou suggestion.`,
      creativePiece: `Écrivez une pièce créative inspirée par ${topic}. Vous pouvez écrire une nouvelle, un dialogue ou une narration descriptive.`,
      summary: `Résumez les points clés sur ${topic} en moins de 150 mots. Incluez uniquement les informations les plus importantes.`,
    },
    de: {
      letter: `Schreiben Sie einen Brief an eine lokale Behörde über ${topic}. Beziehen Sie ein: • Was das Problem ist • Warum es Sie betrifft • Welche Maßnahme Sie ergreifen möchten.`,
      essay: `Schreiben Sie einen Aufsatz über ${topic}. Diskutieren Sie: • Was es ist • Seine Bedeutung • Ihre Perspektive. Schreiben Sie mindestens 250 Wörter.`,
      email: `Schreiben Sie eine professionelle E-Mail an Ihren Manager über ${topic}. Beziehen Sie ein: • Der Zweck • Wichtige Details • Ihre Bitte oder Suggestion.`,
      creativePiece: `Schreiben Sie ein kreatives Stück inspiriert von ${topic}. Sie können eine Kurzgeschichte, einen Dialog oder eine beschreibende Erzählung schreiben.`,
      summary: `Fassen Sie die Schlüsselpunkte über ${topic} in nicht mehr als 150 Wörtern zusammen.`,
    },
    zh: {
      letter: `写一封关于${topic}的信给当地权威部门。包括：• 问题是什么 • 为什么这影响你 • 你想他们采取什么行动。`,
      essay: `写一篇关于${topic}的短文。讨论：• 它是什么 • 它的重要性 • 你的看法。至少写250个单词。`,
      email: `给你的经理写一封专业邮件，讨论${topic}。包括：• 目的 • 关键细节 • 你的请求或建议。`,
      creativePiece: `写一篇受${topic}启发的创意作品。你可以写短篇故事、对话或描写性叙述。`,
      summary: `用不超过150个单词总结关于${topic}的要点。只包括最重要的信息。`,
    },
    ja: {
      letter: `${topic}に関する地元の当局への手紙を書きます。以下を含めます：• 問題とは何か • それがあなたに影響を与える理由 • あなたが彼らに取ってもらいたい行動。`,
      essay: `${topic}に関するエッセイを書きます。以下を議論します：• それとは何か • その重要性 • あなたの視点。少なくとも250語を書きます。`,
      email: `${topic}に関してマネージャーに専門的なメールを書きます。以下を含めます：• 目的 • 重要な詳細 • リクエストまたは提案。`,
      creativePiece: `${topic}からインスピレーションを受けた創造的な作品を書きます。短編、対話、または記述的な物語を書くことができます。`,
      summary: `${topic}に関する重要なポイントを150語以内で要約します。`,
    },
    pt: {
      letter: `Escreva uma carta para uma autoridade local sobre ${topic}. Inclua: • qual é o problema • por que o afeta • que ação você quer que eles tomem.`,
      essay: `Redija um ensaio sobre ${topic}. Discuta: • o que é • sua importância • sua perspectiva. Escreva pelo menos 250 palavras.`,
      email: `Escreva um e-mail profissional para seu gerente sobre ${topic}. Inclua: • o propósito • detalhes-chave • seu pedido ou sugestão.`,
      creativePiece: `Escreva uma peça criativa inspirada em ${topic}. Você pode escrever uma história, diálogo ou narrativa descritiva.`,
      summary: `Resuma os pontos-chave sobre ${topic} em não mais de 150 palavras.`,
    },
    it: {
      letter: `Scrivi una lettera a un'autorità locale riguardante ${topic}. Includi: • qual è il problema • perché ti colpisce • quale azione vuoi che intraprendano.`,
      essay: `Scrivi un saggio su ${topic}. Discuti: • cos'è • la sua importanza • la tua prospettiva. Scrivi almeno 250 parole.`,
      email: `Scrivi un'email professionale al tuo manager riguardante ${topic}. Includi: • lo scopo • dettagli chiave • la tua richiesta o suggerimento.`,
      creativePiece: `Scrivi un pezzo creativo ispirato da ${topic}. Puoi scrivere una storia breve, dialogo o narrativa descrittiva.`,
      summary: `Riassumi i punti chiave riguardanti ${topic} in non più di 150 parole.`,
    },
    es: {
      letter: `Escriba una carta a una autoridad local sobre ${topic}. Incluya: • cuál es el problema • por qué le afecta • qué acción desea que tomen.`,
      essay: `Escriba un ensayo sobre ${topic}. Discuta: • qué es • su importancia • su perspectiva. Escriba al menos 250 palabras.`,
      email: `Escriba un correo profesional a su gerente sobre ${topic}. Incluya: • el propósito • detalles clave • su solicitud o sugerencia.`,
      creativePiece: `Escriba una pieza creativa inspirada en ${topic}. Puede escribir una historia corta, diálogo o narrativa descriptiva.`,
      summary: `Resuma los puntos clave sobre ${topic} en no más de 150 palabras.`,
    },
    ko: {
      letter: `${topic}에 관한 지방 당국에 편지를 쓰세요. 포함: • 문제가 무엇인지 • 왜 당신에게 영향을 미치는지 • 당신이 그들이 취하기를 원하는 조치.`,
      essay: `${topic}에 관한 에세이를 쓰세요. 토론: • 그것이 무엇인지 • 그것의 중요성 • 당신의 관점. 최소 250단어를 쓰세요.`,
      email: `${topic}에 관해 매니저에게 전문적인 이메일을 쓰세요. 포함: • 목적 • 핵심 세부사항 • 당신의 요청 또는 제안.`,
      creativePiece: `${topic}에서 영감을 받은 창의적인 작품을 쓰세요. 단편소설, 대화 또는 묘사적 내러티브를 쓸 수 있습니다.`,
      summary: `${topic}에 관한 핵심 요점을 150단어 이내로 요약하세요.`,
    }
  };

  const languagePrompts = prompts[language] || prompts['en'];
  return languagePrompts[type] || languagePrompts['essay'];
}

function generateWritingQuestions(count, language = 'en') {
  const questions = [];
  const types = ['letter', 'essay', 'report', 'review', 'email', 'creativePiece', 'summary', 'proposal', 'formalLetter'];
  const config = getLanguageConfig(language);
  const topics = config.topics.reading;

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const topic = topics[i % topics.length];
    const difficulty = ['easy', 'medium', 'hard'][Math.floor(i / (count / 3))];

    const questionText = generateLanguageSpecificWritingPrompt(topic, type, language);

    const question = {
      topic: topic,
      questionText: `${questionText} (Task ${i + 1})`,
      questionType: 'essay',
      correctAnswer: null,
      explanation: `This task requires you to write in a clear, structured manner in ${config.name}.`,
      difficulty: difficulty,
      source: 'builtin',
    };

    questions.push(question);
  }

  return questions;
}

function generateLanguageSpecificSpeakingPrompt(topic, part, language) {
  const prompts = {
    en: {
      'part-one': `Tell me about your favorite ${topic}. What do you like about it? Why do you enjoy it?`,
      'part-two': `Describe a memorable experience related to ${topic}. You should say: • what it was • when it happened • why it was important.`,
      'part-three': `Let's discuss ${topic} in more detail. How do you think ${topic} has changed in your society? What are the reasons?`,
    },
    fr: {
      'part-one': `Parlez-moi de votre ${topic} préféré. Qu'aimez-vous chez lui? Pourquoi l'appréciez-vous?`,
      'part-two': `Décrivez une expérience mémorable liée à ${topic}. Vous devriez dire: • ce que c'était • quand cela s'est passé • pourquoi c'était important.`,
      'part-three': `Discutons de ${topic} plus en détail. Comment pensez-vous que ${topic} a changé dans votre société?`,
    },
    de: {
      'part-one': `Erzählen Sie mir von Ihrem liebsten ${topic}. Was gefällt Ihnen daran? Warum genießen Sie es?`,
      'part-two': `Beschreiben Sie ein denkwürdiges Erlebnis im Zusammenhang mit ${topic}. Sie sollten sagen: • was es war • wann es passierte • warum es wichtig war.`,
      'part-three': `Lassen Sie uns ${topic} genauer besprechen. Wie denken Sie, hat sich ${topic} in Ihrer Gesellschaft verändert?`,
    },
    zh: {
      'part-one': `告诉我你最喜欢的${topic}。你喜欢它的什么？为什么你喜欢它？`,
      'part-two': `描述一个与${topic}相关的难忘经历。你应该说：• 它是什么 • 什么时候发生 • 为什么重要。`,
      'part-three': `让我们更详细地讨论${topic}。你认为${topic}在你的社会中如何改变？`,
    },
    ja: {
      'part-one': `あなたの好きな${topic}について教えてください。何が好きですか？なぜ楽しんでますか？`,
      'part-two': `${topic}に関連する忘れられない経験を説明してください。あなたが言うべきこと：• それは何でしたか • いつ起こったか • なぜ重要だったか。`,
      'part-three': `${topic}についてさらに詳しく議論しましょう。${topic}があなたの社会でどのように変わったと思いますか？`,
    },
    pt: {
      'part-one': `Fale-me sobre seu ${topic} favorito. O que você gosta nele? Por que você o aprecia?`,
      'part-two': `Descreva uma experiência memorável relacionada a ${topic}. Você deve dizer: • o que era • quando aconteceu • por que era importante.`,
      'part-three': `Vamos discutir ${topic} em mais detalhes. Como você acha que ${topic} mudou em sua sociedade?`,
    },
    it: {
      'part-one': `Dimmi del tuo ${topic} preferito. Cosa ti piace di esso? Perché lo apprezzi?`,
      'part-two': `Descrivi un'esperienza memorabile legata a ${topic}. Dovresti dire: • che cos'era • quando è accaduto • perché era importante.`,
      'part-three': `Discutiamo ${topic} in modo più dettagliato. Come pensi che ${topic} sia cambiato nella tua società?`,
    },
    es: {
      'part-one': `Cuénteme sobre su ${topic} favorito. ¿Qué le gusta de él? ¿Por qué lo aprecia?`,
      'part-two': `Describe una experiencia memorable relacionada con ${topic}. Deberías decir: • qué era • cuándo sucedió • por qué era importante.`,
      'part-three': `Discutamos ${topic} con más detalle. ¿Cómo crees que ${topic} ha cambiado en tu sociedad?`,
    },
    ko: {
      'part-one': `당신이 가장 좋아하는${topic}에 대해 말씀해주세요. 무엇이 좋으신가요? 왜 즐기세요?`,
      'part-two': `${topic}과 관련된 기억에 남는 경험을 설명하세요. 당신은 말해야 합니다: • 그것이 무엇인지 • 언제 일어났는지 • 왜 중요했는지.`,
      'part-three': `${topic}에 대해 더 자세히 논의해봅시다. ${topic}이 당신의 사회에서 어떻게 바뀌었다고 생각하세요?`,
    }
  };

  const languagePrompts = prompts[language] || prompts['en'];
  return languagePrompts[part] || languagePrompts['part-one'];
}

function generateSpeakingQuestions(count, language = 'en') {
  const questions = [];
  const parts = ['part-one', 'part-two', 'part-three'];
  const config = getLanguageConfig(language);
  const topics = config.topics.speaking;

  for (let i = 0; i < count; i++) {
    const part = parts[i % 3];
    const topic = topics[i % topics.length];

    const questionText = generateLanguageSpecificSpeakingPrompt(topic, part, language);

    const question = {
      topic: topic,
      questionText: `${questionText} (${part} - Question ${i + 1})`,
      questionType: 'speaking-prompt',
      correctAnswer: null,
      explanation: 'This is an open-ended speaking task. Aim for fluency, natural expression, and detailed responses.',
      difficulty: 'medium',
      source: 'builtin',
    };

    questions.push(question);
  }

  return questions;
}

function generateLanguageSpecificOptions(language, difficulty) {
  const options = {
    en: [
      'A) This focuses on theoretical background information',
      'B) This emphasizes practical implications and real-world applications',
      'C) This presents only one perspective on the issue',
      'D) This is primarily about historical context',
    ],
    fr: [
      'A) Cela se concentre sur des informations contextuelles',
      'B) Cela souligne les implications pratiques',
      'C) Cela ne présente qu\'une seule perspective',
      'D) Cela concerne principalement le contexte historique',
    ],
    de: [
      'A) Dies konzentriert sich auf theoretische Hintergrundinformationen',
      'B) Dies betont praktische Implikationen',
      'C) Dies präsentiert nur eine Perspektive',
      'D) Dies betrifft hauptsächlich den historischen Kontext',
    ],
    zh: [
      'A) 这专注于理论背景信息',
      'B) 这强调实际应用',
      'C) 这只呈现一种观点',
      'D) 这主要涉及历史背景',
    ],
    ja: [
      'A) これは理論的背景情報に焦点を当てています',
      'B) これは実用的な意味を強調しています',
      'C) これは1つの視点のみを提示しています',
      'D) これは主に歴史的背景に関するものです',
    ],
    pt: [
      'A) Isso se concentra em informações contextuais',
      'B) Isso enfatiza implicações práticas',
      'C) Isso apresenta apenas uma perspectiva',
      'D) Isso se concentra principalmente no contexto histórico',
    ],
    it: [
      'A) Questo si concentra su informazioni di contesto teorico',
      'B) Questo sottolinea le implicazioni pratiche',
      'C) Questo presenta solo una prospettiva',
      'D) Questo riguarda principalmente il contesto storico',
    ],
    es: [
      'A) Esto se enfoca en información contextual teórica',
      'B) Esto enfatiza implicaciones prácticas',
      'C) Esto presenta solo una perspectiva',
      'D) Esto se enfoca principalmente en el contexto histórico',
    ],
    ko: [
      'A) 이것은 이론적 배경 정보에 초점을 맞춥니다',
      'B) 이것은 실용적인 의미를 강조합니다',
      'C) 이것은 한 가지 관점만 제시합니다',
      'D) 이것은 주로 역사적 맥락에 관한 것입니다',
    ]
  };

  return options[language] || options['en'];
}

module.exports = {
  generateReadingQuestions,
  generateWritingQuestions,
  generateSpeakingQuestions,
};
