import type { ProductResult, ResearchStatus, WebSource } from "./chat-types.js";
import { normalizeProductResults } from "./product-normalizer.js";
import { searchWeb, type WebSearchOptions, type WebSearchResult } from "../services/web-search.js";

const TARGET_PRODUCT_COUNT = 2;
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

export interface ProductSearchResult {
  sources: WebSource[];
  products: ProductResult[];
  research: ResearchStatus;
}

function mergeSources(primary: WebSource[], backfill: WebSource[]): WebSource[] {
  return [...new Map([...primary, ...backfill].map((source) => [source.url, source])).values()];
}

export async function searchProducts(
  query: string,
  backfillQuery: string | undefined,
  searcher: Searcher = (searchQuery, options) => searchWeb(searchQuery, undefined, fetch, options),
): Promise<ProductSearchResult> {
  const primary = await searcher(query, { excludeDomains: NON_LISTING_DOMAINS });
  let sources = primary.sources;
  let products = normalizeProductResults(sources);

  if (primary.research.status === "completed" && products.length < TARGET_PRODUCT_COUNT && backfillQuery) {
    const backfill = await searcher(backfillQuery, { includeDomains: TURKISH_MERCHANT_DOMAINS });
    if (backfill.research.status === "completed") {
      sources = mergeSources(sources, backfill.sources);
      products = normalizeProductResults(sources);
    }
  }

  return { sources, products, research: primary.research };
}