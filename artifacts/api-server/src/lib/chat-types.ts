export const ATLAS_INTENTS = [
  "conversation",
  "decision",
  "learning",
  "writing",
  "research",
  "planning",
  "problem-solving",
] as const;

export type AtlasIntent = (typeof ATLAS_INTENTS)[number];

/**
 * Alan (domain), kullanıcının kararının hangi yaşam alanında olduğunu belirtir.
 * Niyet "ne yapılmak istendiğini", alan "hangi bağlamda" yapıldığını söyler.
 */
export const ATLAS_DOMAINS = [
  "teknoloji",
  "otomobil",
  "otomobil-parca",
  "emlak",
  "seyahat",
  "finans",
  "kariyer",
  "egitim",
  "genel",
] as const;

export type AtlasDomain = (typeof ATLAS_DOMAINS)[number];
export type AtlasOperation = "respond" | "web_research" | "product_search" | "price_comparison";

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface RequestContext {
  domain: AtlasDomain;
  category?: string;
  budgetTRY?: number;
  preferences: string[];
  useCase?: string;
   /** Kullanıcının açıkça hariç tuttuğu markalar (normalize, küçük harf). */
  excludedBrands: string[];
  /** Memory özetinden okunan, kullanıcının tercih ettiği markalar (normalize). Boş ise varsayılan davranış. */
  preferredBrands?: string[];
  /** Aynı mesajda açıkça dışlanan markalar ve güven skorları. */
  newExclusions?: BrandExclusion[];
  /** Memory'de bulunup bu mesajda açıkça geri alınan markalar. */
  removedExclusions?: string[];
  /** Marka (BMW, Samsung, Nike...) */
  brand?: string;
  /** Otomobil/ürün modeli (3 Serisi, Galaxy A16...) */
  model?: string;
  /** Otomobil parça adı (fren balatası, filtre...) */
  part?: string;
  /** Emlak: şehir/bölge */
  location?: string;
  /** Emlak: satılık | kiralık */
  propertyIntent?: "satilik" | "kiralik";
  /** Seyahat: destinasyon */
  destination?: string;
  /** Finans: risk toleransı */
  risk?: "dusuk" | "orta" | "yuksek";
  /** Eğitim/kariyer/seyahat için zaman çerçevesi */
  timeline?: string;
}

export interface RequestPlan {
  intent: AtlasIntent;
  operation: AtlasOperation;
  requiresResearch: boolean;
  query?: string;
  backfillQuery?: string;
  context: RequestContext;
}

/** Karar için en kritik eksik bilgi ve bunun araştırmayı engelleyip engellemediği. */
export interface FollowUpNeed {
  question: string;
  /** true ise bu bilgi olmadan araştırma/karar verilemez. */
  blocking: boolean;
}

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  domain: string;
  retrievedAt: string;
}

export interface ProductResult {
  title: string;
  brand?: string;
  model?: string;
  url: string;
  priceTRY: number;
  currency: "TRY";
  seller?: string;
  source: {
    title: string;
    url: string;
    domain: string;
  };
  features: string[];
  availability?: "in_stock" | "out_of_stock";
  retrievedAt: string;
  priceVerification?: "merchant_page" | "search_snapshot";
  priceVerifiedAt?: string;
}

export interface ScoreComponents {
  budgetFit: number;
  preferenceFit: number;
  useCaseFit: number;
  featureFit: number;
  valueScore: number;
}

export interface RankedProduct extends ProductResult {
  score: number;
  scoreComponents: ScoreComponents;
  confidence: number;
  matchedTerms: string[];
}

export interface DecisionResult {
  recommendedProductUrl?: string;
  recommendation?: RankedProduct;
  alternatives: RankedProduct[];
  reasons: string[];
  tradeoffs: string[];
  confidence: number;
  summary: string;
  rankedProducts: RankedProduct[];
}

export interface ComparisonResult {
  criteria: Array<keyof ScoreComponents>;
  products: RankedProduct[];
}

export interface MemoryCandidate {
  key: "budgetTRY" | "preference" | "useCase" | "exclusion" | "preferredBrand" | "decisionCriterion";
  value: string | number;
  reason: string;
  /** Öğrenilen, insan-okunur ifade (yalnızca exclusion için üretilir). */
  learning?: string;
  /** 0–1 arası güven; bu sistemde üst sınır 0.95. 0 = hafızadan kaldırma sinyali. */
  confidence?: number;
  /** Öğrenmenin kapsamı; şimdilik yalnızca "user". */
  scope?: "user";
  /** Bilginin kaynağı; şimdilik yalnızca "explicit_feedback". */
  source?: "explicit_feedback";
}

/** Kullanıcının açıkça dışladığı bir marka ve buna ilişkin güven. */
export interface BrandExclusion {
  brand: string;
  confidence: number;
  phrase: string;
}

export interface ResearchStatus {
  requested: boolean;
  status: "not_requested" | "completed" | "unavailable" | "failed";
  error?: string;
  provider?: "tavily";
  httpStatus?: number;
  retrievedAt?: string;
}

export interface AtlasChatResponse {
  success: true;
  message: string;
  reply: string;
  intent: AtlasIntent;
  domain: AtlasDomain;
  operation: AtlasOperation;
  sources: WebSource[];
  products: RankedProduct[];
  comparison?: ComparisonResult;
  decision?: DecisionResult;
  confidence: number;
  memoryCandidates: MemoryCandidate[];
  memoryUpdated?: boolean;
  followUpQuestion?: string;
  research: ResearchStatus;
  history: ChatHistoryEntry[];
}

export interface AtlasChatErrorResponse {
  success: false;
  error: string;
  message: string;
  intent?: AtlasIntent;
  domain?: AtlasDomain;
  sources: WebSource[];
  products: RankedProduct[];
  confidence: number;
  memoryCandidates: MemoryCandidate[];
  research: ResearchStatus;
}