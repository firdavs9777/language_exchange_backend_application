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

function generateReadingPassage(topic, language = 'en') {
  // Language-specific reading passage templates
  const passages = {
    en: {
      'Climate and Environment': 'Global warming is one of the most pressing issues facing modern society. Rising temperatures have led to significant changes in weather patterns, causing more frequent extreme weather events. Scientists agree that human activities, particularly the burning of fossil fuels, are the primary cause of climate change. Many countries are now implementing policies to reduce carbon emissions and transition to renewable energy sources.',
      'Technology and Innovation': 'Artificial intelligence has revolutionized many industries over the past decade. From healthcare to finance, AI systems are being used to automate tasks and make better decisions. However, the rapid advancement of AI also raises concerns about job displacement and the need for proper regulation. Experts emphasize that responsible development is crucial to maximize benefits while minimizing risks.',
      'Education and Learning': 'Traditional education methods are being challenged by the rise of online learning platforms. Digital education offers flexibility and access to resources for learners around the world. Yet, studies show that the quality of online education varies significantly, and students often struggle with motivation and engagement. A balanced approach combining digital and in-person learning may be the most effective solution.',
      'Work and Career': 'The job market has undergone dramatic changes in recent years due to automation and globalization. Many traditional roles are disappearing, while new opportunities emerge in technology and creative sectors. Workers are now expected to continuously develop new skills and adapt to changing requirements. Lifelong learning has become essential for career success in the modern economy.',
    },
    fr: {
      'Environnement et climat': 'Le réchauffement climatique est l\'une des questions les plus pressantes de la société moderne. L\'augmentation des températures a entraîné des changements importants dans les conditions météorologiques, provoquant des événements météorologiques extrêmes plus fréquents. Les scientifiques s\'accordent à dire que les activités humaines, en particulier la combustion des combustibles fossiles, sont la principale cause du changement climatique. De nombreux pays mettent désormais en place des politiques visant à réduire les émissions de carbone et à passer aux sources d\'énergie renouvelables.',
      'Technologie et innovation': 'L\'intelligence artificielle a révolutionné de nombreux secteurs au cours de la dernière décennie. De la santé à la finance, les systèmes d\'IA sont utilisés pour automatiser les tâches et prendre de meilleures décisions. Cependant, les progrès rapides de l\'IA soulèvent également des préoccupations concernant le déplacement d\'emplois et le besoin d\'une réglementation appropriée. Les experts soulignent que le développement responsable est crucial pour maximiser les avantages tout en minimisant les risques.',
      'Éducation et apprentissage': 'Les méthodes d\'éducation traditionnelles sont remises en question par la montée en puissance des plates-formes d\'apprentissage en ligne. L\'éducation numérique offre flexibilité et accès aux ressources pour les apprenants du monde entier. Cependant, les études montrent que la qualité de l\'éducation en ligne varie considérablement et que les étudiants ont souvent du mal à se motiver et à s\'engager. Une approche équilibrée combinant l\'apprentissage numérique et en personne peut être la solution la plus efficace.',
      'Travail et carrière': 'Le marché du travail a connu des changements spectaculaires ces dernières années en raison de l\'automatisation et de la mondialisation. De nombreux rôles traditionnels disparaissent, tandis que de nouvelles opportunités émergent dans les secteurs technologiques et créatifs. On attend désormais des travailleurs qu\'ils développent continuellement de nouvelles compétences et s\'adaptent aux exigences changeantes. L\'apprentissage tout au long de la vie est devenu essentiel pour réussir sa carrière dans l\'économie moderne.',
    },
    de: {
      'Umwelt und Klima': 'Die globale Erwärmung ist eines der drängendsten Probleme der modernen Gesellschaft. Der Anstieg der Temperaturen hat zu erheblichen Veränderungen der Wettermuster geführt und verursacht häufigere extreme Wetterereignisse. Wissenschaftler sind sich einig, dass menschliche Aktivitäten, insbesondere die Verbrennung fossiler Brennstoffe, die Hauptursache des Klimawandels sind. Viele Länder setzen jetzt Politik um, um Kohlenstoffemissionen zu reduzieren und zu erneuerbaren Energiequellen überzugehen.',
      'Technologie und Innovation': 'Künstliche Intelligenz hat in der letzten Dekade viele Industrien revolutioniert. Von der Gesundheitswesen bis zur Finanzbranche werden KI-Systeme verwendet, um Aufgaben zu automatisieren und bessere Entscheidungen zu treffen. Allerdings werfen die schnellen Fortschritte der KI auch Bedenken hinsichtlich des Arbeitsplatzabbaus und der Notwendigkeit einer angemessenen Regulierung auf. Experten betonen, dass verantwortungsvolle Entwicklung entscheidend ist, um Vorteile zu maximieren und Risiken zu minimieren.',
      'Bildung und Lernen': 'Traditionelle Bildungsmethoden werden durch den Aufstieg von Online-Lernplattformen in Frage gestellt. Digitale Bildung bietet Flexibilität und Zugang zu Ressourcen für Lernende auf der ganzen Welt. Studien zeigen jedoch, dass die Qualität der Online-Bildung erheblich variiert und Schüler häufig mit Motivations- und Engagement-Problemen kämpfen. Ein ausgewogener Ansatz, der digitales und persönliches Lernen kombiniert, könnte die effektivste Lösung sein.',
      'Arbeit und Karriere': 'Der Arbeitsmarkt hat in den letzten Jahren aufgrund von Automatisierung und Globalisierung dramatische Veränderungen durchgemacht. Viele traditionelle Rollen verschwinden, während neue Chancen in Technologie- und Kreativsektoren entstehen. Es wird jetzt von Arbeitern erwartet, dass sie kontinuierlich neue Fähigkeiten entwickeln und sich an sich ändernde Anforderungen anpassen. Lebenslanges Lernen ist für den Karriereerfolg in der modernen Wirtschaft unverzichtbar geworden.',
    },
    zh: {
      '环境与气候': '全球变暖是现代社会面临的最紧迫的问题之一。气温上升导致了天气模式的重大变化，导致极端天气事件更加频繁。科学家们一致认为，人类活动，特别是化石燃料的燃烧，是气候变化的主要原因。许多国家现在正在实施政策来减少碳排放并过渡到可再生能源。',
      '科技与创新': '人工智能在过去十年中彻底改变了许多行业。从医疗保健到金融，人工智能系统被用于自动化任务和做出更好的决定。然而，人工智能的快速发展也引发了对失业和适当监管需要的担忧。专家强调，负责任的发展对于最大化利益同时最小化风险至关重要。',
      '教育与学习': '由于在线学习平台的兴起，传统教育方法正受到挑战。数字教育为世界各地的学习者提供了灵活性和资源获取。然而，研究表明在线教育的质量差异很大，学生经常在动力和参与方面苦苦挣扎。结合数字和面对面学习的平衡方法可能是最有效的解决方案。',
      '工作与职业': '由于自动化和全球化，工作市场近年来发生了巨大变化。许多传统角色正在消失，而技术和创意部门出现了新的机会。现在要求工人不断发展新技能并适应不断变化的要求。终身学习对现代经济中的职业成功至关重要。',
    },
    ja: {
      '環境と気候': '地球温暖化は現代社会が直面する最も緊迫した問題の一つです。気温の上昇は気象パターンの大きな変化をもたらし、より頻繁な極端気象をもたらしています。科学者たちは、人間の活動、特に化石燃料の燃焼が気候変動の主な原因であることに同意しています。多くの国は現在、炭素排出を減らし、再生可能エネルギー源に移行するためのポリシーを実装しています。',
      '技術と革新': '人工知能は過去10年間に多くの業界に革命をもたらしました。医療から金融まで、AI システムはタスクを自動化し、より良い決定を下すために使用されています。しかし、AI の急速な進歩は雇用喪失と適切な規制の必要性についての懸念も提起しています。専門家は、責任ある発展が利益を最大化しながらリスクを最小化するために重要であることを強調しています。',
      '教育と学習': '従来の教育方法は、オンライン学習プラットフォームの台頭によって挑戦されています。デジタル教育は世界中の学習者に柔軟性とリソースへのアクセスを提供します。しかし、研究ではオンライン教育の品質が大きく異なることが示されており、学生は動機づけと従事に苦労することが多いです。デジタル学習と対面学習を組み合わせたバランスの取れたアプローチが最も効果的なソリューションかもしれません。',
      '仕事とキャリア': 'オートメーションとグローバル化により、雇用市場はここ数年大きく変わっています。多くの伝統的な役割が消えている一方で、技術とクリエイティブセクターに新しい機会が生まれています。ワーカーは現在、継続的に新しいスキルを開発し、変化する要件に適応することが期待されています。生涯学習は現代経済でのキャリア成功に不可欠になっています。',
    },
    pt: {
      'Ambiente e clima': 'O aquecimento global é uma das questões mais urgentes da sociedade moderna. O aumento das temperaturas levou a mudanças significativas nos padrões climáticos, causando eventos climáticos extremos mais frequentes. Os cientistas concordam que as atividades humanas, particularmente a queima de combustíveis fósseis, são a causa principal das mudanças climáticas. Muitos países estão agora implementando políticas para reduzir as emissões de carbono e fazer a transição para fontes de energia renováveis.',
      'Tecnologia e inovação': 'A inteligência artificial revolucionou muitos setores na última década. Da saúde aos serviços financeiros, os sistemas de IA estão sendo usados ​​para automatizar tarefas e tomar melhores decisões. No entanto, o rápido avanço da IA também levanta preocupações sobre deslocamento de empregos e a necessidade de regulação adequada. Especialistas enfatizam que o desenvolvimento responsável é crucial para maximizar benefícios enquanto minimiza riscos.',
      'Educação e aprendizagem': 'Os métodos tradicionais de educação estão sendo desafiados pelo surgimento de plataformas de aprendizagem online. A educação digital oferece flexibilidade e acesso a recursos para alunos em todo o mundo. No entanto, estudos mostram que a qualidade da educação online varia significativamente e os alunos muitas vezes enfrentam dificuldades com motivação e envolvimento. Uma abordagem equilibrada combinando aprendizagem digital e presencial pode ser a solução mais eficaz.',
      'Trabalho e carreira': 'O mercado de trabalho passou por mudanças dramáticas nos últimos anos devido à automação e globalização. Muitos papéis tradicionais estão desaparecendo, enquanto novas oportunidades surgem nos setores de tecnologia e criatividade. Espera-se agora que os trabalhadores desenvolvam continuamente novas habilidades e se adaptem aos requisitos em mudança. O aprendizado contínuo tornou-se essencial para o sucesso na carreira na economia moderna.',
    },
    it: {
      'Ambiente e clima': 'Il riscaldamento globale è uno dei problemi più urgenti della società moderna. L\'aumento delle temperature ha portato a cambiamenti significativi nei modelli meteorologici, causando eventi meteorologici estremi più frequenti. Gli scienziati concordano sul fatto che le attività umane, in particolare la combustione dei combustibili fossili, sono la causa principale del cambiamento climatico. Molti paesi stanno ora implementando politiche per ridurre le emissioni di carbonio e passare alle fonti di energia rinnovabili.',
      'Tecnologia e innovazione': 'L\'intelligenza artificiale ha rivoluzionato molti settori nell\'ultimo decennio. Dall\'assistenza sanitaria alla finanza, i sistemi di IA vengono utilizzati per automatizzare le attività e prendere decisioni migliori. Tuttavia, il rapido progresso dell\'IA solleva anche preoccupazioni sulla perdita di posti di lavoro e la necessità di una regolamentazione appropriata. Gli esperti sottolineano che lo sviluppo responsabile è fondamentale per massimizzare i benefici riducendo al minimo i rischi.',
      'Istruzione e apprendimento': 'I metodi educativi tradizionali vengono messi in discussione dall\'aumento delle piattaforme di apprendimento online. L\'istruzione digitale offre flessibilità e accesso alle risorse per gli studenti in tutto il mondo. Tuttavia, gli studi mostrano che la qualità dell\'istruzione online varia in modo significativo e gli studenti spesso faticano con la motivazione e l\'impegno. Un approccio equilibrato che combina l\'apprendimento digitale e in persona potrebbe essere la soluzione più efficace.',
      'Lavoro e carriera': 'Il mercato del lavoro ha subito cambiamenti drammatici negli ultimi anni a causa dell\'automazione e della globalizzazione. Molti ruoli tradizionali stanno scomparendo, mentre emergono nuove opportunità nei settori della tecnologia e della creatività. Ci si aspetta che i lavoratori sviluppino continuamente nuove competenze e si adattino ai requisiti che cambiano. L\'apprendimento continuo è diventato essenziale per il successo professionale nell\'economia moderna.',
    },
    es: {
      'Ambiente y clima': 'El calentamiento global es uno de los problemas más apremiantes de la sociedad moderna. El aumento de las temperaturas ha provocado cambios significativos en los patrones climáticos, causando eventos climáticos extremos más frecuentes. Los científicos están de acuerdo en que las actividades humanas, en particular la quema de combustibles fósiles, son la principal causa del cambio climático. Muchos países ahora están implementando políticas para reducir las emisiones de carbono y hacer la transición a fuentes de energía renovables.',
      'Tecnología e innovación': 'La inteligencia artificial ha revolucionado muchas industrias en la última década. Desde la sanidad hasta las finanzas, los sistemas de IA se utilizan para automatizar tareas y tomar mejores decisiones. Sin embargo, el rápido avance de la IA también genera preocupaciones sobre el desplazamiento de empleos y la necesidad de una regulación adecuada. Los expertos enfatizan que el desarrollo responsable es crucial para maximizar los beneficios mientras se minimizan los riesgos.',
      'Educación y aprendizaje': 'Los métodos educativos tradicionales se ven desafiados por el auge de las plataformas de aprendizaje en línea. La educación digital ofrece flexibilidad y acceso a recursos para estudiantes de todo el mundo. Sin embargo, los estudios muestran que la calidad de la educación en línea varía significativamente y los estudiantes a menudo luchan con la motivación y el compromiso. Un enfoque equilibrado que combine el aprendizaje digital y presencial puede ser la solución más efectiva.',
      'Trabajo y carrera': 'El mercado laboral ha sufrido cambios drásticos en los últimos años debido a la automatización y la globalización. Muchos roles tradicionales están desapareciendo, mientras que emergen nuevas oportunidades en los sectores tecnológico y creativo. Ahora se espera que los trabajadores desarrollen continuamente nuevas habilidades y se adapten a los requisitos cambiantes. El aprendizaje continuo se ha convertido en esencial para el éxito profesional en la economía moderna.',
    },
    ko: {
      '환경과 기후': '지구 온난화는 현대 사회가 직면한 가장 시급한 문제 중 하나입니다. 기온 상승으로 인해 날씨 패턴이 크게 변하고 있으며, 극단적인 기상 현상이 더욱 빈번해지고 있습니다. 과학자들은 화석 연료 연소를 포함한 인간 활동이 기후 변화의 주요 원인이라는 점에 동의합니다. 많은 국가들이 탄소 배출을 줄이고 재생 에너지로 전환하는 정책을 시행하고 있습니다.',
      '기술과 혁신': '인공지능은 지난 10년간 많은 산업에 혁명을 일으켰습니다. 의료에서 금융에 이르기까지 AI 시스템은 작업 자동화와 더 나은 의사 결정을 위해 사용되고 있습니다. 그러나 AI의 빠른 발전은 일자리 감소와 적절한 규제의 필요성에 대한 우려를 낳고 있습니다. 전문가들은 책임감 있는 개발이 이점을 최대화하면서 위험을 최소화하는 데 중요하다고 강조합니다.',
      '교육과 학습': '전통적인 교육 방법은 온라인 학습 플랫폼의 부상으로 인해 도전받고 있습니다. 디지털 교육은 전 세계 학습자를 위한 유연성과 자원 접근을 제공합니다. 그러나 연구에 따르면 온라인 교육의 품질은 크게 다르며 학생들은 동기 부여와 참여에 어려움을 겪습니다. 디지털 학습과 대면 학습을 결합한 균형 잡힌 접근 방식이 가장 효과적인 해결책이 될 수 있습니다.',
      '일과 경력': '자동화와 세계화로 인해 노동 시장이 최근 몇 년간 크게 변했습니다. 많은 전통적 역할이 사라지는 반면, 기술과 창의적 부문에서 새로운 기회가 나타나고 있습니다. 근로자들은 이제 새로운 기술을 지속적으로 개발하고 변화하는 요구에 적응할 것으로 예상됩니다. 평생 학습은 현대 경제에서 직업 성공을 위해 필수가 되었습니다.',
    }
  };

  // Get a passage for the topic, or use a default one
  const languagePassages = passages[language] || passages['en'];
  return languagePassages[topic] || 'The modern world is constantly changing with new technologies and innovations emerging every day. These changes affect various aspects of our lives, from work and education to communication and entertainment. Understanding these changes is important for adapting to the new environment and making informed decisions about the future.';
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

    // Generate the reading passage
    const passage = generateReadingPassage(topic, language);

    // Generate the question prompt
    const questionPrompt = generateLanguageSpecificReadingQuestion(topic, questionType, language, i);

    // Combine passage + question into questionText
    const fullQuestionText = `${passage}\n\n${questionPrompt} (Question ${i + 1})`;

    const question = {
      topic: topic,
      questionText: fullQuestionText,
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
