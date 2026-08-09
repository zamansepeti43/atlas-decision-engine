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
export type AtlasOperation = "respond" | "web_research" | "product_search" | "price_comparison";

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface RequestContext {
  category?: string;
  budgetTRY?: number;
  preferences: string[];
  useCase?: string;
}

export interface RequestPlan {
  intent: AtlasIntent;
  operation: AtlasOperation;
  requiresResearch: boolean;
  query?: string;
  backfillQuery?: string;
  context: RequestContext;
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
  key: "budgetTRY" | "preference" | "useCase";
  value: string | number;
  reason: string;
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
  sources: WebSource[];
  products: RankedProduct[];
  confidence: number;
  memoryCandidates: MemoryCandidate[];
  research: ResearchStatus;
}