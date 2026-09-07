import type { ProductResult, ResearchStatus, WebSource } from "./chat-types.js";
import { normalizeProductCandidates, type ProductCandidate } from "./product-normalizer.js";
import { verifyProductPrice } from "./price-verifier.js";
import { searchWeb } from "../services/web-search.js";

export const ATLAS_MERCHANTS = [
  "trendyol.com", "hepsiburada.com", "n11.com", "amazon.com.tr", "pazarama.com",
  "mediamarkt.com.tr", "vatanbilgisayar.com", "teknosa.com", "pttavm.com", "koctas.com.tr",
  "boyner.com.tr", "lcw.com", "gratis.com", "watsons.com.tr", "decathlon.com.tr",
  "migros.com.tr", "carrefoursa.com", "a101.com.tr", "bim.com.tr", "sokmarket.com.tr",
  "file.com.tr", "hakmar.com.tr", "tarimkredi.com.tr", "onurmarket.com.tr",
];

export interface MerchantNetworkResult {
  products: ProductResult[];
  sources: WebSource[];
  research: ResearchStatus;
  merchantsQueried: string[];
}

export async function searchMerchantNetwork(query: string, category?: string, excludedBrands: string[] = []): Promise<MerchantNetworkResult> {
  const results = await Promise.allSettled(ATLAS_MERCHANTS.map((merchant) => searchWeb(`${query} site:${merchant}`, undefined, fetch, { includeDomains: [merchant], searchDepth: "advanced" })));
  const sources = [...new Map(results.flatMap((r) => r.status === "fulfilled" ? r.value.sources : []).map((s) => [s.url, s])).values()];
  const candidates = results.flatMap((r) => r.status === "fulfilled" ? normalizeProductCandidates(r.value.sources, undefined, []).filter((p) => {
    if (category && p.title.toLowerCase().includes(category.toLowerCase()) === false) return true;
    return !excludedBrands.some((brand) => p.title.toLowerCase().includes(brand.toLowerCase()));
  }) : []) as ProductCandidate[];
  const products = (await Promise.all(candidates.map((candidate) => verifyProductPrice(candidate)))).filter((item): item is ProductResult => Boolean(item));
  const completed = results.some((r) => r.status === "fulfilled" && r.value.research.status === "completed");
  return {
    products: [...new Map(products.map((p) => [p.url, p])).values()],
    sources,
    research: completed ? { requested: true, status: "completed", provider: "merchant-network", retrievedAt: new Date().toISOString() } : { requested: true, status: "failed", provider: "merchant-network", error: "Mağaza ağı sonuç döndürmedi." },
    merchantsQueried: ATLAS_MERCHANTS,
  };
}
