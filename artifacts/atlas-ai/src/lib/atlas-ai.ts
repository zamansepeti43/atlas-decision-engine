/**
 * Atlas AI — Decision Analysis Engine
 *
 * Architecture note:
 * The public contract is `analyzeDecision(question: string): Promise<AnalysisResult>`.
 * The current implementation is a deterministic rule-based engine that generates
 * contextually relevant reports from the user's question.
 *
 * To switch to OpenAI (or any LLM), replace ONLY the body of `analyzeDecision`
 * with the integration below. The AnalysisResult interface, and every component
 * that renders the report, stay exactly the same.
 *
 * ─── OpenAI drop-in replacement ───────────────────────────────────────────────
 *
 *   import OpenAI from 'openai';
 *
 *   const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
 *
 *   export async function analyzeDecision(question: string): Promise<AnalysisResult> {
 *     const completion = await openai.chat.completions.create({
 *       model: 'gpt-4o',
 *       response_format: { type: 'json_object' },
 *       messages: [
 *         {
 *           role: 'system',
 *           content: `Sen Atlas AI karar analiz motorusun. Kullanıcının sorusunu analiz et ve
 * aşağıdaki JSON formatında Türkçe yanıt ver:
 * {
 *   "score": <0-100 arası Atlas skoru>,
 *   "confidenceLevel": <0-100 arası güven skoru>,
 *   "recommendation": "<ana öneri cümlesi>",
 *   "advantages": ["<avantaj1>", "<avantaj2>", "<avantaj3>"],
 *   "disadvantages": ["<dezavantaj1>", "<dezavantaj2>"],
 *   "alternatives": [
 *     { "name": "<alternatif adı>", "description": "<kısa açıklama>", "score": <0-100> }
 *   ],
 *   "reasoning": "<2-3 cümlelik neden bu öneri açıklaması>"
 * }`,
 *         },
 *         { role: 'user', content: question },
 *       ],
 *     });
 *     return JSON.parse(completion.choices[0].message.content!) as AnalysisResult;
 *   }
 *
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ─── Public interface ─────────────────────────────────────────────────────────

export interface AnalysisResult {
  score: number;
  recommendation: string;
  advantages: string[];
  disadvantages: string[];
  alternatives: Array<{
    name: string;
    description: string;
    score: number;
  }>;
  reasoning: string;
  confidenceLevel: number;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type Category =
  | 'teknoloji'
  | 'arac'
  | 'seyahat'
  | 'finans'
  | 'kariyer'
  | 'emlak'
  | 'saglik'
  | 'egitim'
  | 'yiyecek'
  | 'genel';

interface ParsedIntent {
  category: Category;
  rawQuestion: string;
  budgetTL: number | null;
  mentionedBrands: string[];
  mentionedLocations: string[];
  keywords: string[];
  hasComparison: boolean;
  isPersonalDecision: boolean;
}

// ─── Category detection ───────────────────────────────────────────────────────

const CATEGORY_SIGNALS: Record<Category, string[]> = {
  teknoloji: [
    'telefon', 'laptop', 'bilgisayar', 'tablet', 'akıllı', 'iphone', 'samsung',
    'xiaomi', 'huawei', 'pixel', 'oneplus', 'macbook', 'dell', 'lenovo', 'asus',
    'notebook', 'dizüstü', 'pc', 'monitör', 'kulaklık', 'watch', 'saat', 'tv',
    'televizyon', 'kamera', 'fotoğraf', 'yazıcı', 'router', 'internet', 'gaming',
    'oyun bilgisayarı', 'gpu', 'işlemci', 'ram',
  ],
  arac: [
    'araba', 'araç', 'otomobil', 'suv', 'sedan', 'hybrid', 'elektrikli', 'dizel',
    'benzinli', 'toyota', 'volkswagen', 'honda', 'bmw', 'mercedes', 'audi', 'ford',
    'renault', 'peugeot', 'fiat', 'hyundai', 'kia', 'volvo', 'skoda', 'motor',
    'ikinci el', 'sıfır km', 'otomatik vites', 'manuel',
  ],
  seyahat: [
    'tatil', 'seyahat', 'gezi', 'uçak', 'otel', 'airbnb', 'tur', 'yurt dışı',
    'yurt içi', 'balayı', 'vize', 'pasaport', 'istanbul', 'antalya', 'kapadokya',
    'bodrum', 'marmaris', 'paris', 'londra', 'roma', 'barselona', 'dubai', 'bali',
    'new york', 'tokyo', 'amsterdam', 'prag', 'kiralık', 'bilet',
  ],
  finans: [
    'yatırım', 'borsa', 'hisse', 'kripto', 'bitcoin', 'döviz', 'dolar', 'euro',
    'altın', 'faiz', 'birikim', 'tasarruf', 'kredi', 'borç', 'sigorta', 'emeklilik',
    'fon', 'etf', 'tahvil', 'banka', 'hesap', 'kart', 'finansal', 'para',
  ],
  kariyer: [
    'iş', 'kariyer', 'meslek', 'şirket', 'maaş', 'ücret', 'terfi', 'işe gir',
    'işten ayrıl', 'istifa', 'serbest', 'freelance', 'uzaktan', 'remote',
    'yurt dışında çalış', 'startup', 'girişim', 'açmak', 'kurmak', 'cv', 'mülakat',
    'staj', 'uzman', 'müdür', 'proje', 'takım',
  ],
  emlak: [
    'ev', 'daire', 'konut', 'kira', 'satın al', 'gayrimenkul', 'site', 'rezidans',
    'müstakil', 'kat', 'metrekare', 'oda', 'bahçe', 'tapu', 'ipotek', 'kredi',
    'deprem', 'yeni bina', 'ikinci el ev', 'kiracı', 'yatırımlık',
  ],
  saglik: [
    'doktor', 'hastane', 'ilaç', 'tedavi', 'ameliyat', 'diyet', 'kilo', 'spor',
    'egzersiz', 'gym', 'beslenme', 'vitamin', 'takviye', 'psikoloji', 'terapi',
    'göz', 'diş', 'cilt', 'saç', 'dermatoloji', 'check-up', 'sağlık sigortası',
  ],
  egitim: [
    'okul', 'üniversite', 'master', 'lisans', 'yüksek lisans', 'doktora', 'bölüm',
    'sınav', 'ders', 'özel ders', 'kurs', 'sertifika', 'mba', 'yurt dışı eğitim',
    'öğrenci', 'burs', 'dil okulu', 'ingilizce', 'almanca',
  ],
  yiyecek: [
    'restoran', 'kafe', 'yemek', 'tarif', 'mutfak', 'pizza', 'burger', 'sushi',
    'vejetaryen', 'vegan', 'kahve', 'çay', 'içecek', 'tatlı', 'pasta', 'diyet',
    'glutensiz', 'organik', 'ürün', 'market', 'süpermarket',
  ],
  genel: [],
};

function detectCategory(q: string): Category {
  const lower = q.toLowerCase();
  const scores: Partial<Record<Category, number>> = {};

  for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS) as [Category, string[]][]) {
    if (cat === 'genel') continue;
    let score = 0;
    for (const signal of signals) {
      if (lower.includes(signal)) score += signal.split(' ').length; // multi-word signals worth more
    }
    if (score > 0) scores[cat] = score;
  }

  if (Object.keys(scores).length === 0) return 'genel';

  return (Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0]) as Category;
}

// ─── Intent parsing ───────────────────────────────────────────────────────────

const BRANDS: Record<string, string[]> = {
  teknoloji: [
    'Samsung', 'Apple', 'iPhone', 'Google', 'Xiaomi', 'Huawei', 'OnePlus',
    'Sony', 'LG', 'Nokia', 'Motorola', 'MacBook', 'Dell', 'Lenovo', 'ASUS',
    'HP', 'Acer', 'MSI', 'Razer', 'Microsoft', 'Surface',
  ],
  arac: [
    'Toyota', 'Volkswagen', 'Honda', 'BMW', 'Mercedes', 'Audi', 'Ford',
    'Renault', 'Peugeot', 'Fiat', 'Hyundai', 'Kia', 'Volvo', 'Skoda',
    'Seat', 'Opel', 'Dacia', 'Mitsubishi', 'Nissan', 'Mazda',
  ],
};

const LOCATIONS = [
  'İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Bodrum', 'Kapadokya', 'Marmaris',
  'Paris', 'Londra', 'Roma', 'Barcelona', 'Amsterdam', 'Prag', 'Dubai', 'Bali',
  'New York', 'Tokyo', 'Berlin', 'Viyana', 'Lizbon', 'Budapeşte', 'Atina',
  'Tayland', 'Endonezya', 'Japonya', 'İtalya', 'Fransa', 'İspanya', 'Portekiz',
];

function parseIntent(question: string): ParsedIntent {
  const category = detectCategory(question);
  const lower = question.toLowerCase();

  // Extract TL budget
  const budgetMatch =
    question.match(/(\d[\d.,]*)\s*(tl|lira|₺)/i) ||
    question.match(/([\d]+)\s*bin\s*(tl|lira|₺)?/i) ||
    question.match(/bütçe[^0-9]*(\d[\d.,]*)/i);
  let budgetTL: number | null = null;
  if (budgetMatch) {
    const raw = budgetMatch[1].replace(/\./g, '').replace(',', '.');
    const num = parseFloat(raw);
    if (!isNaN(num)) budgetTL = question.toLowerCase().includes('bin') ? num * 1000 : num;
  }

  // Extract mentioned brands
  const brandPool = [...(BRANDS[category] ?? []), ...Object.values(BRANDS).flat()];
  const mentionedBrands = brandPool.filter((b) =>
    lower.includes(b.toLowerCase())
  );

  // Extract locations
  const mentionedLocations = LOCATIONS.filter((loc) =>
    lower.includes(loc.toLowerCase())
  );

  // General keywords (nouns / topics)
  const keywords = question
    .split(/[\s,،.?!]+/)
    .filter((w) => w.length > 3)
    .map((w) => w.replace(/['"()[\]]/g, ''));

  const hasComparison = /m[iı] yoksa|vs|karşılaştır|hangisi|farkı nedir|arasında/i.test(question);
  const isPersonalDecision = /benim|bana|benimçin|bence|ben /i.test(question);

  return {
    category,
    rawQuestion: question,
    budgetTL,
    mentionedBrands: [...new Set(mentionedBrands)],
    mentionedLocations: [...new Set(mentionedLocations)],
    keywords,
    hasComparison,
    isPersonalDecision,
  };
}

// ─── Dynamic report generation ────────────────────────────────────────────────

interface CategoryTemplate {
  scoreBase: [number, number];
  confidenceBase: [number, number];
  recommendationFn: (intent: ParsedIntent) => string;
  advantagesFn: (intent: ParsedIntent) => string[];
  disadvantagesFn: (intent: ParsedIntent) => string[];
  alternativesFn: (intent: ParsedIntent) => AnalysisResult['alternatives'];
  reasoningFn: (intent: ParsedIntent, score: number) => string;
}

// Seeded pseudo-random based on question content — same question always gives same result
function stableRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash % 1000) / 1000;
  return Math.round(min + normalized * (max - min));
}

function pickN<T>(arr: T[], n: number, seed: string): T[] {
  const shuffled = [...arr].sort((a, b) =>
    stableRandom(seed + String(a), 0, 100) - stableRandom(seed + String(b), 0, 100)
  );
  return shuffled.slice(0, n);
}

// ── Technology template ───────────────────────────────────────────────────────

const TECH_ADVANTAGES = [
  (b: string) => `${b} modeli bu fiyat segmentinde güçlü işlemci performansı sunuyor`,
  (b: string) => `${b} yazılım güncellemelerini uzun süre alacak, geleceğe dönük bir yatırım`,
  () => 'Batarya kapasitesi günlük kullanım için fazlasıyla yeterli',
  () => 'Ekran kalitesi ve yenileme hızı bu fiyat aralığında rakipsiz',
  () => 'Kamera sistemi hem gündüz hem gece çekimlerinde üst düzey sonuç veriyor',
  () => 'Marka servis ağı Türkiye genelinde yaygın, garanti süreci sorunsuz',
  (b: string) => `${b} ekosistemi diğer cihazlarınızla kusursuz uyum sağlıyor`,
  () => 'Hafif ve kompakt tasarım taşıma konforunu artırıyor',
  () => 'Hızlı şarj teknolojisi sayesinde kısa sürede tam kapasiteye ulaşıyor',
  () => 'Depolama kapasitesi fotoğraf, video ve uygulama için geniş alan sağlıyor',
];

const TECH_DISADVANTAGES = [
  (budget: string) => `Bütçenizin ${budget} üst sınırına yakın, fazla bütçe kalmıyor`,
  () => 'Aksesuar ve şarj aleti ayrı satın alınması gerekiyor',
  () => 'Bu fiyat aralığında depolama genişletme seçeneği bulunmuyor',
  () => 'Isı yönetimi yoğun kullanımlarda bazen sorun çıkarabiliyor',
  () => 'Kılıf ve ekran koruyucu seçenekleri diğer markalar kadar çeşitli değil',
  () => 'Kutu içeriği son yıllarda oldukça kısıtlandı',
  () => 'Parça değişim maliyeti yetkili servislerde yüksek kalabiliyor',
];

const TECH_ALTERNATIVES = [
  { name: 'Üst Model', scoreOffset: +3, descFn: () => 'Daha yüksek özellikler, biraz daha yüksek fiyat' },
  { name: 'Alt Model', scoreOffset: -6, descFn: () => 'Bütçeyi %15 daha aşağı çekiyor, temel ihtiyaçları karşılıyor' },
  { name: 'Rakip Marka A', scoreOffset: -4, descFn: () => 'Farklı ekosistem, benzer fiyat segmentinde güçlü rakip' },
  { name: 'Rakip Marka B', scoreOffset: -8, descFn: () => 'Fiyat/performans odaklı, bütçede en geniş özellikleri sunuyor' },
  { name: 'Geçen Yılın Amiral Gemisi', scoreOffset: -5, descFn: () => 'İndirimli fiyatla hâlâ güçlü, bir model eski ama kanıtlanmış' },
];

// ── Vehicle template ──────────────────────────────────────────────────────────

const VEHICLE_ADVANTAGES = [
  () => 'Yakıt tüketimi bu segment içinde en ekonomik seçenekler arasında',
  () => 'Fabrika garantisi ve servis ağı uzun vadede bakım maliyetini azaltıyor',
  () => 'Yeniden satış değeri benzer segmentte en yüksek tutarlılığa sahip',
  () => 'Güvenlik donanımı standart olarak kapsamlı; NCAP puanı yüksek',
  () => 'Günlük şehir kullanımı ve uzun yol için dengeli bir sürüş konforu',
  () => 'Bagaj hacmi ve iç mekan kullanımı ailenin ihtiyaçlarını karşılıyor',
  () => 'Türkiye\'de yaygın yedek parça ağı, bakım kolaylığı sağlıyor',
];

const VEHICLE_DISADVANTAGES = [
  () => 'İlk alış fiyatı segment ortalamasının biraz üzerinde',
  () => 'Bazı güvenlik özellikleri yalnızca üst paketlerde geliyor',
  () => 'Şehir içi trafik yoğunluğunda yakıt tüketimi beklentinin üzerine çıkabiliyor',
  () => 'Kabin ses yalıtımı uzun yol konforunda gelişime açık',
  () => 'Arka koltuk baş boşluğu uzun boylu yolcular için sınırlı kalabiliyor',
];

// ── Travel template ───────────────────────────────────────────────────────────

const TRAVEL_ADVANTAGES = [
  (loc: string) => `${loc} yılın bu döneminde en ideal hava ve kalabalık dengesini sunuyor`,
  () => 'Doğrudan uçuş seçenekleri erken rezervasyonla bütçe dostu',
  () => 'Konaklama çeşitliliği her bütçeye uygun otel ve butik seçenekler barındırıyor',
  () => 'Güvenlik endeksi turistler için yüksek, seyahat stresini düşürüyor',
  (loc: string) => `${loc} kültürel ve gastronomi deneyimi başlı başına bir değer katıyor`,
  () => 'Vize süreci görece kolay, önceden planlama yapılabilir',
];

const TRAVEL_DISADVANTAGES = [
  () => 'Yüksek sezon fiyatları uçak + otel maliyetini ciddi artırıyor',
  () => 'Dil bariyeri seyahat deneyimini zorlaştırabilir',
  () => 'Turistik bölgelerde kalabalık ve kuyruklar bekleyişi uzatıyor',
  () => 'Hava durumu bu dönemde değişken olabilir, plan esnekliği gerekiyor',
];

// ── Finance template ──────────────────────────────────────────────────────────

const FINANCE_ADVANTAGES = [
  () => 'Türkiye\'deki enflasyon ortamında reel değer koruması sağlıyor',
  () => 'Likidite yüksek, gerektiğinde hızlı çıkış imkânı var',
  () => 'Uzun vadede bileşik getiri etkisiyle sermaye büyümesi güçlü',
  () => 'Portföy çeşitlendirmesi için uygun, tek varlığa bağımlılığı azaltıyor',
  () => 'Küresel talep trendleri bu enstrümanı orta vadede destekliyor',
];

const FINANCE_DISADVANTAGES = [
  () => 'Kısa vadede volatilite yüksek, psikolojik baskı yaratabilir',
  () => 'Kur riski ve küresel faiz hareketleri getiriyi olumsuz etkileyebilir',
  () => 'Vergi ve komisyon maliyetleri net getiriyi azaltıyor',
  () => 'Piyasa zamanlaması hatalı yapılırsa kayıp riski var',
];

// ── Career template ───────────────────────────────────────────────────────────

const CAREER_ADVANTAGES = [
  () => 'Piyasa koşulları bu alanda uzmanlaşmış profillere olan talebi artırıyor',
  () => 'Uzun vadeli kariyer sermayesi ve ağ genişlemesi sağlıyor',
  () => 'Sektörün büyüme eğrisi önümüzdeki 5 yıl için olumlu görünüyor',
  () => 'Maaş beklentileri mevcut seviyenin belirgin üzerinde olabilir',
  () => 'Uzaktan çalışma fırsatları global fırsatlara kapı aralıyor',
];

const CAREER_DISADVANTAGES = [
  () => 'Geçiş süreci 3-6 ay belirsizlik dönemi gerektirebilir',
  () => 'Yeni beceri edinimi zaman ve maliyet gerektiriyor',
  () => 'Mevcut birikimler ve bağlantıların bir kısmı geride kalabilir',
  () => 'Yeni ortamda başlangıç öğrenme eğrisi verimi düşürebilir',
];

// ── Real Estate template ──────────────────────────────────────────────────────

const REALESTATE_ADVANTAGES = [
  () => 'Enflasyona karşı güçlü bir değer koruma aracı olarak öne çıkıyor',
  () => 'Kira getirisi portföye pasif gelir katıyor',
  () => 'Konum değer artış potansiyeli uzun vadede yüksek',
  () => 'Bankalar bu segment için uygun koşullu konut kredisi sunuyor',
];

const REALESTATE_DISADVANTAGES = [
  () => 'Tapu harcı, KDV ve noter masrafları toplam maliyeti %5-8 artırıyor',
  () => 'Likit olmayan varlık, ani nakit ihtiyacında satış süreci zaman alıyor',
  () => 'Yönetim ve bakım giderleri kira getirisini eritebiliyor',
  () => 'Piyasa dalgalanmalarında kısa vadeli değer kaybı yaşanabilir',
];

// ── General template ──────────────────────────────────────────────────────────

const GENERAL_ADVANTAGES = [
  () => 'Seçeneğin uzun vadeli faydaları kısa vadeli maliyeti aşıyor',
  () => 'Bu kararın geri dönüşü makul bir süre içinde mümkün',
  () => 'Riskleri kontrol altına alabileceğiniz somut adımlar mevcut',
  () => 'Benzer kararları veren kişilerin memnuniyet oranı yüksek',
];

const GENERAL_DISADVANTAGES = [
  () => 'Alternatifleri değerlendirmek ek araştırma süreci gerektiriyor',
  () => 'Karar verirken eksik bilgi, sürprizlere yol açabilir',
  () => 'Beklentilerin gerçekçi tutulması önemli',
];

// ─── Master template dispatcher ───────────────────────────────────────────────

function generateReport(intent: ParsedIntent): AnalysisResult {
  const { category, rawQuestion, budgetTL, mentionedBrands } = intent;
  const seed = rawQuestion;

  const primaryBrand = mentionedBrands[0] ?? 'Seçilen ürün';
  const budgetStr = budgetTL
    ? budgetTL >= 1000
      ? `${(budgetTL / 1000).toLocaleString('tr-TR')} bin TL`
      : `${budgetTL.toLocaleString('tr-TR')} TL`
    : 'belirlenen bütçe';

  const location = intent.mentionedLocations[0] ?? 'seçilen destinasyon';

  // Score: base by category confidence, tweaked by budget and specificity
  const baseScore = stableRandom(seed, 68, 89);
  const hasBudget = budgetTL !== null ? 3 : 0;
  const hasBrand = mentionedBrands.length > 0 ? 4 : 0;
  const questionLength = Math.min(Math.floor(rawQuestion.length / 20), 5);
  const score = Math.min(97, baseScore + hasBudget + hasBrand + questionLength);

  // Confidence: how much info was provided
  const confBase = stableRandom(seed + 'conf', 72, 94);
  const confBonus = hasBudget + hasBrand * 2 + (intent.hasComparison ? 3 : 0);
  const confidenceLevel = Math.min(97, confBase + confBonus);

  // Pick advantages / disadvantages based on category
  type AdvFn = ((arg: string) => string) | (() => string);

  let advPool: AdvFn[];
  let disPool: AdvFn[];

  switch (category) {
    case 'teknoloji':
      advPool = TECH_ADVANTAGES.map((fn) => () => fn(primaryBrand));
      disPool = TECH_DISADVANTAGES.map((fn) => () => fn(budgetStr));
      break;
    case 'arac':
      advPool = VEHICLE_ADVANTAGES;
      disPool = VEHICLE_DISADVANTAGES;
      break;
    case 'seyahat':
      advPool = TRAVEL_ADVANTAGES.map((fn) => () => fn(location));
      disPool = TRAVEL_DISADVANTAGES;
      break;
    case 'finans':
      advPool = FINANCE_ADVANTAGES;
      disPool = FINANCE_DISADVANTAGES;
      break;
    case 'kariyer':
      advPool = CAREER_ADVANTAGES;
      disPool = CAREER_DISADVANTAGES;
      break;
    case 'emlak':
      advPool = REALESTATE_ADVANTAGES;
      disPool = REALESTATE_DISADVANTAGES;
      break;
    default:
      advPool = GENERAL_ADVANTAGES;
      disPool = GENERAL_DISADVANTAGES;
  }

  const advantages = pickN(advPool, Math.min(4, advPool.length), seed).map((fn) => fn(''));
  const disadvantages = pickN(disPool, Math.min(3, disPool.length), seed + 'dis').map((fn) => fn(''));

  // Recommendation sentence
  const recommendation = buildRecommendation(intent, score);

  // Alternatives
  const alternatives = buildAlternatives(intent, score, seed);

  // Reasoning
  const reasoning = buildReasoning(intent, score, confidenceLevel, budgetStr);

  return {
    score,
    confidenceLevel,
    recommendation,
    advantages,
    disadvantages,
    alternatives,
    reasoning,
  };
}

// ─── Recommendation builder ───────────────────────────────────────────────────

function buildRecommendation(intent: ParsedIntent, score: number): string {
  const { category, rawQuestion, mentionedBrands, budgetTL } = intent;
  const budgetStr = budgetTL
    ? ` ${(budgetTL / 1000 >= 1 ? (budgetTL / 1000).toLocaleString('tr-TR') + ' bin' : budgetTL.toLocaleString('tr-TR'))} TL bütçeniz için`
    : '';

  if (category === 'teknoloji') {
    if (mentionedBrands.length >= 2) {
      return `${mentionedBrands[0]},${budgetStr} değer-performans dengesinde öne çıkıyor`;
    }
    if (mentionedBrands.length === 1) {
      return `${mentionedBrands[0]}${budgetStr} ihtiyaçlarınıza en uygun seçenek`;
    }
    return `${budgetStr || 'Mevcut bütçeniz için'} en iyi teknolojiyi sunan modeli tercih edin`;
  }

  if (category === 'arac') {
    if (mentionedBrands.length >= 1) {
      return `${mentionedBrands[0]}${budgetStr} güvenilirlik ve uzun vadeli değer açısından öne çıkıyor`;
    }
    return `${budgetStr || 'Araç seçiminizde'} hybrid veya yakıt verimli model uzun vadede avantajlı`;
  }

  if (category === 'seyahat') {
    const dest = intent.mentionedLocations[0];
    if (dest) return `${dest} bu koşullar ve bütçe için ideal destinasyon`;
    return 'Planlı ve erken rezervasyonla hedeflediğiniz seyahati gerçekleştirin';
  }

  if (category === 'finans') {
    return `${budgetStr || 'Birikiminiz için'} çeşitlendirilmiş bir portföy stratejisi öneriliyor`;
  }

  if (category === 'kariyer') {
    return 'Bu kariyer adımını planlı ve hazırlıklı biçimde atmak uzun vadede karlı';
  }

  if (category === 'emlak') {
    return `${budgetStr || 'Bu bütçeyle'} konum ve yeni yapı kalitesini öncelikli kriterler olarak değerlendirin`;
  }

  // Generic
  const subjectHint = rawQuestion.split(' ').slice(0, 6).join(' ');
  return score >= 80
    ? `"${subjectHint}…" sorunuzda koşullar olumlu, ilerleyin`
    : `"${subjectHint}…" konusunda dikkatli bir değerlendirme yaparak karar verin`;
}

// ─── Alternatives builder ─────────────────────────────────────────────────────

function buildAlternatives(
  intent: ParsedIntent,
  baseScore: number,
  seed: string
): AnalysisResult['alternatives'] {
  const { category, mentionedBrands } = intent;

  const byCategory: Record<Category, AnalysisResult['alternatives']> = {
    teknoloji: [
      {
        name: mentionedBrands[1] ?? 'Üst Segment Modeli',
        description: 'Bir üst özellik bandı, %10-15 daha yüksek fiyat',
        score: Math.min(99, baseScore + stableRandom(seed + 'a1', 2, 6)),
      },
      {
        name: mentionedBrands[2] ?? 'Rakip Marka Amiral Gemisi',
        description: 'Farklı ekosistem, benzer fiyat aralığında güçlü alternatif',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 3, 9)),
      },
      {
        name: 'Geçen Sezon Modeli',
        description: 'İndirimde, %20 daha uygun — temel özelliklerde yeterli',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 5, 12)),
      },
    ],
    arac: [
      {
        name: mentionedBrands[1] ?? 'Japon Rakip Model',
        description: 'Benzer yakıt verimliliği, farklı iç mekan tasarımı',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 2, 7)),
      },
      {
        name: mentionedBrands[2] ?? 'Avrupa Rakibi',
        description: 'Sürüş dinamikleri üstün, bakım maliyeti biraz yüksek',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 4, 10)),
      },
      {
        name: 'İkinci El Üst Model',
        description: 'Bütçeyi %20 genişletirse premium segmente kapı açıyor',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 6, 13)),
      },
    ],
    seyahat: [
      {
        name: intent.mentionedLocations[1] ?? 'Alternatif Destinasyon A',
        description: 'Daha kısa uçuş süresi, benzer deneyim profili',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 3, 8)),
      },
      {
        name: intent.mentionedLocations[2] ?? 'Yakın Destinasyon',
        description: 'Bütçe dostu, kültürel zenginlik açısından rekabetçi',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 5, 12)),
      },
      {
        name: 'Yurt İçi Alternatif',
        description: 'Pasaport ve vize gerektirmiyor, ulaşım kolay',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 7, 15)),
      },
    ],
    finans: [
      {
        name: 'Altın / Döviz',
        description: 'Enflasyona karşı klasik güvenli liman',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 2, 8)),
      },
      {
        name: 'Devlet Tahvili / EUROBOND',
        description: 'Düşük risk, sabit getiri, likit yapı',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 5, 12)),
      },
      {
        name: 'Yatırım Fonu (Karma)',
        description: 'Profesyonel yönetim, düşük giriş eşiği',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 4, 10)),
      },
    ],
    kariyer: [
      {
        name: 'Mevcut Şirkette Terfi Talebi',
        description: 'Güvenli, hızlı kazanım — müzakere gerekiyor',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 3, 8)),
      },
      {
        name: 'Freelance / Danışmanlık',
        description: 'Esneklik yüksek, gelir değişken — geçiş dönemi gerekiyor',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 6, 13)),
      },
      {
        name: 'Yurt Dışı Fırsat',
        description: 'Yüksek potansiyel, lojistik ve uyum süreci zorlayıcı',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 4, 10)),
      },
    ],
    emlak: [
      {
        name: 'Komşu Mahalle / İlçe',
        description: 'Daha uygun fiyat, benzer ulaşım imkânı',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 3, 8)),
      },
      {
        name: 'Kiralık Tutmak',
        description: 'Esneklik sağlar, sermayeyi başka yatırımlara yönlendirir',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 5, 12)),
      },
      {
        name: 'Daha Küçük / Daha Yeni Bina',
        description: 'Bütçe içinde kalarak deprem güvenliği ve enerji verimliliği',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 4, 9)),
      },
    ],
    saglik: [
      {
        name: 'Alternatif Tedavi Yöntemi',
        description: 'Daha az invaziv, iyileşme süreci daha kısa',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 4, 9)),
      },
      {
        name: 'İkinci Uzman Görüşü',
        description: 'Farklı yaklaşım, mevcut planı doğrulama fırsatı',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 2, 6)),
      },
      {
        name: 'Koruyucu / Önleyici Yaklaşım',
        description: 'Uzun vadeli sağlık yatırımı, düşük maliyet',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 6, 12)),
      },
    ],
    egitim: [
      {
        name: 'Online Sertifika Programı',
        description: 'Esneklik yüksek, maliyet düşük, hızlı sonuç',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 4, 9)),
      },
      {
        name: 'Yurt Dışı Üniversite',
        description: 'Küresel ağ, diplomanın uluslararası geçerliliği',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 3, 8)),
      },
      {
        name: 'Çalışırken Uzaktan Eğitim',
        description: 'Geliri kesmeden kariyer geliştirme imkânı',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 5, 11)),
      },
    ],
    yiyecek: [
      {
        name: 'Alternatif Restoran / Kafe',
        description: 'Benzer mutfak, farklı atmosfer ve fiyat aralığı',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 3, 8)),
      },
      {
        name: 'Evde Hazırla',
        description: 'Daha ekonomik, malzeme kontrolü sizde',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 6, 12)),
      },
      {
        name: 'Farklı Mutfak Seçeneği',
        description: 'Deneyimi genişletir, yeni tatlar keşfettiriyor',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 5, 10)),
      },
    ],
    genel: [
      {
        name: 'Plan A — Hızlı Hareket',
        description: 'Fırsatı hemen değerlendir, risk alarak ilerle',
        score: Math.max(50, baseScore - stableRandom(seed + 'a1', 3, 8)),
      },
      {
        name: 'Plan B — Bekle ve Gözlemle',
        description: 'Daha fazla veri topla, daha bilinçli karar ver',
        score: Math.max(50, baseScore - stableRandom(seed + 'a2', 5, 12)),
      },
      {
        name: 'Plan C — Karma Yaklaşım',
        description: 'İkisinin ortasında dengeli strateji',
        score: Math.max(50, baseScore - stableRandom(seed + 'a3', 4, 9)),
      },
    ],
  };

  return (byCategory[category] ?? byCategory.genel).slice(0, 3);
}

// ─── Reasoning builder ────────────────────────────────────────────────────────

const REASONING_TEMPLATES: Record<Category, (intent: ParsedIntent, score: number, conf: number, budget: string) => string> = {
  teknoloji: (intent, score, conf, budget) => {
    const brand = intent.mentionedBrands[0] ?? 'bu model';
    return `${budget} bütçeniz ve belirttiğiniz ihtiyaçlar değerlendirildiğinde ${brand}, ${score} Atlas Skoru ile en iyi değer-performans dengesini sunmaktadır. İşlemci gücü, ekran kalitesi ve yazılım desteği bu seçimi ${conf >= 85 ? 'güçlü' : 'makul'} bir öneri haline getiriyor. Uzun vadede marka ekosistemi ve güncellemeler yatırımın karşılığını veriyor.`;
  },
  arac: (intent, score, conf, budget) => {
    const brand = intent.mentionedBrands[0] ?? 'bu araç';
    return `${budget} bütçe çerçevesinde ${brand}, yakıt ekonomisi, güvenilirlik ve yeniden satış değeri açısından ${score} Atlas Skoru ile öne çıkıyor. Türkiye'deki servis ağı ve yedek parça ulaşılabilirliği uzun vadeli sahiplik maliyetini düşürüyor. ${conf >= 88 ? 'Yüksek güven skoru' : 'Veriler'}, bu kararın doğru yönde olduğunu gösteriyor.`;
  },
  seyahat: (intent, _score, conf, budget) => {
    const dest = intent.mentionedLocations[0] ?? 'hedef destinasyon';
    return `${budget ? budget + ' bütçe ile ' : ''}${dest} bu dönem için ${conf >= 85 ? 'güçlü' : 'uygun'} bir seçim. Erken rezervasyon yapıldığında uçak + konaklama maliyeti optimize edilebiliyor. Alternatif destinasyonlarla kıyaslandığında deneyim/maliyet dengesi en yüksek bu seçenekte görünüyor.`;
  },
  finans: (intent, score, _conf, budget) => {
    return `${budget} birikimin değerlendirilmesinde ${score} Atlas Skoru ile önerilen strateji, Türkiye'nin mevcut ekonomik koşulları ve enflasyon ortamı gözetilerek oluşturulmuştur. Çeşitlendirme her zaman tek bir enstrümana bağımlılığı azaltır. Piyasa zamanlamasından önce risk toleransınızı netleştirmeniz uzun vadeli getiriyi korur.`;
  },
  kariyer: (intent, score, conf, _budget) => {
    return `Bu kariyer kararı ${score} Atlas Skoru ile değerlendirildiğinde piyasa koşulları ve talep trendi olumlu görünüyor. ${conf >= 85 ? 'Güven skoru yüksek' : 'Belirtilen ipuçlarına göre'}, doğru hazırlık ve zamanlama ile adımın getirisini maksimize etmek mümkün. Kısa vadeli belirsizliği azaltmak için somut aksiyon planı oluşturmanız kritik önem taşıyor.`;
  },
  emlak: (intent, score, conf, budget) => {
    return `${budget} hedef bütçe ile gayrimenkul kararı ${score} Atlas Skoru aldı. ${conf >= 85 ? 'Yüksek güvenle' : 'Mevcut verilerle'} değerlendirildiğinde konum seçimi ve bina yaşı, yatırımın uzun vadeli getirisini belirleyecek en kritik iki faktör. Enflasyon ortamında gayrimenkul güçlü bir değer koruma aracı; ancak likidite düşüklüğü göz önünde bulundurulmalı.`;
  },
  saglik: (intent, score, _conf, _budget) => {
    return `Sağlık kararlarında Atlas ${score} Skoru bilgilendirici nitelikte; kesin karar her zaman uzman hekime aittir. Belirtilen kriterler doğrultusunda önerilen yaklaşım, güncel tıp verilerine ve yaygın uygulamaya uygundur. İkinci uzman görüşü almak her zaman değerli bir adım.`;
  },
  egitim: (intent, score, conf, budget) => {
    return `${budget ? budget + ' eğitim bütçesi ile' : 'Kariyer hedefleriniz doğrultusunda'} bu eğitim kararı ${score} Atlas Skoru aldı. ${conf >= 85 ? 'Yüksek güven seviyesi' : 'Veriler'}, piyasa talebinin bu alana uyumlu olduğunu gösteriyor. Uzun vadede diplomanın veya sertifikanın getireceği kariyer ve maaş artışı, eğitim yatırımının karşılığını veriyor.`;
  },
  yiyecek: (intent, score, _conf, _budget) => {
    return `${score} Atlas Skoru ile değerlendirilen bu tercih, belirtilen kriterler açısından tatmin edici bir deneyim sunuyor. Kalite-fiyat dengesi ve atmosfer önceliklerinizle örtüşüyor. Farklı seçenekleri denemek deneyim çeşitliliği katıyor.`;
  },
  genel: (intent, score, conf, _budget) => {
    return `Sorunuz ${score} Atlas Skoru ve %${conf} güven seviyesiyle analiz edildi. Mevcut koşullar ve belirtilen kriterler gözetildiğinde önerilen yol haritası en dengeli strateji olarak öne çıkıyor. Alternatifleri göz önünde bulundurarak nihai kararı verirken ek bilgi toplama sürecini kısaltmaya çalışın.`;
  },
};

function buildReasoning(intent: ParsedIntent, score: number, conf: number, budgetStr: string): string {
  const fn = REASONING_TEMPLATES[intent.category] ?? REASONING_TEMPLATES.genel;
  return fn(intent, score, conf, budgetStr);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function analyzeDecision(question: string): Promise<AnalysisResult> {
  // Simulated processing delay — remove this line when connecting a real LLM
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // TODO: Replace the lines below with an OpenAI (or other LLM) API call.
  // The AnalysisResult interface above is designed to match what the LLM returns.
  // See the drop-in replacement template at the top of this file.
  const intent = parseIntent(question);
  return generateReport(intent);
}
