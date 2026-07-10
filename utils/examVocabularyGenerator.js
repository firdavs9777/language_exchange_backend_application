// Language-specific vocabulary for exams
const VOCABULARY_DATA = {
  en: {
    name: 'English',
    A1: {
      'Family': [
        { word: 'mother', pos: 'noun', def: 'a female parent', example: 'My mother is a teacher.' },
        { word: 'father', pos: 'noun', def: 'a male parent', example: 'My father works in an office.' },
        { word: 'sister', pos: 'noun', def: 'a female sibling', example: 'I have two sisters.' },
        { word: 'brother', pos: 'noun', def: 'a male sibling', example: 'My brother is younger than me.' },
        { word: 'family', pos: 'noun', def: 'parents and their children', example: 'My family is very important to me.' },
      ],
      'Food': [
        { word: 'bread', pos: 'noun', def: 'a common food made from flour', example: 'I eat bread for breakfast.' },
        { word: 'water', pos: 'noun', def: 'a clear liquid necessary for life', example: 'Please drink some water.' },
        { word: 'apple', pos: 'noun', def: 'a round red or green fruit', example: 'An apple a day keeps the doctor away.' },
        { word: 'coffee', pos: 'noun', def: 'a hot drink', example: 'I drink coffee every morning.' },
        { word: 'milk', pos: 'noun', def: 'a white liquid from animals', example: 'Milk is good for your bones.' },
      ],
      'Numbers': [
        { word: 'one', pos: 'noun', def: 'the number 1', example: 'I have one cat.' },
        { word: 'two', pos: 'noun', def: 'the number 2', example: 'We have two cars.' },
        { word: 'three', pos: 'noun', def: 'the number 3', example: 'There are three books on the shelf.' },
        { word: 'ten', pos: 'noun', def: 'the number 10', example: 'There are ten fingers on your hands.' },
        { word: 'hundred', pos: 'noun', def: 'the number 100', example: 'This book has two hundred pages.' },
      ],
    },
    B1: {
      'Business': [
        { word: 'profit', pos: 'noun', def: 'money earned after costs', example: 'The company made a large profit this year.' },
        { word: 'investment', pos: 'noun', def: 'money put into something to gain return', example: 'Real estate is a good investment.' },
        { word: 'market', pos: 'noun', def: 'place where goods are bought and sold', example: 'The stock market was up today.' },
        { word: 'entrepreneur', pos: 'noun', def: 'a person who starts a business', example: 'She is a successful entrepreneur.' },
        { word: 'contract', pos: 'noun', def: 'a legal agreement', example: 'We signed the contract yesterday.' },
      ],
      'Technology': [
        { word: 'software', pos: 'noun', def: 'computer programs', example: 'This software is very user-friendly.' },
        { word: 'database', pos: 'noun', def: 'organized collection of data', example: 'The database contains customer information.' },
        { word: 'interface', pos: 'noun', def: 'a device connecting things', example: 'The user interface is easy to navigate.' },
        { word: 'algorithm', pos: 'noun', def: 'a step-by-step procedure', example: 'The algorithm solves the problem efficiently.' },
        { word: 'bandwidth', pos: 'noun', def: 'data transmission capacity', example: 'We need more bandwidth for streaming.' },
      ],
    },
  },
  fr: {
    name: 'French',
    A1: {
      'Famille': [
        { word: 'mère', pos: 'noun', def: 'parent féminin', example: 'Ma mère est professeure.' },
        { word: 'père', pos: 'noun', def: 'parent masculin', example: 'Mon père travaille au bureau.' },
        { word: 'soeur', pos: 'noun', def: 'fille de mes parents', example: 'J\'ai deux soeurs.' },
        { word: 'frère', pos: 'noun', def: 'fils de mes parents', example: 'Mon frère est plus jeune.' },
        { word: 'famille', pos: 'noun', def: 'parents et enfants', example: 'Ma famille est très importante.' },
      ],
      'Nourriture': [
        { word: 'pain', pos: 'noun', def: 'aliment fait de farine', example: 'Je mange du pain au petit déjeuner.' },
        { word: 'eau', pos: 'noun', def: 'liquide clair et transparent', example: 'S\'il vous plaît, buvez de l\'eau.' },
        { word: 'pomme', pos: 'noun', def: 'fruit rond rouge ou vert', example: 'Une pomme par jour éloigne le médecin.' },
        { word: 'café', pos: 'noun', def: 'boisson chaude', example: 'Je bois du café tous les matins.' },
        { word: 'lait', pos: 'noun', def: 'liquide blanc provenant d\'animaux', example: 'Le lait est bon pour les os.' },
      ],
    },
    B1: {
      'Affaires': [
        { word: 'profit', pos: 'noun', def: 'argent gagné après les frais', example: 'L\'entreprise a réalisé un grand profit.' },
        { word: 'investissement', pos: 'noun', def: 'argent placé pour un retour', example: 'L\'immobilier est un bon investissement.' },
        { word: 'marché', pos: 'noun', def: 'lieu où on achète et vend', example: 'Le marché boursier a augmenté aujourd\'hui.' },
        { word: 'entrepreneur', pos: 'noun', def: 'personne qui crée une entreprise', example: 'Elle est une entrepreneur réussie.' },
        { word: 'contrat', pos: 'noun', def: 'accord juridique', example: 'Nous avons signé le contrat hier.' },
      ],
      'Technologie': [
        { word: 'logiciel', pos: 'noun', def: 'programmes informatiques', example: 'Ce logiciel est très convivial.' },
        { word: 'base de données', pos: 'noun', def: 'collection organisée de données', example: 'La base de données contient les informations client.' },
        { word: 'interface', pos: 'noun', def: 'dispositif connectant des choses', example: 'L\'interface utilisateur est facile à naviguer.' },
        { word: 'algorithme', pos: 'noun', def: 'procédure étape par étape', example: 'L\'algorithme résout le problème efficacement.' },
        { word: 'bande passante', pos: 'noun', def: 'capacité de transmission de données', example: 'Nous avons besoin de plus de bande passante.' },
      ],
    },
  },
  de: {
    name: 'German',
    A1: {
      'Familie': [
        { word: 'Mutter', pos: 'noun', def: 'weibliches Elternteil', example: 'Meine Mutter ist Lehrerin.' },
        { word: 'Vater', pos: 'noun', def: 'männliches Elternteil', example: 'Mein Vater arbeitet im Büro.' },
        { word: 'Schwester', pos: 'noun', def: 'weibliches Geschwister', example: 'Ich habe zwei Schwestern.' },
        { word: 'Bruder', pos: 'noun', def: 'männliches Geschwister', example: 'Mein Bruder ist jünger als ich.' },
        { word: 'Familie', pos: 'noun', def: 'Eltern und Kinder', example: 'Meine Familie ist mir sehr wichtig.' },
      ],
      'Essen': [
        { word: 'Brot', pos: 'noun', def: 'Lebensmittel aus Mehl', example: 'Ich esse Brot zum Frühstück.' },
        { word: 'Wasser', pos: 'noun', def: 'klare, transparente Flüssigkeit', example: 'Bitte trinken Sie Wasser.' },
        { word: 'Apfel', pos: 'noun', def: 'rundes rotes oder grünes Obst', example: 'Ein Apfel pro Tag hält den Arzt fern.' },
        { word: 'Kaffee', pos: 'noun', def: 'heißes Getränk', example: 'Ich trinke jeden Morgen Kaffee.' },
        { word: 'Milch', pos: 'noun', def: 'weiße Flüssigkeit von Tieren', example: 'Milch ist gut für die Knochen.' },
      ],
    },
    B1: {
      'Geschäft': [
        { word: 'Gewinn', pos: 'noun', def: 'Geld verdient nach Kosten', example: 'Das Unternehmen machte dieses Jahr großen Gewinn.' },
        { word: 'Investition', pos: 'noun', def: 'Geld für Rückgabe angelegt', example: 'Immobilien sind eine gute Investition.' },
        { word: 'Markt', pos: 'noun', def: 'Ort, wo Waren gekauft und verkauft werden', example: 'Der Aktienmarkt stieg heute.' },
        { word: 'Unternehmer', pos: 'noun', def: 'Person, die ein Geschäft gründet', example: 'Sie ist eine erfolgreiche Unternehmerin.' },
        { word: 'Vertrag', pos: 'noun', def: 'rechtliche Vereinbarung', example: 'Wir unterzeichneten gestern den Vertrag.' },
      ],
    },
  },
  zh: {
    name: 'Chinese',
    A1: {
      '家庭': [
        { word: '母亲', pos: 'noun', def: '女性父母', example: '我的母亲是一名教师。' },
        { word: '父亲', pos: 'noun', def: '男性父母', example: '我的父亲在办公室工作。' },
        { word: '姐妹', pos: 'noun', def: '女性兄弟姐妹', example: '我有两个姐妹。' },
        { word: '兄弟', pos: 'noun', def: '男性兄弟姐妹', example: '我的兄弟比我小。' },
        { word: '家庭', pos: 'noun', def: '父母和孩子们', example: '我的家庭对我非常重要。' },
      ],
      '食物': [
        { word: '面包', pos: 'noun', def: '用面粉制成的常见食物', example: '我早餐吃面包。' },
        { word: '水', pos: 'noun', def: '清澈的液体', example: '请喝一些水。' },
        { word: '苹果', pos: 'noun', def: '圆形红色或绿色水果', example: '一日一苹果，医生远离我。' },
        { word: '咖啡', pos: 'noun', def: '热饮料', example: '我每天早上喝咖啡。' },
        { word: '牛奶', pos: 'noun', def: '来自动物的白色液体', example: '牛奶对骨骼有益。' },
      ],
    },
    B1: {
      '商业': [
        { word: '利润', pos: 'noun', def: '成本后赚取的钱', example: '该公司今年获得了大利润。' },
        { word: '投资', pos: 'noun', def: '为了获得回报而投入的钱', example: '房地产是一项很好的投资。' },
        { word: '市场', pos: 'noun', def: '商品买卖的地方', example: '股票市场今天上升了。' },
        { word: '企业家', pos: 'noun', def: '创办企业的人', example: '她是一位成功的企业家。' },
        { word: '合同', pos: 'noun', def: '法律协议', example: '我们昨天签署了合同。' },
      ],
    },
  },
  ja: {
    name: 'Japanese',
    A1: {
      '家族': [
        { word: '母親', pos: 'noun', def: '女性の親', example: '私の母親は先生です。' },
        { word: '父親', pos: 'noun', def: '男性の親', example: '私の父親はオフィスで働いています。' },
        { word: '姉妹', pos: 'noun', def: '女性の兄弟姉妹', example: '私は2人の姉妹がいます。' },
        { word: '兄弟', pos: 'noun', def: '男性の兄弟姉妹', example: '私の兄弟は私より若い。' },
        { word: '家族', pos: 'noun', def: '両親と子供たち', example: '私の家族は私にとって非常に重要です。' },
      ],
      '食べ物': [
        { word: 'パン', pos: 'noun', def: '小麦粉でできた一般的な食品', example: '朝食にパンを食べます。' },
        { word: '水', pos: 'noun', def: 'クリアな液体', example: 'お水をお飲みください。' },
        { word: 'りんご', pos: 'noun', def: '丸い赤いまたは緑の果物', example: '毎日のりんご1つは医者を遠ざける。' },
        { word: 'コーヒー', pos: 'noun', def: 'ホットドリンク', example: '毎朝コーヒーを飲みます。' },
        { word: 'ミルク', pos: 'noun', def: '動物からの白い液体', example: 'ミルクは骨に良い。' },
      ],
    },
    B1: {
      '商業': [
        { word: '利益', pos: 'noun', def: 'コスト後に稼いだお金', example: '会社は今年大きな利益を上げました。' },
        { word: '投資', pos: 'noun', def: 'リターンを得るために投じられたお金', example: '不動産は良い投資です。' },
        { word: '市場', pos: 'noun', def: '商品が売買される場所', example: '株式市場は今日上昇しました。' },
        { word: '起業家', pos: 'noun', def: '事業を開始する人', example: '彼女は成功した起業家です。' },
        { word: '契約', pos: 'noun', def: '法的な合意', example: 'きのう契約書に署名しました。' },
      ],
    },
  },
  pt: {
    name: 'Portuguese',
    A1: {
      'Família': [
        { word: 'mãe', pos: 'noun', def: 'progenitora', example: 'Minha mãe é professora.' },
        { word: 'pai', pos: 'noun', def: 'progenitor', example: 'Meu pai trabalha em um escritório.' },
        { word: 'irmã', pos: 'noun', def: 'irmã consanguínea', example: 'Tenho duas irmãs.' },
        { word: 'irmão', pos: 'noun', def: 'irmão consanguíneo', example: 'Meu irmão é mais jovem que eu.' },
        { word: 'família', pos: 'noun', def: 'pais e filhos', example: 'Minha família é muito importante para mim.' },
      ],
      'Comida': [
        { word: 'pão', pos: 'noun', def: 'alimento feito de farinha', example: 'Como pão no café da manhã.' },
        { word: 'água', pos: 'noun', def: 'líquido claro', example: 'Por favor, beba água.' },
        { word: 'maçã', pos: 'noun', def: 'fruta redonda vermelha ou verde', example: 'Uma maçã por dia mantém o médico afastado.' },
        { word: 'café', pos: 'noun', def: 'bebida quente', example: 'Bebo café todas as manhãs.' },
        { word: 'leite', pos: 'noun', def: 'líquido branco de animais', example: 'O leite é bom para os ossos.' },
      ],
    },
    B1: {
      'Negócios': [
        { word: 'lucro', pos: 'noun', def: 'dinheiro ganho após custos', example: 'A empresa teve grande lucro este ano.' },
        { word: 'investimento', pos: 'noun', def: 'dinheiro aplicado para retorno', example: 'Imóvel é um bom investimento.' },
        { word: 'mercado', pos: 'noun', def: 'lugar onde bens são comprados e vendidos', example: 'O mercado de ações subiu hoje.' },
        { word: 'empreendedor', pos: 'noun', def: 'pessoa que inicia um negócio', example: 'Ela é uma empresária bem-sucedida.' },
        { word: 'contrato', pos: 'noun', def: 'acordo legal', example: 'Assinamos o contrato ontem.' },
      ],
    },
  },
  it: {
    name: 'Italian',
    A1: {
      'Famiglia': [
        { word: 'madre', pos: 'noun', def: 'genitrice', example: 'Mia madre è un\'insegnante.' },
        { word: 'padre', pos: 'noun', def: 'genitore', example: 'Mio padre lavora in ufficio.' },
        { word: 'sorella', pos: 'noun', def: 'sorella consanguinea', example: 'Ho due sorelle.' },
        { word: 'fratello', pos: 'noun', def: 'fratello consanguineo', example: 'Mio fratello è più giovane di me.' },
        { word: 'famiglia', pos: 'noun', def: 'genitori e figli', example: 'Mia famiglia è molto importante per me.' },
      ],
      'Cibo': [
        { word: 'pane', pos: 'noun', def: 'alimento fatto di farina', example: 'Mangio pane a colazione.' },
        { word: 'acqua', pos: 'noun', def: 'liquido trasparente', example: 'Si prega di bere acqua.' },
        { word: 'mela', pos: 'noun', def: 'frutto rotondo rosso o verde', example: 'Una mela al giorno toglie il medico di torno.' },
        { word: 'caffè', pos: 'noun', def: 'bevanda calda', example: 'Bevo caffè ogni mattina.' },
        { word: 'latte', pos: 'noun', def: 'liquido bianco da animali', example: 'Il latte è buono per le ossa.' },
      ],
    },
    B1: {
      'Affari': [
        { word: 'profitto', pos: 'noun', def: 'denaro guadagnato dopo i costi', example: 'L\'azienda ha realizzato un grande profitto quest\'anno.' },
        { word: 'investimento', pos: 'noun', def: 'denaro investito per il ritorno', example: 'Il settore immobiliare è un buon investimento.' },
        { word: 'mercato', pos: 'noun', def: 'luogo dove vengono comprati e venduti i beni', example: 'Il mercato azionario è salito oggi.' },
        { word: 'imprenditore', pos: 'noun', def: 'persona che avvia un\'attività', example: 'Lei è un\'imprenditrice di successo.' },
        { word: 'contratto', pos: 'noun', def: 'accordo legale', example: 'Abbiamo firmato il contratto ieri.' },
      ],
    },
  },
  es: {
    name: 'Spanish',
    A1: {
      'Familia': [
        { word: 'madre', pos: 'noun', def: 'progenitora', example: 'Mi madre es una maestra.' },
        { word: 'padre', pos: 'noun', def: 'progenitor', example: 'Mi padre trabaja en una oficina.' },
        { word: 'hermana', pos: 'noun', def: 'hermana consanguínea', example: 'Tengo dos hermanas.' },
        { word: 'hermano', pos: 'noun', def: 'hermano consanguíneo', example: 'Mi hermano es más joven que yo.' },
        { word: 'familia', pos: 'noun', def: 'padres e hijos', example: 'Mi familia es muy importante para mí.' },
      ],
      'Comida': [
        { word: 'pan', pos: 'noun', def: 'alimento hecho de harina', example: 'Como pan en el desayuno.' },
        { word: 'agua', pos: 'noun', def: 'líquido transparente', example: 'Por favor, beba agua.' },
        { word: 'manzana', pos: 'noun', def: 'fruta redonda roja o verde', example: 'Una manzana al día mantiene al médico a raya.' },
        { word: 'café', pos: 'noun', def: 'bebida caliente', example: 'Bebo café todas las mañanas.' },
        { word: 'leche', pos: 'noun', def: 'líquido blanco de los animales', example: 'La leche es buena para los huesos.' },
      ],
    },
    B1: {
      'Negocios': [
        { word: 'ganancia', pos: 'noun', def: 'dinero ganado después de costos', example: 'La empresa obtuvo una gran ganancia este año.' },
        { word: 'inversión', pos: 'noun', def: 'dinero invertido para obtener ganancias', example: 'Los bienes raíces son una buena inversión.' },
        { word: 'mercado', pos: 'noun', def: 'lugar donde se compran y venden bienes', example: 'El mercado bursátil subió hoy.' },
        { word: 'emprendedor', pos: 'noun', def: 'persona que inicia un negocio', example: 'Ella es una empresaria exitosa.' },
        { word: 'contrato', pos: 'noun', def: 'acuerdo legal', example: 'Firmamos el contrato ayer.' },
      ],
    },
  },
  ko: {
    name: 'Korean',
    A1: {
      '가족': [
        { word: '어머니', pos: 'noun', def: '어머니', example: '내 어머니는 교사입니다.' },
        { word: '아버지', pos: 'noun', def: '아버지', example: '나의 아버지는 사무실에서 일합니다.' },
        { word: '누나/언니', pos: 'noun', def: '여성 형제', example: '나는 누나 두 명이 있습니다.' },
        { word: '형/오빠', pos: 'noun', def: '남성 형제', example: '내 형은 나보다 어립니다.' },
        { word: '가족', pos: 'noun', def: '부모와 자녀', example: '내 가족은 나에게 매우 중요합니다.' },
      ],
      '음식': [
        { word: '빵', pos: 'noun', def: '밀가루로 만든 음식', example: '나는 아침 식사로 빵을 먹습니다.' },
        { word: '물', pos: 'noun', def: '투명한 액체', example: '물을 드세요.' },
        { word: '사과', pos: 'noun', def: '동그란 빨강 또는 녹색 과일', example: '하루에 사과 하나는 의사를 멀리합니다.' },
        { word: '커피', pos: 'noun', def: '뜨거운 음료', example: '나는 매일 아침 커피를 마십니다.' },
        { word: '우유', pos: 'noun', def: '동물로부터의 흰 액체', example: '우유는 뼈에 좋습니다.' },
      ],
    },
    B1: {
      '사업': [
        { word: '이익', pos: 'noun', def: '비용 후 획득한 돈', example: '회사는 올해 큰 이익을 얻었습니다.' },
        { word: '투자', pos: 'noun', def: '수익을 얻기 위해 투입한 돈', example: '부동산은 좋은 투자입니다.' },
        { word: '시장', pos: 'noun', def: '상품이 사고팔리는 장소', example: '주식 시장이 오늘 올랐습니다.' },
        { word: '기업가', pos: 'noun', def: '사업을 시작하는 사람', example: '그녀는 성공한 기업가입니다.' },
        { word: '계약', pos: 'noun', def: '법적 합의', example: '우리는 어제 계약서에 서명했습니다.' },
      ],
    },
  },
};

function generateVocabularyWords(count, language, level, topic = null) {
  const words = [];
  const langData = VOCABULARY_DATA[language] || VOCABULARY_DATA['en'];
  const levelData = langData[level] || langData['A1'];

  // Get topics available for this level
  const availableTopics = Object.keys(levelData);

  let topicsToUse = availableTopics;
  if (topic && levelData[topic]) {
    topicsToUse = [topic];
  }

  let wordIndex = 0;
  for (const topicName of topicsToUse) {
    const topicWords = levelData[topicName] || [];

    for (const wordData of topicWords) {
      if (wordIndex >= count) break;

      words.push({
        word: wordData.word,
        definition: wordData.def,
        exampleSentence: wordData.example,
        partOfSpeech: wordData.pos,
        topic: topicName,
        level: level,
      });
      wordIndex++;
    }

    if (wordIndex >= count) break;
  }

  // Pad with duplicates if needed (for demo purposes)
  while (words.length < count && words.length > 0) {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    words.push({
      ...randomWord,
      word: randomWord.word + '_' + (words.length + 1),
    });
  }

  return words;
}

module.exports = {
  generateVocabularyWords,
  VOCABULARY_DATA,
};
