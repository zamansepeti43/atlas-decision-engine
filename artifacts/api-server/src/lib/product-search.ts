import type { ProductResult, ResearchStatus, WebSource } from "./chat-types.js";
import { detectProductBrand, detectProductIdentifiers, isBrandExcluded, isProductRelevantToCategory, normalizeProductCandidates, normalizeProductResults, type ProductCandidate } from "./product-normalizer.js";
import { verifyProductPrice, type ProductPriceVerifier } from "./price-verifier.js";
import { searchWeb, type WebSearchOptions, type WebSearchResult } from "../services/web-search.js";

const TARGET_PRODUCT_COUNT = 5;
const NON_LISTING_DOMAINS = [
  "youtube.com", "instagram.com", "facebook.com", "tiktok.com", "twitter.com", "x.com",
  "reddit.com", "onedio.com", "technopat.net", "akakce.com", "cimri.com", "epey.com",
];
const TURKISH_MERCHANT_DOMAINS = [
  "trendyol.com", "hepsiburada.com", "n11.com", "amazon.com.tr", "boyner.com.tr", "flo.com.tr",
  "intersport.com.tr", "superstep.com.tr", "sportive.com.tr", "barcin.com", "skechers.com.tr",
  "adidas.com.tr", "nike.com.tr",
];

type Searcher = (query: string, options?: WebSearchOptions) => Promise<WebSearchResult>;
const defaultSearcher: Searcher = (searchQuery, options) => searchWeb(searchQuery, undefined, fetch, options);

export interface ProductSearchResult {
  sources: WebSource[];
  products: ProductResult[];
  research: ResearchStatus;
}

export interface ProductSearchConstraints {
  /** Zorunlu marka (örn. otomobil parçası için "bmw"). */
  brand?: string;
  /** Kaynak metninde bulunması gereken model/üretici tanımlayıcıları. */
  identifiers?: string[];
  /** Sonuçların eşleşmesi gereken ürün kategorisi (örn. "laptop"). */
  category?: string;
  /** Sonuçlardan çıkarılacak markalar (normalize). */
  excludeBrands?: string[];
}

function mergeSources(primary: WebSource[], backfill: WebSource[]): WebSource[] {
  return [...new Map([...primary, ...backfill].map((source) => [source.url, source])).values()];
}

export async function searchProducts(
  query: string,
  backfillQuery: string | undefined,
  searcher: Searcher = defaultSearcher,
  constraints: ProductSearchConstraints = {},
  verifier?: ProductPriceVerifier,
): Promise<ProductSearchResult> {
  const detectedBrand = detectProductBrand(query);
  const requiredBrand = constraints.brand ?? detectedBrand;
  const requiredIdentifiers = constraints.identifiers ?? detectProductIdentifiers(query);
  const applyFilters = <T extends ProductCandidate>(items: T[]) =>
    items.filter(
      (product) => isProductRelevantToCategory(product, constraints.category) && !isBrandExcluded(product, constraints.excludeBrands),
    );
  const primary = await searcher(query, { excludeDomains: NON_LISTING_DOMAINS });
  let sources = primary.sources;
  const supportsPageVerification = verifier !== undefined || searcher === defaultSearcher;
  const normalize = (items: WebSource[]) => supportsPageVerification
    ? normalizeProductCandidates(items, requiredBrand, requiredIdentifiers)
    : normalizeProductResults(items, requiredBrand, requiredIdentifiers);
  let candidates = applyFilters(normalize(sources));

  const pricedCandidateCount = candidates.filter((candidate) => candidate.priceTRY !== undefined).length;
  if (primary.research.status === "completed" && pricedCandidateCount < TARGET_PRODUCT_COUNT && backfillQuery) {
    const backfill = await searcher(backfillQuery, { includeDomains: TURKISH_MERCHANT_DOMAINS });
    if (backfill.research.status === "completed") {
      sources = mergeSources(sources, backfill.sources);
      candidates = applyFilters(normalize(sources));
    }
  }

  const verify: ProductPriceVerifier = verifier ?? (searcher === defaultSearcher
    ? verifyProductPrice
    : async (candidate) => candidate.priceTRY !== undefined && candidate.currency === "TRY" ? candidate as ProductResult : null);
  const products = (await Promise.all(candidates.map(async (candidate) => {
    const verified = await verify(candidate);
    if (verified) return verified;
    return candidate.priceTRY !== undefined && candidate.currency === "TRY"
      ? { ...candidate, priceVerification: "search_snapshot" as const } as ProductResult
      : null;
  })))
    .filter((product): product is ProductResult => product !== null);

  return { sources, products, research: primary.research };
}