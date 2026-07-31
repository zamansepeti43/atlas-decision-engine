import { analyzeDecision, type AnalysisResult } from "./atlas-ai";
/**
 * Atlas AI — Intent Router
 *
 * Detects user intent and generates the appropriate response.
 * The public API is `detectIntentSync()` + `processQuery()`.
 *
 * Architecture:
 *   detectIntentSync(q)  — sync, runs before showing loading state
 *   (q)      — async, returns AtlasResponseData (discriminated union)
 *
 * To replace the generators below with an LLM, swap the body of `processQuery`.
 * The AtlasResponseData interface and every rendering component stay the same.
 *
 * ─── LLM drop-in ────────────────────────────────────────────────────────────
 *   export async function processQuery(question: string): Promise<AtlasResponseData> {
 *     const intentResult = detectIntentSync(question);
 *     const completion = await openai.chat.completions.create({
 *       model: 'gpt-4o',
 *       response_format: { type: 'json_object' },
 *       messages: [
 *         { role: 'system', content: SYSTEM_PROMPT_FOR_INTENT[intentResult.intent] },
 *         { role: 'user', content: question }
 *       ],
 *     });
 *     return { intent: intentResult.intent, data: JSON.parse(completion.choices[0].message.content!) };
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function askBackend(question: string) {
 console.log("askBackend çalıştı");
  console.log("İstek gönderiliyor:", question);
console.log("HTTP isteği başladı");
 const res = await fetch(
  "https://atlas-decision-engine-api-server.vercel.app/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: question,
    }),
  });

  console.log("HTTP Durumu:", res.status);

  const data = await res.json();
  console.log("Gelen cevap:", data);

  return data.reply;
}
// ─── Public types ─────────────────────────────────────────────────────────────

export type IntentType =
  | 'conversation'
  | 'decision'
  | 'learning'
  | 'writing'
  | 'research'
  | 'planning'
  | 'problem-solving';

export interface ConversationData {
  message: string;
  tone: 'greeting' | 'helpful' | 'acknowledgment';
  followUps: string[];
}

export interface LearningData {
  topic: string;
  summary: string;
  keyPoints: Array<{ title: string; detail: string }>;
  example: string;
  nextTopics: string[];
}

export interface WritingData {
  taskDescription: string;
  contentType: string;
  content: string;
  wordCount: number;
  suggestions: string[];
}

export interface ResearchData {
  topic: string;
  executiveSummary: string;
  findings: Array<{ headline: string; detail: string }>;
  conclusion: string;
}

export interface PlanningData {
  goal: string;
  totalDuration: string;
  phases: Array<{
    name: string;
    tasks: string[];
    duration: string;
  }>;
  successTips: string[];
}

export interface ProblemSolvingData {
  problemStatement: string;
  diagnosis: string;
  solutions: Array<{
    title: string;
    steps: string[];
    effort: 'Düşük' | 'Orta' | 'Yüksek';
  }>;
  quickFix: string;
}

export type AtlasResponseData =
  | { intent: 'conversation'; data: ConversationData }
  | { intent: 'decision'; data: AnalysisResult }
  | { intent: 'learning'; data: LearningData }
  | { intent: 'writing'; data: WritingData }
  | { intent: 'research'; data: ResearchData }
  | { intent: 'planning'; data: PlanningData }
  | { intent: 'problem-solving'; data: ProblemSolvingData };

export interface IntentDetectionResult {
  intent: IntentType;
  confidence: number;
  loadingText: string;
  loadingSteps: string[];
}

// ─── Intent detection ─────────────────────────────────────────────────────────

const INTENT_SIGNALS: Record<IntentType, string[]> = {
  'problem-solving': [
    'sorun', 'problem', 'hata', 'çalışmıyor', 'açılmıyor', 'bozuk', 'düzeltmek',
    'neden olmuyor', 'nasıl çözerim', 'çözüm bulamıyorum', 'takıldım', 'yardım et',
    'error', 'bug', 'fix', 'crash', 'çöküyor', 'donuyor', 'yavaşladı',
    'gitmiyor', 'olmuyor', 'yapamıyorum', 'beceremedim', 'kafam karıştı',
  ],
  decision: [
    'almalıyım', 'seçmeliyim', 'hangisi', 'mi yoksa', 'karar', 'öneri ver',
    'tavsiye', 'tercih', 'karşılaştır', 'farkı nedir', 'hangisini', 'ne alayım',
    'bütçem var', 'tl bütçe', 'hangi', 'öneriyor musun', 'seçsem', 'alsam',
    'yapmalıyım', 'gitmeli miyim', 'denemeliyim',
  ],
  writing: [
    'yaz', 'oluştur', 'hazırla', 'taslak', 'mektup', 'e-posta', 'eposta',
    'metin', 'makale', 'yazı', 'içerik', 'özet', 'rapor yaz', 'düzenle',
    'düzelt', 'yazabilir misin', 'yazar mısın', 'yazı yaz', 'benim için yaz',
    'ilan', 'duyuru', 'şiir', 'hikaye', 'cv', 'özgeçmiş', 'kapak mektubu',
  ],
  planning: [
    'plan', 'planla', 'yol haritası', 'nasıl başlarım', 'adım adım', 'süreç',
    'aşama', 'proje', 'organizasyon', 'hazırlık', 'strateji', 'program yap',
    'takvim', 'aylık', 'haftalık', 'yıllık hedef', 'hedef belirle',
    'planlamak', 'nasıl organize', 'ne zaman', 'önceliklendirme',
  ],
  research: [
    'araştır', 'araştırma yap', 'hakkında bilgi ver', 'detaylı anlat',
    'rapor çıkar', 'incele', 'analiz et', 'istatistik', 'kaynak', 'bul',
    'veri', 'trend', 'piyasa araştırması', 'karşılaştırmalı', 'kapsamlı',
    'derinlemesine', 'derleme yap', 'özetle tüm',
  ],
  learning: [
    'nedir', 'ne demek', 'nasıl çalışır', 'anlat', 'öğret', 'öğrenmek istiyorum',
    'açıkla', 'tanımla', 'anlamı', 'tarihçe', 'öğrenmek', 'eğitim', 'kurs',
    'neden önemli', 'nasıl işler', 'temel kavram', 'temel bilgi', 'öğrensem',
    'hakkında anlat', 'ne işe yarar', 'kullanım alanları',
  ],
  conversation: [
    'merhaba', 'selam', 'günaydın', 'iyi akşamlar', 'nasılsın', 'naber',
    'teşekkür', 'sağol', 'tamam', 'anladım', 'harika', 'süper', 'iyi',
    'evet', 'hayır', 'belki', 'bence', 'sence', 'ne düşünüyorsun',
  ],
};

const LOADING_CONFIG: Record<IntentType, { text: string; steps: string[] }> = {
  conversation: {
    text: 'Atlas yanıt hazırlıyor',
    steps: ['Mesaj işleniyor', 'Yanıt oluşturuluyor', 'Hazır'],
  },
  decision: {
    text: 'Atlas Brain analiz ediyor',
    steps: ['Soru analiz ediliyor', 'Veriler ve seçenekler taranıyor', 'Öneri hazırlanıyor'],
  },
  learning: {
    text: 'Atlas bilgi hazırlıyor',
    steps: ['Konu tespit ediliyor', 'Bilgi derleniyor', 'Açıklama oluşturuluyor'],
  },
  writing: {
    text: 'Atlas yazıyor',
    steps: ['Görev analiz ediliyor', 'İçerik oluşturuluyor', 'Son rötuşlar yapılıyor'],
  },
  research: {
    text: 'Atlas araştırıyor',
    steps: ['Konu taranıyor', 'Bulgular derleniyor', 'Rapor oluşturuluyor'],
  },
  planning: {
    text: 'Atlas plan oluşturuyor',
    steps: ['Hedef analiz ediliyor', 'Aşamalar belirleniyor', 'Plan hazırlanıyor'],
  },
  'problem-solving': {
    text: 'Atlas çözüm arıyor',
    steps: ['Problem teşhis ediliyor', 'Çözümler değerlendiriliyor', 'Aksiyon planı hazırlanıyor'],
  },
};

export function detectIntentSync(question: string): IntentDetectionResult {
  const lower = question.toLowerCase().trim();

  // Very short input (<15 chars) → likely conversation
  if (lower.length < 15) {
    return makeResult('conversation', 90);
  }

  const scores: Partial<Record<IntentType, number>> = {};
  const order: IntentType[] = ['problem-solving', 'decision', 'writing', 'planning', 'research', 'learning', 'conversation'];

  for (const intent of order) {
    let score = 0;
    for (const signal of INTENT_SIGNALS[intent]) {
      if (lower.includes(signal)) {
        score += signal.split(' ').length * 2; // multi-word signals worth more
      }
    }
    if (score > 0) scores[intent] = score;
  }

  if (Object.keys(scores).length === 0) {
    // No signals — if question ends with "?" and has content words, guess learning
    if (lower.endsWith('?') && lower.length > 20) {
      return makeResult('learning', 55);
    }
    return makeResult('conversation', 60);
  }

  const best = order.find((i) => (scores[i] ?? 0) > 0 && (scores[i] ?? 0) === Math.max(...Object.values(scores)));
  const intent = best ?? 'conversation';
  const confidence = Math.min(95, 60 + (scores[intent] ?? 0) * 5);
  return makeResult(intent, confidence);
}

function makeResult(intent: IntentType, confidence: number): IntentDetectionResult {
  const cfg = LOADING_CONFIG[intent];
  return { intent, confidence, loadingText: cfg.text, loadingSteps: cfg.steps };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const TR_STOPWORDS = new Set([
  'ben', 'benim', 'bana', 'beni', 'biz', 'bizim', 'siz', 'sizin', 'sen', 'senin',
  'bir', 'bu', 'şu', 'o', 've', 'veya', 'ya', 'ile', 'için', 'da', 'de', 'mi',
  'mı', 'mu', 'mü', 'ne', 'nasıl', 'neden', 'nerede', 'hangi', 'kaç', 'kadar',
  'gibi', 'daha', 'en', 'çok', 'az', 'hem', 'ama', 'fakat', 'ancak', 'ki', 'ise',
  'eğer', 'çünkü', 'var', 'yok', 'olan', 'olan', 'olur', 'oldu', 'hep', 'hiç',
  'peki', 'tamam', 'evet', 'hayır', 'bence', 'sence', 'acaba', 'belki', 'sadece',
  'zaten', 'bile', 'artık', 'hatta', 'yani', 'ayrıca', 'üstelik', 'oysa',
]);

function extractTopic(question: string, maxWords = 4): string {
  const words = question
    .replace(/[?!.,;:'"()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TR_STOPWORDS.has(w.toLowerCase()))
    .slice(0, maxWords);
  return words.join(' ').trim() || question.slice(0, 30);
}

function stableRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash % 1000) / 1000;
  return Math.round(min + normalized * (max - min));
}

function pickRandom<T>(arr: T[], seed: string): T {
  return arr[stableRandom(seed, 0, arr.length - 1)];
}

// ─── Conversation generator ───────────────────────────────────────────────────

function generateConversation(question: string): ConversationData {
  const lower = question.toLowerCase();

  const isGreeting = /merhaba|selam|günaydın|iyi sabah|iyi akşam|naber|nasılsın|hey/.test(lower);
  const isThanks = /teşekkür|sağol|eyvallah|minnettarım|harika|mükemmel/.test(lower);
  const isOpinion = /bence|ne düşün|görüşün|fikrin/.test(lower);

  if (isGreeting) {
    return {
      tone: 'greeting',
      message: 'Merhaba! Ben Atlas AI. Karar vermenizde, bir şeyler öğrenmenizde, plan yapmanızda veya herhangi bir konuda yazı oluşturmanızda size yardımcı olmak için buradayım. Ne üzerine konuşalım?',
      followUps: [
        'Hangi telefonu almalıyım?',
        'Yapay zeka nedir, nasıl çalışır?',
        'Kariyer değişikliği için plan yap',
        'İş başvurusu için kapak mektubu yaz',
      ],
    };
  }

  if (isThanks) {
    return {
      tone: 'acknowledgment',
      message: 'Rica ederim! Başka bir konuda yardımcı olmamı ister misiniz? Karar analizi, öğrenme, planlama veya yazı konularında her an yardıma hazırım.',
      followUps: [
        'Yeni bir konu hakkında soru sor',
        'Farklı bir karar için analiz yaptır',
        'Bir plan oluştur',
      ],
    };
  }

  if (isOpinion) {
    return {
      tone: 'helpful',
      message: `Bu konuda size yardımcı olmaktan memnuniyet duyarım. Sorunuzu biraz daha detaylandırırsanız daha kapsamlı bir analiz sunabilirim. Hangi konuda görüş veya karar analizi istersiniz?`,
      followUps: [
        'Daha detaylı soru sor',
        'Karar analizi yaptır',
        'Araştırma raporu hazırlat',
      ],
    };
  }

  return {
    tone: 'helpful',
    message: `Anlıyorum. Bu konuda size en iyi şekilde yardımcı olmak için birkaç seçeneğim var: detaylı bir karar analizi yapabilirim, konuyu baştan sona öğretebilirim, bir plan çerçevesi hazırlayabilirim veya ilgili bir metin yazabilirim. Nasıl devam etmek istersiniz?`,
    followUps: [
      'Karar analizi yaptır',
      'Konuyu anlat',
      'Plan oluştur',
      'İlgili içerik yaz',
    ],
  };
}

// ─── Learning generator ───────────────────────────────────────────────────────

const KNOWN_TOPICS: Record<string, Partial<LearningData>> = {
  'yapay zeka': {
    summary: 'Yapay zeka (AI), insan zekasını taklit eden ve öğrenme, problem çözme, dil anlama gibi görevleri yerine getirebilen bilgisayar sistemleridir.',
    keyPoints: [
      { title: 'Makine Öğrenmesi', detail: 'Verileri analiz ederek kendi kendine öğrenen algoritmalar sistemidir.' },
      { title: 'Derin Öğrenme', detail: 'İnsan beynini taklit eden yapay sinir ağlarına dayalı gelişmiş öğrenme yöntemidir.' },
      { title: 'Doğal Dil İşleme', detail: 'Bilgisayarların insan dilini anlayıp üretmesini sağlayan teknolojidir (ChatGPT gibi).' },
      { title: 'Uygulama Alanları', detail: 'Sağlık, finans, ulaşım, eğitim, sanat ve daha pek çok alanda devrim yaratıyor.' },
    ],
    example: 'Netflix\'in film önerileri, Spotify\'ın müzik önerileri ve tıbbi görüntülerde kanser tespiti yapay zekanın günlük hayattaki kullanımlarıdır.',
    nextTopics: ['Makine Öğrenmesi Algoritmaları', 'ChatGPT Nasıl Çalışır', 'Yapay Zeka Etik Sorunları'],
  },
  'blockchain': {
    summary: 'Blockchain, verilerin zincir halinde bağlantılı bloklarda saklandığı, merkezi bir otoriteye ihtiyaç duymayan dağıtık bir veritabanı teknolojisidir.',
    keyPoints: [
      { title: 'Merkeziyetsizlik', detail: 'Tek bir sunucu yerine binlerce bilgisayara dağılmış şekilde çalışır.' },
      { title: 'Değiştirilemezlik', detail: 'Bir kez yazılan veri değiştirilemez, bu da güvenliği artırır.' },
      { title: 'Akıllı Kontratlar', detail: 'Belirli koşullar sağlandığında otomatik yürütülen dijital sözleşmelerdir.' },
      { title: 'Kullanım Alanları', detail: 'Kripto para, tedarik zinciri, sağlık kaydı, oylama sistemleri.' },
    ],
    example: 'Bitcoin işlemleri blockchain üzerinde saklanır. Birisi size Bitcoin gönderdiğinde bu işlem tüm ağa duyurulur ve değiştirilemez hale gelir.',
    nextTopics: ['Bitcoin ve Kripto Paralar', 'DeFi (Merkeziyetsiz Finans)', 'NFT Nedir'],
  },
};

function generateLearning(question: string): LearningData {
  const topic = extractTopic(question, 3);
  const topicLower = topic.toLowerCase();
  const seed = question;

  // Check if we have specific knowledge
  const knownKey = Object.keys(KNOWN_TOPICS).find((k) => topicLower.includes(k));
  if (knownKey) {
    const known = KNOWN_TOPICS[knownKey];
    return {
      topic: topic.charAt(0).toUpperCase() + topic.slice(1),
      summary: known.summary ?? `${topic}, günümüzde önemli bir konu olup pek çok alanda uygulama bulan bir kavramdır.`,
      keyPoints: known.keyPoints ?? [],
      example: known.example ?? '',
      nextTopics: known.nextTopics ?? [],
    };
  }

  // Dynamic fallback — contextually anchored to the topic
  const summaries = [
    `${topic}, temelinde belirli prensiplere dayanan ve pratikte geniş uygulama alanı bulan bir kavramdır. Doğru anlaşıldığında hem kişisel hem de profesyonel hayatta büyük fark yaratabilir.`,
    `${topic} konusu, günümüzde giderek artan önemiyle öne çıkan ve uzmanların sıkça ele aldığı bir alandır. Bu konuyu anlamak için temel kavramlardan başlamak en verimli yoldur.`,
    `${topic}, karmaşık görünen ama doğru yaklaşımla sistematik biçimde öğrenilebilen bir konudur. Temel prensipleri kavradıktan sonra pratik uygulamalar çok daha anlamlı hale gelir.`,
  ];

  const keyPointSets = [
    [
      { title: 'Temel Kavram', detail: `${topic} konusunun çekirdeğini oluşturan temel prensipler, diğer her şeyin üzerine inşa edildiği sağlam bir zemin sunar.` },
      { title: 'Pratik Uygulama', detail: `${topic} günlük hayatta ve profesyonel ortamda çeşitli şekillerde karşınıza çıkar; farkında olmak sizi avantajlı kılar.` },
      { title: 'Yaygın Yanlış Anlamalar', detail: `${topic} hakkındaki en sık yapılan hatalar genellikle temel kavramların eksik anlaşılmasından kaynaklanır.` },
      { title: 'Öğrenme Yolu', detail: `${topic} konusunda uzmanlaşmak için önce teorik temeli, ardından pratik örnekleri takip etmek en etkin yöntemdir.` },
    ],
    [
      { title: 'Tarihsel Arka Plan', detail: `${topic} kavramı, zaman içinde farklı düşünürler ve uygulayıcılar tarafından şekillendirilmiştir.` },
      { title: 'Temel İlkeler', detail: `${topic} konusunun anlaşılmasını kolaylaştıran birkaç temel ilke, tüm karmaşıklığı organize eder.` },
      { title: 'Modern Yaklaşımlar', detail: `Günümüzde ${topic} alanında yeni metodlar ve araçlar ortaya çıkmış, öğrenme süreci hızlanmıştır.` },
      { title: 'Sık Sorulan Sorular', detail: `${topic} hakkında merak edilen konular arasında "nasıl başlanır" ve "ne kadar zaman alır" öne çıkar.` },
    ],
  ];

  const examples = [
    `Örneğin, ${topic} konusunu günlük hayatta en açık şekilde [gerçek dünya uygulamasında] görmek mümkündür. Bu örnek, teorik bilgiyi somutlaştırır.`,
    `${topic} kavramını pratikte en iyi anlama yolu, somut bir senaryo üzerinden düşünmektir. Bir profesyonelin bu konuyu nasıl uyguladığını takip etmek öğrenmeyi hızlandırır.`,
  ];

  const nextTopicsPool = [
    [`${topic} İleri Seviye`, `${topic} Pratik Uygulamaları`, `${topic} ile İlgili Araçlar`],
    [`${topic} Temelleri`, `${topic} Tarihçesi`, `${topic} Sektördeki Yeri`],
  ];

  const kpIdx = stableRandom(seed, 0, keyPointSets.length - 1);
  const exIdx = stableRandom(seed + 'e', 0, examples.length - 1);
  const ntIdx = stableRandom(seed + 'n', 0, nextTopicsPool.length - 1);

  return {
    topic: topic.charAt(0).toUpperCase() + topic.slice(1),
    summary: summaries[stableRandom(seed + 's', 0, summaries.length - 1)],
    keyPoints: keyPointSets[kpIdx],
    example: examples[exIdx],
    nextTopics: nextTopicsPool[ntIdx],
  };
}

// ─── Writing generator ────────────────────────────────────────────────────────

const WRITING_TYPES = [
  { signals: ['e-posta', 'eposta', 'mail', 'elektronik posta'], type: 'E-posta' },
  { signals: ['mektup'], type: 'Mektup' },
  { signals: ['özgeçmiş', 'cv'], type: 'Özgeçmiş' },
  { signals: ['kapak mektubu', 'başvuru mektubu'], type: 'Kapak Mektubu' },
  { signals: ['makale', 'blog'], type: 'Makale' },
  { signals: ['rapor'], type: 'Rapor' },
  { signals: ['özet', 'özetle'], type: 'Özet' },
  { signals: ['şiir'], type: 'Şiir' },
  { signals: ['hikaye', 'hikâye'], type: 'Kısa Hikaye' },
  { signals: ['ilan', 'duyuru'], type: 'Duyuru' },
  { signals: ['sunum', 'slayt'], type: 'Sunum Metni' },
];

function detectWritingType(question: string): string {
  const lower = question.toLowerCase();
  for (const { signals, type } of WRITING_TYPES) {
    if (signals.some((s) => lower.includes(s))) return type;
  }
  return 'Metin';
}

function generateWriting(question: string): WritingData {
  const topic = extractTopic(question, 5);
  const contentType = detectWritingType(question);
  const lower = question.toLowerCase();

  let content = '';
  let wordCount = 0;

  if (contentType === 'E-posta') {
    const isVeda = lower.includes('veda') || lower.includes('ayrılık') || lower.includes('son gün');
    const isIstifa = lower.includes('istifa') || lower.includes('ayrılıyorum');
    const isBasvuru = lower.includes('başvuru') || lower.includes('iş başvurusu');

    if (isVeda) {
      content = `Konu: Veda ve Teşekkür\n\nSayın ekip,\n\nBirlikte geçirdiğimiz bu sürecin sonuna gelirken, her birinize ayrı ayrı teşekkür etmek istedim. Bu yolculukta yaşadığımız deneyimler, birlikte üstesinden geldiğimiz zorluklar ve paylaştığımız başarılar benim için son derece değerliydi.\n\nBurada öğrendiklerim ve sizinle kurduğum bağ, kariyerimde taşıyacağım en değerli kazanımlar arasında yer alıyor. Destekleriniz ve anlayışınız için minnettarım.\n\nGelecekte yollarımız kesişirse çok mutlu olurum. Her birinize başarılar dilerim.\n\nSaygılarımla,\n[Adınız]`;
    } else if (isIstifa) {
      content = `Konu: İstifa Bildirimi\n\nSayın [Yönetici Adı],\n\nBu e-posta ile [şirket adı] bünyesindeki [pozisyon] görevimden, [tarih] itibarıyla ayrılmak istediğimi bildirmek istiyorum.\n\n[Şirket adı]'nda geçirdiğim süre boyunca edindiğim deneyimler ve kazandığım bilgiler için çok minnettarım. Bu dönem, hem profesyonel hem de kişisel gelişimime büyük katkı sağladı.\n\nDevir teslim sürecinde gerekli tüm hazırlıkları tamamlamaya ve yerine geçecek kişiye en iyi şekilde destek olmaya hazırım.\n\nAnlayışınız için teşekkür eder, başarılarınızın devamını dilerim.\n\nSaygılarımla,\n[Adınız]`;
    } else if (isBasvuru) {
      content = `Konu: İş Başvurusu — [Pozisyon Adı]\n\nSayın İnsan Kaynakları Departmanı,\n\nLinkedIn/kariyer.net üzerinde paylaştığınız [Pozisyon Adı] ilanını inceledim ve başvurmak istediğimi bildirmek için yazıyorum.\n\n[Kısa kendinizi tanıtın: X yıllık deneyim, temel güçlü yönleriniz]. Özellikle [şirketin değeri/projesi] beni bu pozisyon için heyecanlandırıyor.\n\nÖzgeçmişimi ek olarak iletiyorum. Müsait olduğunuzda görüşme imkânı tanırsanız memnuniyet duyarım.\n\nSaygılarımla,\n[Adınız]\n[İletişim Bilgileriniz]`;
    } else {
      content = `Konu: ${topic}\n\nSayın [Alıcı],\n\n${topic} konusunda sizinle iletişime geçmek istedim.\n\n[Ana mesajınızı buraya yazın. Konuyu net ve açık bir şekilde ifade etmeye özen gösterin. Gerekli bağlamı sağlayın ve ne beklediğinizi belirtin.]\n\nİlginiz için teşekkür eder, yanıtınızı beklediğimi belirtmek isterim.\n\nSaygılarımla,\n[Adınız]`;
    }
    wordCount = content.split(/\s+/).length;
  } else if (contentType === 'Makale') {
    content = `# ${topic}\n\n## Giriş\n\n${topic} konusu, günümüzde giderek daha fazla önem kazanan ve hem bireyler hem de kurumlar açısından dikkate alınması gereken kritik bir alandır. Bu makalede ${topic} kavramını farklı boyutlarıyla ele alacak ve pratik çıkarımlar sunmaya çalışacağız.\n\n## Temel Kavramlar\n\n${topic}'in doğru anlaşılabilmesi için önce temel kavramları netleştirmek gerekmektedir. Bu alanda birbiriyle bağlantılı birkaç ana unsur bulunmaktadır ve her biri diğerini tamamlar niteliktedir.\n\n## Pratik Uygulamalar\n\nTeoriyi hayata geçirmek söz konusu olduğunda ${topic} alanında birçok farklı yaklaşım mevcuttur. Başarılı örnekler incelendiğinde ortak paydaların net biçimde ortaya çıktığı görülür.\n\n## Sonuç\n\n${topic}, dikkatli bir yaklaşım ve sürekli öğrenme gerektiren dinamik bir alandır. Bu makalede sunulan perspektifler, konuya ilgi duyanlar için bir başlangıç noktası niteliğindedir.`;
    wordCount = content.split(/\s+/).length;
  } else if (contentType === 'Özet') {
    content = `**${topic} — Özet**\n\nAna Nokta: [Metnin/konunun ana fikri buraya gelir]\n\nTemel Çıkarımlar:\n• [Birinci önemli nokta]\n• [İkinci önemli nokta]\n• [Üçüncü önemli nokta]\n\nSonuç: [Genel değerlendirme ve çıkarımlar]`;
    wordCount = content.split(/\s+/).length;
  } else {
    content = `[${contentType}] — ${topic}\n\n[Bu metin ${topic} konusunda hazırlanmış ${contentType.toLowerCase()} taslağıdır. İçeriği ihtiyacınıza göre özelleştirebilirsiniz.]\n\n[Giriş bölümü: Konuyu tanıtın]\n\n[Ana bölüm: Detayları aktarın]\n\n[Kapanış: Sonuç ve çağrı]`;
    wordCount = content.split(/\s+/).length;
  }

  return {
    taskDescription: topic,
    contentType,
    content,
    wordCount,
    suggestions: [
      'Tonu ve üslubu ihtiyacınıza göre ayarlayabilirsiniz',
      'Kişisel detaylarla zenginleştirin',
      'Hedef kitlenizi göz önünde bulundurarak revize edin',
    ],
  };
}

// ─── Research generator ───────────────────────────────────────────────────────

function generateResearch(question: string): ResearchData {
  const topic = extractTopic(question, 4);
  const seed = question;

  const summaryTemplates = [
    `${topic} konusuna ilişkin kapsamlı bir değerlendirme yapıldığında, mevcut durumun çok boyutlu bir yapıya sahip olduğu görülmektedir. Bu rapor, temel bulguları ve ilgili bağlamı sistematik biçimde sunmaktadır.`,
    `${topic} alanındaki mevcut durum, farklı perspektiflerden ele alındığında hem fırsatlar hem de zorluklar barındırmaktadır. Bu araştırma, konuyu bütüncül bir bakış açısıyla değerlendirmektedir.`,
  ];

  const findingSets = [
    [
      { headline: `${topic} Mevcut Durumu`, detail: `${topic} alanında son dönemde gözlemlenen gelişmeler, konunun dinamik bir seyir izlediğine işaret etmektedir. Veriler genel olarak olumlu bir tablo ortaya koymaktadır.` },
      { headline: 'Küresel ve Yerel Karşılaştırma', detail: `Küresel ölçekte ${topic} konusundaki standartlar incelendiğinde, Türkiye'nin bu alanda kendine özgü dinamiklere sahip olduğu görülmektedir.` },
      { headline: 'Risk Faktörleri', detail: `${topic} ile ilişkili başlıca risk unsurları arasında değişen koşullar, bilgi eksikliği ve planlama hataları sayılabilir. Bu risklerin önceden belirlenmesi kritik öneme sahiptir.` },
      { headline: 'Fırsatlar ve Gelişim Alanları', detail: `${topic} alanında henüz tam olarak değerlendirilmemiş önemli fırsatlar mevcuttur. Doğru strateji ve zamanlama ile bu fırsatlardan yararlanmak mümkündür.` },
    ],
    [
      { headline: 'Tarihsel Bağlam', detail: `${topic} konusu zaman içinde önemli dönüşümler geçirmiştir. Bu tarihsel perspektif, günümüz durumunun daha iyi anlaşılmasını sağlar.` },
      { headline: 'Paydaş Analizi', detail: `${topic} ile ilgilenen ya da etkilenen farklı grupların beklentileri ve öncelikleri birbirinden ayrışmaktadır.` },
      { headline: 'Veri ve İstatistikler', detail: `Mevcut verilere göre ${topic} alanında belirgin bir trend gözlemlenmektedir. Bu trend, karar alma süreçlerinde göz önünde bulundurulmalıdır.` },
      { headline: 'Uzman Görüşleri', detail: `Alandaki uzmanların ${topic} konusundaki değerlendirmeleri, birkaç temel noktada örtüşmektedir.` },
    ],
  ];

  const conclusionTemplates = [
    `${topic} hakkında yapılan bu araştırma, konunun çok boyutlu yapısını ve dikkatli bir değerlendirme gerektirdiğini ortaya koymaktadır. Sunulan bulgular bir başlangıç noktası niteliğinde olup daha derinlemesine araştırmalarla desteklenmelidir.`,
    `Bu araştırma, ${topic} konusundaki temel dinamikleri özetlemektedir. Uzun vadeli kararlar için ek kaynaklara başvurulması ve güncel gelişmelerin takip edilmesi önerilmektedir.`,
  ];

  const fsIdx = stableRandom(seed, 0, findingSets.length - 1);

  return {
    topic: topic.charAt(0).toUpperCase() + topic.slice(1),
    executiveSummary: summaryTemplates[stableRandom(seed + 'sum', 0, summaryTemplates.length - 1)],
    findings: findingSets[fsIdx],
    conclusion: conclusionTemplates[stableRandom(seed + 'con', 0, conclusionTemplates.length - 1)],
  };
}

// ─── Planning generator ───────────────────────────────────────────────────────

function generatePlanning(question: string): PlanningData {
  const goal = extractTopic(question, 5);
  const seed = question;
  const lower = question.toLowerCase();

  // Detect duration hints
  const hasMonth = /ay|aylık/.test(lower);
  const hasYear = /yıl|yıllık/.test(lower);
  const hasWeek = /hafta|haftalık/.test(lower);
  const totalDuration = hasWeek ? '4-8 Hafta' : hasMonth ? '3-6 Ay' : hasYear ? '12 Ay' : '2-4 Ay';

  const phaseSets = [
    [
      {
        name: 'Hazırlık ve Araştırma',
        tasks: [
          `${goal} konusunda mevcut durumunuzu değerlendirin`,
          'Hedeflerinizi ve başarı kriterlerini netleştirin',
          'Gerekli kaynakları ve araçları belirleyin',
          'Benzer süreçleri araştırın, öğrenin',
        ],
        duration: '1-2 Hafta',
      },
      {
        name: 'Temel Adımlar',
        tasks: [
          'Küçük, ölçülebilir alt hedefler belirleyin',
          'İlk somut adımı bugün atın',
          'Düzenli ilerleme takibi için bir sistem kurun',
          'Öğrendiklerinizi not alın',
        ],
        duration: '4-8 Hafta',
      },
      {
        name: 'Gelişim ve Optimizasyon',
        tasks: [
          'İlk sonuçları değerlendirin ve geri bildirim toplayın',
          'Işe yaramayan yaklaşımları değiştirin',
          'Başarılı stratejileri ölçeklendirin',
          'Motivasyonunuzu canlı tutun',
        ],
        duration: '4-8 Hafta',
      },
      {
        name: 'Sonuçlandırma ve Sürdürme',
        tasks: [
          'Hedeflere ulaşma durumunu değerlendirin',
          'Öğrendiklerinizi belgeleyin',
          'Bir sonraki hedefi belirleyin',
          'Kazanımları kalıcı hale getirin',
        ],
        duration: '2-4 Hafta',
      },
    ],
  ];

  const tipSets = [
    [
      'Her gün küçük bir ilerleme, büyük bir sıçramadan değerlidir',
      'İlk hafta en zor dönemdir — pes etmeyin',
      'Benzer hedefe ulaşmış birileriyle bağlantı kurun',
      'İlerlemenizi görünür kılın: takvim, ajanda veya uygulama kullanın',
    ],
    [
      'Mükemmel planı beklemek yerine iyi planı hemen hayata geçirin',
      'Engellerle karşılaştığınızda planı esnetin, hedefi değil',
      'Haftalık kısa değerlendirmeler büyük sapmaları önler',
      'Küçük başarıları kutlayın — motivasyon en değerli kaynak',
    ],
  ];

  const psIdx = stableRandom(seed + 'p', 0, phaseSets.length - 1);
  const tIdx = stableRandom(seed + 't', 0, tipSets.length - 1);

  return {
    goal: goal.charAt(0).toUpperCase() + goal.slice(1),
    totalDuration,
    phases: phaseSets[psIdx],
    successTips: tipSets[tIdx],
  };
}

// ─── Problem solving generator ────────────────────────────────────────────────

function generateProblemSolving(question: string): ProblemSolvingData {
  const topic = extractTopic(question, 4);
  const seed = question;
  const lower = question.toLowerCase();

  const isTech = /bilgisayar|telefon|uygulama|yazılım|internet|wifi|şifre|program|ekran|ses|kamera/.test(lower);
  const isPersonal = /iş|kariyer|ilişki|aile|arkadaş|para|borç|sağlık/.test(lower);

  let diagnosis = '';
  let solutions: ProblemSolvingData['solutions'] = [];
  let quickFix = '';

  if (isTech) {
    diagnosis = `"${topic}" sorununun en yaygın nedenleri: yazılım güncellemesi eksikliği, önbellek birikimi, donanım uyumsuzluğu veya yanlış yapılandırma. Bu sorunların büyük çoğunluğu temel adımlarla çözülür.`;
    solutions = [
      {
        title: 'Hızlı Teşhis ve Yeniden Başlatma',
        steps: [
          'Cihazı tamamen kapatıp 30 saniye bekleyin, açın',
          'İlgili uygulamayı tamamen kapatıp yeniden başlatın',
          'Önbelleği (cache) temizleyin',
          'Sorunun hâlâ devam edip etmediğini kontrol edin',
        ],
        effort: 'Düşük',
      },
      {
        title: 'Yazılım ve Ayar Güncelleme',
        steps: [
          'İşletim sistemi ve uygulama güncellemelerini kontrol edin',
          'Sorunlu uygulamayı kaldırıp yeniden yükleyin',
          'Varsayılan ayarlara (factory reset) sıfırlayın',
          'Gerekirse destek merkezi veya forumdan yardım alın',
        ],
        effort: 'Orta',
      },
      {
        title: 'Kalıcı Çözüm',
        steps: [
          'Sorunun kök nedenini belgeleyin',
          'Benzer sorunları önleyecek ayarları yapın',
          'Düzenli yedekleme alışkanlığı edinin',
          'Gerekirse yetkili servis desteği alın',
        ],
        effort: 'Orta',
      },
    ];
    quickFix = 'Önce cihazı tamamen yeniden başlatın — bu adım sorunların %40\'ını çözer.';
  } else if (isPersonal) {
    diagnosis = `"${topic}" konusundaki sorunlar genellikle açık iletişim eksikliği, net hedef belirlenmemesi veya birikmiş stres/yorgunluktan kaynaklanır. Bu tür sorunlar sabır ve sistematik yaklaşımla çözülebilir.`;
    solutions = [
      {
        title: 'Acil Durum Yönetimi',
        steps: [
          'Durumu olduğundan büyük görmemeye çalışın',
          'Güvendiğiniz biriyle konuşun',
          'Süreci belgelemek için not alın',
          'Kısa vadeli somut bir adım belirleyin',
        ],
        effort: 'Düşük',
      },
      {
        title: 'Kök Neden Analizi',
        steps: [
          'Sorunun gerçek kaynağını belirleyin (semptom vs. neden)',
          'İlgili taraflarla açık bir diyalog başlatın',
          'Beklentileri ve sınırları netleştirin',
          'Gerekirse profesyonel destek alın',
        ],
        effort: 'Orta',
      },
      {
        title: 'Uzun Vadeli Çözüm',
        steps: [
          'Benzer sorunları önleyecek alışkanlıklar edinin',
          'Düzenli değerlendirme seansları planlayın',
          'Destek ağınızı güçlendirin',
          'İlerlemeyi ölçün ve kutlayın',
        ],
        effort: 'Yüksek',
      },
    ];
    quickFix = 'Bugün atılabilecek en küçük adımı belirleyin ve sadece onu yapın.';
  } else {
    diagnosis = `"${topic}" konusundaki sorunun kök nedenini doğru tespit etmek, çözümün yarısıdır. Genellikle benzer sorunlar birkaç ortak faktörden kaynaklanır: yetersiz bilgi, kaynak eksikliği veya yanlış yaklaşım.`;
    solutions = [
      {
        title: 'Hızlı Değerlendirme',
        steps: [
          'Sorunun tam olarak ne olduğunu 1-2 cümleyle tanımlayın',
          'Daha önce benzer bir sorunla karşılaştınız mı? Çözümü hatırlayın',
          'Basit çözümleri önce deneyin',
          'Sonucu gözlemleyin',
        ],
        effort: 'Düşük',
      },
      {
        title: 'Sistematik Yaklaşım',
        steps: [
          'Sorunun olası nedenlerini listeleyin',
          'Her nedeni ayrı ayrı test edin (birer birer)',
          'İşe yarayanı not alın',
          'Uygulamaya geçin ve takip edin',
        ],
        effort: 'Orta',
      },
      {
        title: 'Uzman Desteği',
        steps: [
          'Konunun uzmanlarını araştırın',
          'Benzer sorunu yaşayanların çözümlerine bakın (forum, topluluk)',
          'Gerekirse profesyonel destek alın',
          'Öğrendiklerinizi belgeleyin',
        ],
        effort: 'Orta',
      },
    ];
    quickFix = `Sorunu 1 cümleyle net ifade edin — bu netlik çoğu zaman çözümün kendisini gösterir.`;
  }

  return {
    problemStatement: topic.charAt(0).toUpperCase() + topic.slice(1),
    diagnosis,
    solutions,
    quickFix,
  };
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Processes a user query end-to-end.
 * Detect intent → generate response → return typed result.
 *
 * Replace the switch body with an LLM call to upgrade from rule-based to AI.
 */
export async function processQuery(question: string): Promise<AtlasResponseData> {
  console.log("processQuery çalıştı:", question)

  const reply = await askBackend(question);

  return {
    intent: "conversation",
    data: {
      message: reply,
      tone: "helpful",
      followUps: [],
    },
  };
}

 