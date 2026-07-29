/**
 * Atlas AI — Conversation Engine
 *
 * The intelligence core. Manages:
 *   1. Intent detection (delegates to intent-router)
 *   2. Clarification assessment — decides whether to ask before answering
 *   3. Context extraction — pulls structured facts from user messages
 *   4. Response generation — routes to the right generator with full context
 *
 * ─── OpenAI upgrade path ──────────────────────────────────────────────────────
 * Replace the body of `processUserTurn` with a call to the AI API.
 * The ConversationMessage and CollectedContext interfaces are the stable contract
 * that every UI component depends on — they do not change when you add AI.
 *
 *   export async function processUserTurn(...): Promise<ProcessResult> {
 *     const ctx = existingCtx
 *       ? enrichContext(existingCtx, userMessage)
 *       : buildInitialContext(userMessage, detectIntentSync(userMessage).intent);
 *
 *     const history = buildOpenAIMessages(ctx, memory);
 *     const completion = await openai.chat.completions.create({
 *       model: 'gpt-4o',
 *       response_format: { type: 'json_object' },
 *       messages: [{ role: 'system', content: ATLAS_SYSTEM_PROMPT }, ...history],
 *     });
 *     const parsed = JSON.parse(completion.choices[0].message.content!);
 *     return parsed.needsClarification
 *       ? { type: 'clarification', content: parsed.clarification, context: ctx }
 *       : { type: 'response', data: parsed.response, context: ctx };
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  detectIntentSync,
  processQuery,
  type IntentType,
  type AtlasResponseData,
  type LearningData,
  type PlanningData,
} from './intent-router';
import type { UserMemory } from './memory';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ClarificationQuestion {
  id: string;
  text: string;
  quickAnswers?: string[];
}

export interface ClarificationContent {
  intro: string;
  questions: ClarificationQuestion[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'atlas';
  /** text = plain prose | clarification = question card | rich = full response card */
  type: 'text' | 'clarification' | 'rich';
  content: string;
  richContent?: AtlasResponseData;
  clarificationData?: ClarificationContent;
  timestamp: Date;
}

export interface CollectedContext {
  originalQuestion: string;
  intent: IntentType;
  options: string[];       // specific products/options being compared
  priorities: string[];    // user-stated priorities (camera, battery, value…)
  budget?: string;
  budgetAmount?: number;   // TL
  timeline?: string;
  useCase?: string;
  location?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** Raw text answers given to clarification questions */
  clarificationAnswers: string[];
  /** How many user–Atlas exchanges have occurred */
  round: number;
}

export type ProcessResult =
  | { type: 'clarification'; content: ClarificationContent; context: CollectedContext }
  | { type: 'response'; data: AtlasResponseData; context: CollectedContext };

// ─── Product knowledge base (for real scoring) ────────────────────────────────

interface ProductProfile {
  label: string;
  attributes: Record<string, number>; // 0–10 real-world scores
  priceRange: [number, number];        // TL
  keywords: string[];
}

const PRODUCT_KB: Record<string, ProductProfile> = {
  iphone: {
    label: 'iPhone',
    attributes: { camera: 9.5, performance: 9.5, battery: 7.5, value: 6.5, gaming: 9.0, ecosystem: 9.5, display: 9.0 },
    priceRange: [35000, 120000],
    keywords: ['iphone', 'apple', 'ios'],
  },
  samsung: {
    label: 'Samsung Galaxy',
    attributes: { camera: 9.0, performance: 9.0, battery: 8.5, value: 8.0, gaming: 8.5, ecosystem: 7.5, display: 9.5 },
    priceRange: [8000, 80000],
    keywords: ['samsung', 'galaxy'],
  },
  xiaomi: {
    label: 'Xiaomi',
    attributes: { camera: 7.5, performance: 8.5, battery: 9.0, value: 9.5, gaming: 8.0, ecosystem: 7.0, display: 8.5 },
    priceRange: [5000, 35000],
    keywords: ['xiaomi', 'redmi', 'poco'],
  },
  pixel: {
    label: 'Google Pixel',
    attributes: { camera: 9.5, performance: 9.0, battery: 8.0, value: 7.5, gaming: 8.0, ecosystem: 8.5, display: 8.5 },
    priceRange: [20000, 65000],
    keywords: ['pixel', 'google pixel'],
  },
  macbook: {
    label: 'MacBook',
    attributes: { performance: 9.5, battery: 9.5, display: 9.5, value: 6.5, portability: 9.0, creativity: 9.5, gaming: 4.5 },
    priceRange: [45000, 150000],
    keywords: ['macbook', 'mac', 'macos'],
  },
  dell: {
    label: 'Dell',
    attributes: { performance: 8.5, battery: 7.5, display: 8.0, value: 8.5, portability: 7.5, creativity: 7.5, gaming: 8.5 },
    priceRange: [15000, 80000],
    keywords: ['dell', 'xps', 'inspiron'],
  },
  lenovo: {
    label: 'Lenovo',
    attributes: { performance: 8.5, battery: 8.0, display: 8.0, value: 8.5, portability: 8.0, creativity: 7.5, gaming: 8.5 },
    priceRange: [12000, 70000],
    keywords: ['lenovo', 'thinkpad', 'legion'],
  },
  toyota: {
    label: 'Toyota',
    attributes: { reliability: 9.5, fuel_economy: 8.5, value: 8.5, comfort: 8.0, safety: 9.0, performance: 7.5 },
    priceRange: [800000, 2500000],
    keywords: ['toyota', 'corolla', 'camry', 'rav4'],
  },
  volkswagen: {
    label: 'Volkswagen',
    attributes: { reliability: 8.0, fuel_economy: 8.0, value: 7.5, comfort: 9.0, safety: 9.0, performance: 8.0 },
    priceRange: [900000, 2800000],
    keywords: ['volkswagen', 'vw', 'golf', 'passat', 'tiguan'],
  },
  bmw: {
    label: 'BMW',
    attributes: { reliability: 7.0, fuel_economy: 7.0, value: 6.0, comfort: 9.5, safety: 9.0, performance: 9.5, prestige: 9.5 },
    priceRange: [1500000, 8000000],
    keywords: ['bmw', 'serie'],
  },
  electric: {
    label: 'Elektrikli Araç',
    attributes: { reliability: 8.5, fuel_economy: 9.5, value: 7.5, comfort: 9.0, safety: 9.5, performance: 9.0, environmental: 10 },
    priceRange: [1200000, 5000000],
    keywords: ['elektrikli', 'tesla', 'togg', 'bev'],
  },
  hybrid: {
    label: 'Hybrid Araç',
    attributes: { reliability: 9.0, fuel_economy: 9.0, value: 8.0, comfort: 8.5, safety: 9.0, performance: 8.0, environmental: 8.5 },
    priceRange: [900000, 3000000],
    keywords: ['hybrid', 'hibrit'],
  },
};

const PRIORITY_ATTR_MAP: Record<string, string> = {
  fotoğraf: 'camera', kamera: 'camera', selfie: 'camera', video: 'camera',
  batarya: 'battery', şarj: 'battery', pil: 'battery', dayanıklı: 'battery',
  oyun: 'gaming', gaming: 'gaming',
  performans: 'performance', hızlı: 'performance', hız: 'performance', iş: 'performance',
  ucuz: 'value', ekonomik: 'value', uygun: 'value', fiyat: 'value',
  taşınabilir: 'portability', hafif: 'portability', kompakt: 'portability',
  ekran: 'display', görüntü: 'display',
  yaratıcı: 'creativity', tasarım: 'creativity', grafik: 'creativity',
  güvenlik: 'safety', emniyet: 'safety',
  yakıt: 'fuel_economy', benzin: 'fuel_economy', dizel: 'fuel_economy',
  güvenilir: 'reliability', sağlam: 'reliability',
  konfor: 'comfort', rahat: 'comfort',
  prestij: 'prestige', statü: 'prestige',
  çevre: 'environmental', doğa: 'environmental',
};

const ATTR_LABELS: Record<string, string> = {
  camera: 'Kamera sistemi', performance: 'İşlemci performansı', battery: 'Batarya ömrü',
  value: 'Fiyat/değer oranı', gaming: 'Oyun performansı', display: 'Ekran kalitesi',
  ecosystem: 'Ekosistem uyumu', portability: 'Taşınabilirlik', reliability: 'Güvenilirlik',
  fuel_economy: 'Yakıt ekonomisi', safety: 'Güvenlik', comfort: 'Sürüş konforu',
  creativity: 'Yaratıcı iş performansı', prestige: 'Prestij', environmental: 'Çevre dostu olma',
};

// ─── Context extraction ───────────────────────────────────────────────────────

function extractBudget(text: string): { raw: string; amount: number } | null {
  const m1 = text.match(/(\d[\d.,]*)\s*(bin)?\s*(tl|lira|₺)/i);
  const m2 = text.match(/bütçe[m]?[^0-9]*(\d[\d.,]*)/i);
  const match = m1 ?? m2;
  if (!match) return null;
  const raw = match[1].replace(/\./g, '').replace(',', '.');
  let amount = parseFloat(raw);
  if (isNaN(amount)) return null;
  if (m1?.[2]?.toLowerCase() === 'bin') amount *= 1000;
  return { raw: `${match[1]}${m1?.[2] ? ' bin' : ''} TL`, amount };
}

function extractPriorities(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.keys(PRIORITY_ATTR_MAP).filter((k) => lower.includes(k));
}

function extractOptions(text: string): string[] {
  const found: string[] = [];
  for (const profile of Object.values(PRODUCT_KB)) {
    if (profile.keywords.some((k) => text.toLowerCase().includes(k))) {
      if (!found.includes(profile.label)) found.push(profile.label);
    }
  }
  return found;
}

function detectExperienceLevel(text: string): 'beginner' | 'intermediate' | 'advanced' {
  const lower = text.toLowerCase();
  if (/hiç bilmiyorum|başlangıç|yeni başladım|nedir|ne demek|öğrenmek istiyorum/.test(lower)) return 'beginner';
  if (/optimize|gelişmiş|ileri seviye|profesyonel|uzman/.test(lower)) return 'advanced';
  return 'intermediate';
}

export function buildInitialContext(question: string, intent: IntentType): CollectedContext {
  const budget = extractBudget(question);
  return {
    originalQuestion: question,
    intent,
    options: extractOptions(question),
    priorities: extractPriorities(question),
    ...(budget && { budget: budget.raw, budgetAmount: budget.amount }),
    experienceLevel: detectExperienceLevel(question),
    clarificationAnswers: [],
    round: 0,
  };
}

export function enrichContext(existing: CollectedContext, newAnswer: string): CollectedContext {
  const budget = extractBudget(newAnswer);
  const newPriorities = extractPriorities(newAnswer);
  const newOptions = extractOptions(newAnswer);
  return {
    ...existing,
    ...(budget && !existing.budget && { budget: budget.raw, budgetAmount: budget.amount }),
    priorities: [...new Set([...existing.priorities, ...newPriorities])],
    options: [...new Set([...existing.options, ...newOptions])],
    useCase: existing.useCase ?? (newAnswer.length > 5 ? newAnswer : undefined),
    clarificationAnswers: [...existing.clarificationAnswers, newAnswer],
    round: existing.round + 1,
  };
}

// ─── Clarification builders ───────────────────────────────────────────────────

function buildDecisionClarification(question: string, ctx: CollectedContext): ClarificationContent {
  const lower = question.toLowerCase();
  const isPhone = /telefon|iphone|samsung|xiaomi|android|ios/.test(lower);
  const isLaptop = /laptop|bilgisayar|macbook|notebook|dizüstü/.test(lower);
  const isCar = /araba|araç|otomobil|suv|sedan/.test(lower);
  const isFinance = /yatırım|borsa|hisse|kripto|bitcoin|döviz|altın/.test(lower);
  const questions: ClarificationQuestion[] = [];

  if (isPhone) {
    questions.push({ id: 'use', text: 'Bu telefonu öncelikli olarak ne için kullanacaksınız?', quickAnswers: ['Fotoğraf ve video', 'Oyun', 'İş ve verimlilik', 'Sosyal medya', 'Genel kullanım'] });
    if (!ctx.budget) questions.push({ id: 'budget', text: 'Yaklaşık bütçeniz ne kadar?', quickAnswers: ['10-20 bin TL', '20-35 bin TL', '35-55 bin TL', '55 bin TL üzeri'] });
  } else if (isLaptop) {
    questions.push({ id: 'use', text: 'Bilgisayarı ağırlıklı ne için kullanacaksınız?', quickAnswers: ['Yazılım / Kod', 'Grafik ve video', 'Ofis işleri', 'Oyun', 'Günlük kullanım'] });
    if (!ctx.budget) questions.push({ id: 'budget', text: 'Bütçenizi paylaşabilir misiniz?', quickAnswers: ['15-30 bin TL', '30-50 bin TL', '50-80 bin TL', '80 bin TL üzeri'] });
  } else if (isCar) {
    questions.push({ id: 'priority', text: 'Araçta en önemli faktörünüz hangisi?', quickAnswers: ['Yakıt ekonomisi', 'Güvenilirlik', 'Konfor', 'Performans', 'Fiyat/değer', 'Çevre dostu'] });
    if (!ctx.budget) questions.push({ id: 'budget', text: 'Bütçe aralığınız nedir?' });
  } else if (isFinance) {
    questions.push({ id: 'risk', text: 'Risk toleransınız nasıl?', quickAnswers: ['Çok düşük (koruma)', 'Düşük', 'Orta', 'Yüksek (getiri öncelikli)'] });
    questions.push({ id: 'horizon', text: 'Yatırım vade hedefiniz?', quickAnswers: ['6 ay', '1-2 yıl', '3-5 yıl', '5+ yıl'] });
  } else {
    questions.push({ id: 'priority', text: 'Bu karar için en önemli öncelikleriniz neler?' });
    if (!ctx.budget) questions.push({ id: 'budget', text: 'Bütçe veya kaynak kısıtlamanız var mı?' });
  }

  return { intro: 'Daha doğru bir analiz yapabilmem için birkaç şeyi anlamak istiyorum:', questions };
}

export function assessClarificationNeeds(
  question: string,
  intent: IntentType,
  ctx: CollectedContext,
  memory: UserMemory
): { needed: boolean; content?: ClarificationContent } {
  if (ctx.round > 0) return { needed: false }; // never ask twice

  if (intent === 'decision') {
    const lower = question.toLowerCase();
    const hasPriorities = ctx.priorities.length > 0 || /için|amac|kullan|öncelik|önemli|değer/.test(lower);
    const hasBudgetInfo = !!ctx.budget || !!memory.budget;
    const hasOptions = ctx.options.length >= 2 || /mi yoksa|vs|hangisi|karşılaştır/.test(lower);
    const isDetailed = question.length > 80;

    if (hasPriorities || (hasOptions && hasBudgetInfo) || isDetailed) return { needed: false };
    return { needed: true, content: buildDecisionClarification(question, ctx) };
  }

  if (intent === 'writing') {
    const isVague = question.length < 30 && !/için|kime|mektup|e-posta|rapor|makale/.test(question.toLowerCase());
    return isVague ? {
      needed: true,
      content: {
        intro: 'Bu yazıyı en iyi şekilde hazırlayabilmem için:',
        questions: [
          { id: 'recipient', text: 'Kime veya hangi amaçla yazıyoruz?' },
          { id: 'tone', text: 'Hangi ton uygun?', quickAnswers: ['Resmi', 'Samimi', 'Kısa ve net', 'Detaylı'] },
        ],
      },
    } : { needed: false };
  }

  if (intent === 'planning') {
    const hasTimeline = /hafta|ay|yıl|gün|süre/.test(question.toLowerCase());
    const isDetailed = question.length > 50;
    return (!hasTimeline && !isDetailed) ? {
      needed: true,
      content: {
        intro: 'Gerçekçi bir plan hazırlayabilmem için:',
        questions: [
          { id: 'timeline', text: 'Bu hedefiniz için ne kadar süreniz var?', quickAnswers: ['1 hafta', '1 ay', '3 ay', '6 ay', '1 yıl'] },
          { id: 'experience', text: 'Mevcut deneyim seviyeniz?', quickAnswers: ['Hiç deneyimim yok', 'Temel bilgilerim var', 'Orta seviyedeyim'] },
        ],
      },
    } : { needed: false };
  }

  return { needed: false };
}

// ─── Decision generator (real scoring from knowledge base) ────────────────────

function calculateProductScore(profile: ProductProfile, priorities: string[], budget?: number): number {
  const attrs = profile.attributes;
  let weightedSum = 0;
  let totalWeight = 0;

  const attrKeys = priorities.map((p) => PRIORITY_ATTR_MAP[p.toLowerCase()]).filter(Boolean);

  if (attrKeys.length > 0) {
    for (const attr of attrKeys) {
      weightedSum += (attrs[attr] ?? 7.0) * 2;
      totalWeight += 2;
    }
  }

  const avgAttr = Object.values(attrs).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(attrs).length);
  weightedSum += avgAttr;
  totalWeight += 1;

  let score = weightedSum / totalWeight;

  if (budget && profile.priceRange) {
    const [minP] = profile.priceRange;
    if (budget < minP) score *= 0.72;
    else if (budget >= minP) score *= 1.04;
  }

  return Math.min(96, Math.max(42, Math.round(score * 10)));
}

function generateContextualDecision(ctx: CollectedContext): AtlasResponseData {
  const allText = [ctx.originalQuestion, ...ctx.clarificationAnswers].join(' ');
  const priorities = [...new Set([...ctx.priorities, ...extractPriorities(allText)])];
  const budgetData = ctx.budgetAmount ? { raw: ctx.budget!, amount: ctx.budgetAmount } : extractBudget(allText);

  const matchedKeys = Object.keys(PRODUCT_KB).filter((key) =>
    PRODUCT_KB[key].keywords.some((k) => allText.toLowerCase().includes(k))
  );

  if (matchedKeys.length >= 2) {
    const scored = matchedKeys
      .map((key) => ({
        key,
        profile: PRODUCT_KB[key],
        score: calculateProductScore(PRODUCT_KB[key], priorities, budgetData?.amount),
      }))
      .sort((a, b) => b.score - a.score);

    const winner = scored[0];
    const winnerAttrs = winner.profile.attributes;
    const priorityLabels = priorities.slice(0, 3).join(', ') || 'genel performans';

    const advantages = Object.entries(winnerAttrs)
      .filter(([, v]) => v >= 8.5)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([attr, score]) => `${ATTR_LABELS[attr] ?? attr}: ${score}/10`);

    if (budgetData && winner.profile.priceRange[0] <= budgetData.amount) {
      advantages.push(`${budgetData.raw} bütçenizle erişilebilir`);
    }
    const matchedPriority = priorities.find((p) => {
      const attr = PRIORITY_ATTR_MAP[p.toLowerCase()];
      return attr && (winnerAttrs[attr] ?? 0) >= 8.5;
    });
    if (matchedPriority) advantages.push(`"${matchedPriority}" önceliğinizde sektör lideri`);

    const disadvantages = Object.entries(winnerAttrs)
      .filter(([, v]) => v < 7.5)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 2)
      .map(([attr]) => `${ATTR_LABELS[attr] ?? attr} rakiplerine kıyasla daha zayıf`);

    if (winner.profile.priceRange[0] > 50000) disadvantages.push('Fiyat segmenti yüksek');

    const alternatives = scored.slice(1, 4).map((s) => ({
      name: s.profile.label,
      description: buildAltDesc(s, priorities),
      score: s.score,
    }));

    const runnerUp = scored[1];
    const confidenceLevel = Math.min(94,
      62 + (priorities.length > 0 ? 12 : 0) + (budgetData ? 10 : 0) + (ctx.clarificationAnswers.length > 0 ? 10 : 0)
    );

    const reasoning = buildDecisionReasoning(winner, runnerUp, priorities, budgetData?.raw, priorityLabels, ctx);

    return {
      intent: 'decision',
      data: {
        score: winner.score,
        recommendation: `${winner.profile.label}${priorities.length > 0 ? `, "${priorities[0]}" önceliğiniz` : ''} için en yüksek puanı aldı`,
        advantages: advantages.filter(Boolean).slice(0, 5),
        disadvantages: disadvantages.filter(Boolean).slice(0, 3),
        alternatives,
        reasoning,
        confidenceLevel,
      },
    };
  }

  return generateFallbackDecision(ctx);
}

function buildAltDesc(s: { profile: ProductProfile; score: number }, priorities: string[]): string {
  const topAttr = Object.entries(s.profile.attributes).sort(([, a], [, b]) => b - a)[0];
  return topAttr ? `${ATTR_LABELS[topAttr[0]] ?? topAttr[0]} alanında güçlü (${topAttr[1]}/10)` : 'Dengeli alternatif';
}

function buildDecisionReasoning(
  winner: { profile: ProductProfile; score: number },
  runnerUp: { profile: ProductProfile; score: number } | undefined,
  priorities: string[],
  budget?: string,
  priorityLabels?: string,
  ctx?: CollectedContext
): string {
  const parts: string[] = [];

  if (priorities.length > 0) {
    const topPriority = priorities[0];
    const attr = PRIORITY_ATTR_MAP[topPriority.toLowerCase()];
    const attrScore = attr ? winner.profile.attributes[attr] : undefined;
    parts.push(`"${priorityLabels}" öncelikleriniz göz önüne alındığında ${winner.profile.label} ${attrScore ? `${ATTR_LABELS[attr!]} konusunda ${attrScore}/10 ile ` : ''}öne çıkıyor.`);
  } else {
    parts.push(`${winner.profile.label} genel performans dengesiyle ${winner.score}/100 Atlas Skoru aldı.`);
  }

  if (runnerUp) {
    parts.push(`${runnerUp.profile.label} ${runnerUp.score}/100 ile güçlü bir alternatif — önceliklerinize göre yeniden değerlendirilebilir.`);
  }

  if (budget) parts.push(`${budget} bütçeniz bu seçenek için uygun.`);

  if (ctx?.clarificationAnswers.length) {
    parts.push('Verdiğiniz detaylar hesaplamada kullanıldı; daha fazla bilgi paylaşırsanız güven skoru artar.');
  }

  return parts.join(' ');
}

function generateFallbackDecision(ctx: CollectedContext): AtlasResponseData {
  const allText = [ctx.originalQuestion, ...ctx.clarificationAnswers].join(' ');
  const budget = extractBudget(allText);
  const priorities = ctx.priorities;

  const score = Math.min(88,
    65 + priorities.length * 4 + (budget ? 5 : 0) + Math.min(5, Math.floor(ctx.originalQuestion.length / 30))
  );
  const confidenceLevel = Math.min(85,
    58 + priorities.length * 5 + (budget ? 8 : 0) + ctx.clarificationAnswers.length * 8
  );

  return {
    intent: 'decision',
    data: {
      score,
      recommendation: priorities.length > 0
        ? `"${priorities.slice(0, 2).join(' ve ')}" önceliklerinize göre mevcut seçenek değerlendirilebilir`
        : 'Mevcut bilgilerle karar desteklenebilir — daha fazla detay güveni artırır',
      advantages: [
        priorities[0] ? `"${priorities[0]}" önceliğinizle uyumlu sinyaller mevcut` : 'Karar kapsamı tanımlı',
        budget ? `${budget.raw} bütçe bu karara uygun görünüyor` : 'Bütçe kısıtı belirtilmedi',
        'Koşullar uygun olduğunda ilerlemek için somut adımlar var',
      ].filter(Boolean),
      disadvantages: [
        'Daha spesifik seçenekler belirtilirse karşılaştırma yapılabilir',
        priorities.length === 0 ? 'Öncelikler netleştirilirse skor güvenilirliği artar' : 'Ek araştırma tavsiye edilir',
      ],
      alternatives: [],
      reasoning: `${priorities.length > 0 ? `"${priorities.join(', ')}" öncelikleriniz` : 'Verilen bilgiler'} doğrultusunda Atlas Skoru ${score}/100 hesaplandı. Karşılaştırmak istediğiniz spesifik ürün veya seçeneği belirtirseniz çok daha ayrıntılı bir analiz yapılabilir.`,
      confidenceLevel,
    },
  };
}

// ─── Learning generator (context-aware, level-adaptive) ──────────────────────

function generateContextualLearning(ctx: CollectedContext): AtlasResponseData {
  const level = ctx.experienceLevel ?? detectExperienceLevel(ctx.originalQuestion);
  const data: LearningData = buildLearningContent(ctx.originalQuestion, level);
  return { intent: 'learning', data };
}

const TR_STOPWORDS = new Set([
  'ben', 'benim', 'bana', 'beni', 'biz', 'sizin', 'sen', 'bir', 'bu', 'şu', 'o',
  've', 'veya', 'ya', 'ile', 'için', 'da', 'de', 'mi', 'mı', 'mu', 'mü',
  'ne', 'nasıl', 'neden', 'nerede', 'hangi', 'kaç', 'kadar', 'gibi', 'daha',
  'en', 'çok', 'az', 'hem', 'ama', 'fakat', 'ancak', 'ki', 'ise', 'eğer',
  'çünkü', 'var', 'yok', 'hep', 'hiç', 'peki', 'tamam', 'evet', 'hayır',
  'bence', 'sence', 'belki', 'sadece', 'zaten', 'bile', 'artık', 'yani',
]);

function extractTopic(text: string, maxWords = 4): string {
  const words = text
    .replace(/[?!.,;:'"()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TR_STOPWORDS.has(w.toLowerCase()))
    .slice(0, maxWords);
  return words.join(' ').trim() || text.slice(0, 30);
}

function buildLearningContent(question: string, level: 'beginner' | 'intermediate' | 'advanced'): LearningData {
  const topic = extractTopic(question, 3);
  const cap = topic.charAt(0).toUpperCase() + topic.slice(1);

  const summaries = {
    beginner: `${cap}, doğru adımlarla herkesin öğrenebileceği bir konudur. Sıfırdan başlayanlar için temel kavramları sade ve pratik bir şekilde aktarıyorum.`,
    intermediate: `${cap} konusunda temel bilginiz var. Şimdi kavramları derinleştirip pratik uygulamalara geçme zamanı.`,
    advanced: `${cap} alanında deneyimlisiz. Nüanslara, sistem düşüncesine ve ileri seviye perspektiflere odaklanıyorum.`,
  };

  const kpSets: Record<string, LearningData['keyPoints']> = {
    beginner: [
      { title: 'Temel Kavram', detail: `${cap}'in özünde birkaç temel prensip yatar. Bunları kavramak, geri kalanını çok daha kolay hâle getirir.` },
      { title: 'Neden Öğrenmeli?', detail: `${cap} bilgisi günlük kararlardan kariyer fırsatlarına kadar pek çok alanda somut fark yaratır.` },
      { title: 'İlk Adım', detail: `Mükemmel başlamak gerekmez. ${cap} konusunda düzenli küçük adımlar, kısa sürede güçlü bir temel oluşturur.` },
      { title: 'Sık Yanılgı', detail: `"${cap} çok zor" düşüncesi çoğunlukla yanlış bir başlangıç noktasından kaynaklanır.` },
    ],
    intermediate: [
      { title: 'Derinleşme', detail: `${cap}'de orta seviyeden ileri seviyeye geçiş, "ne yapacağını bilmek"ten "neden çalıştığını anlamak"a geçişle olur.` },
      { title: 'En Sık Atlanan Nokta', detail: `Orta seviyedeki öğrenenlerin gözden kaçırdığı ${cap} detayları, uzun vadede en büyük farkı yaratır.` },
      { title: 'Pratik Uygulama', detail: `${cap} bilgisini gerçek bir projeye uygulamak, soyut kavramları kalıcı hâle getirir.` },
      { title: 'Kaynak Stratejisi', detail: 'Kitap + pratik + topluluk kombinasyonu en hızlı ilerlemeyi sağlar.' },
    ],
    advanced: [
      { title: 'Sistem Perspektifi', detail: `${cap}'i yalnızca teknik değil, daha geniş bir bağlam içinde değerlendirmek uzmanlar arası farkı yaratır.` },
      { title: 'Güncel Trendler', detail: `${cap} hızla gelişiyor. En son araştırmaları ve gelişmeleri takip etmek rekabet avantajıdır.` },
      { title: 'Öğreterek Öğrenmek', detail: `${cap}'i başkasına anlatabilmek, en derin öğrenme biçimidir.` },
      { title: 'Kişisel Stil', detail: `İleri seviyede ${cap}, kişiye özgü bir yaklaşım ve bakış açısı geliştirmekle olgunlaşır.` },
    ],
  };

  return {
    topic: cap,
    summary: summaries[level],
    keyPoints: kpSets[level],
    example: `Örneğin, ${cap} kavramını günlük hayatta en çok ${level === 'beginner' ? 'basit kararlarınızda' : level === 'intermediate' ? 'profesyonel projelerinizde' : 'stratejik düşüncenizde'} karşılaşacaksınız. Somut bir durum düşünün ve bu kavramı oraya uygulayın — anlayış anında netleşir.`,
    nextTopics: [`${cap} uygulamaları`, `${cap} ile ilgili araçlar`, `${cap} ileri seviye`],
  };
}

// ─── Planning generator (context-aware) ──────────────────────────────────────

function generateContextualPlanning(ctx: CollectedContext): AtlasResponseData {
  const allText = [ctx.originalQuestion, ...ctx.clarificationAnswers].join(' ');
  const goal = extractTopic(ctx.originalQuestion, 5);
  const cap = goal.charAt(0).toUpperCase() + goal.slice(1);

  const timelineMatch = allText.match(/(\d+)\s*(hafta|ay|yıl|gün)/i);
  const totalDuration = timelineMatch
    ? `${timelineMatch[1]} ${timelineMatch[2]}`
    : ctx.clarificationAnswers.find((a) => /hafta|ay|yıl|gün/.test(a)) ?? '2-3 Ay';

  const isNovice = /hiç|yeni|başlangıç|bilmiyorum/.test(allText.toLowerCase());

  const planData: PlanningData = {
    goal: cap,
    totalDuration,
    phases: [
      {
        name: 'Hazırlık ve Temel Oluşturma',
        tasks: [
          `${cap} için mevcut durumunuzu değerlendirin`,
          isNovice ? 'Temel kaynak ve rehberlere göz atın' : 'Güçlü ve zayıf yönlerinizi belirleyin',
          'Net, ölçülebilir alt hedefler tanımlayın',
          'Haftaya ayırabileceğiniz zamanı belirleyin',
        ],
        duration: 'İlk 1-2 Hafta',
      },
      {
        name: 'Uygulama ve Momentum',
        tasks: [
          'Küçük günlük adımlarla rutini oturtun',
          'İlk somut çıktıyı erken elde etmeye çalışın',
          'Haftalık ilerleme takibi için basit bir sistem kurun',
          'Zorlukları not alın, çözüm üretin',
        ],
        duration: '2-6 Hafta',
      },
      {
        name: 'Derinleşme ve Optimizasyon',
        tasks: [
          'İlk sonuçları değerlendirin',
          'İşe yaramayanı hızla bırakın, işe yarayana yoğunlaşın',
          'Benzer hedefteki biriyle bağlantı kurun',
          'Hedefi gerekirse daraltın — esneklik kritik',
        ],
        duration: '1-4 Hafta',
      },
      {
        name: 'Pekiştirme ve Sürdürme',
        tasks: [
          'Ne öğrendiğinizi belgeleyin',
          'Başarı kriterlerini değerlendirin',
          'Kazanımı alışkanlığa dönüştürün',
          'Bir sonraki hedefi planlamaya başlayın',
        ],
        duration: 'Son 1-2 Hafta',
      },
    ],
    successTips: [
      isNovice ? 'Her gün 30 dk > Haftada bir kez 3 saat — tutarlılık kazanır' : 'Mevcut becerilerinizi yeni hedefe köprüleyin',
      'İlk iki hafta en zorludur — bu noktayı geçmek kritik',
      'Mükemmeliyetçiliği bırakın; iyi başlangıç mükemmel plandan değerlidir',
      'Hedefinizi başkasına söyleyin — sorumluluk motivasyonu artırır',
    ],
  };

  return { intent: 'planning', data: planData };
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Called for every user message. Returns either a clarification request
 * or a final response, depending on whether enough context exists.
 *
 * @param userMessage              What the user just typed
 * @param existingCtx              Null for brand-new conversations
 * @param isAnsweringClarification True when the user is replying to a clarification card
 * @param memory                   Long-term user context from localStorage
 */
export async function processUserTurn(
  userMessage: string,
  existingCtx: CollectedContext | null,
  isAnsweringClarification: boolean,
  memory: UserMemory
): Promise<ProcessResult> {
  // Build or enrich context
  let ctx: CollectedContext;
  if (!existingCtx) {
    const { intent } = detectIntentSync(userMessage);
    ctx = buildInitialContext(userMessage, intent);
    if (memory.budget && !ctx.budget) ctx.budget = memory.budget;
    if (memory.location && !ctx.location) ctx.location = memory.location;
  } else {
    ctx = isAnsweringClarification
      ? { ...enrichContext(existingCtx, userMessage), round: existingCtx.round }
      : enrichContext(existingCtx, userMessage);
  }

  // Clarification check (only on first turn; never when answering a clarification)
  if (!isAnsweringClarification && ctx.round === 0) {
    const assessment = assessClarificationNeeds(ctx.originalQuestion, ctx.intent, ctx, memory);
    if (assessment.needed && assessment.content) {
      return { type: 'clarification', content: assessment.content, context: ctx };
    }
  }

  // Generate response
  await new Promise((r) => setTimeout(r, DELAY[ctx.intent] ?? 1000));

  let data: AtlasResponseData;
  switch (ctx.intent) {
    case 'decision':      data = generateContextualDecision(ctx); break;
    case 'learning':      data = generateContextualLearning(ctx); break;
    case 'planning':      data = generateContextualPlanning(ctx); break;
    default: {
      const allText = [ctx.originalQuestion, ...ctx.clarificationAnswers].join('\n');
      data = await processQuery(allText);
      break;
    }
  }

  return { type: 'response', data, context: ctx };
}

const DELAY: Partial<Record<IntentType, number>> = {
  conversation: 550, decision: 1600, learning: 1100,
  writing: 1500, research: 1800, planning: 1300, 'problem-solving': 1200,
};
