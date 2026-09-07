import type { ProductResult, ResearchStatus, WebSource } from "./chat-types.js";
import { normalizeProductCandidates, type ProductCandidate } from "./product-normalizer.js";
import { verifyProductPrice } from "./price-verifier.js";
import { searchWeb } from "../services/web-search.js";

/** Atlas'ın fiyat karşılaştırmasında taradığı satış kanalları. */
export const ATLAS_MERCHANTS = [
  // Pazaryerleri
  "trendyol.com", "hepsiburada.com", "n11.com", "amazon.com.tr", "pazarama.com", "pttavm.com",
  // Elektronik / genel perakende
  "mediamarkt.com.tr", "vatanbilgisayar.com", "teknosa.com", "koctas.com.tr", "boyner.com.tr",
  "lcw.com", "gratis.com", "watsons.com.tr", "decathlon.com.tr",
  // Desteklenen zincir marketler
  "migros.com.tr", "carrefoursa.com", "a101.com.tr", "bim.com.tr", "sokmarket.com.tr",
  "file.com.tr", "hakmar.com.tr", "onurmarket.com", "tkkoop.com.tr",
] as const;

export interface MerchantNetworkResult {
  products: ProductResult[];
  sources: WebSource[];
  research: ResearchStatus;
  merchantsQueried: string[];
}

function dedupeProducts(products: ProductResult[]): ProductResult[] {
  return [...new Map(products.map((product) => [product.url, product])).values()]
    .sort((a, b) => {
      // Fiyatı doğrulanmış ve aynı ürüne daha güçlü eşleşen sonuçları öne al.
      const verificationRank = (value: ProductResult["priceVerification"]) => value === "merchant_page" ? 0 : 1;
      return verificationRank(a.priceVerification) - verificationRank(b.priceVerification)
        || a.priceTRY - b.priceTRY;
    });
}

/**
 * "En uygun / en ucuz" gibi isteklerde bütün desteklenen satış kanallarını
 * aynı sorguyla tarar. Basic arama kullanılır; böylece 20+ mağaza taraması
 * Tavily kotasını gereksiz yere tüketmez.
 */
export async function searchMerchantNetwork(
  query: string,
  category?: string,
  excludedBrands: string[] = [],
): Promise<MerchantNetworkResult> {
  const results = await Promise.allSettled(
    ATLAS_MERCHANTS.map((merchant) =>
      searchWeb(`${query} site:${merchant}`, undefined, fetch, {
        includeDomains: [merchant],
        searchDepth: "basic",
      }),
    ),
  );

  const sources = [...new Map(
    results
      .flatMap((result) => result.status === "fulfilled" ? result.value.sources : [])
      .map((source) => [source.url, source]),
  ).values()];

  const candidates = results.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    return normalizeProductCandidates(result.value.sources, undefined, []).filter((product) => {
      if (category && product.title.toLowerCase().includes(category.toLowerCase()) === false) return true;
      return !excludedBrands.some((brand) => product.title.toLowerCase().includes(brand.toLowerCase()));
    });
  }) as ProductCandidate[];

  const verified = await Promise.all(candidates.map((candidate) => verifyProductPrice(candidate)));
  const products = verified.filter((item): item is ProductResult => Boolean(item));
  const completed = results.some((result) => result.status === "fulfilled" && result.value.research.status === "completed");

  return {
    products: dedupeProducts(products),
    sources,
    research: completed
      ? { requested: true, status: "completed", provider: "merchant-network", retrievedAt: new Date().toISOString() }
      : { requested: true, status: "failed", provider: "merchant-network", error: "Satış kanallarından sonuç alınamadı." },
    merchantsQueried: [...ATLAS_MERCHANTS],
  };
}
