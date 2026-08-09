import type { DecisionResult, ProductResult, RankedProduct, RequestContext, ScoreComponents } from "./chat-types.js";

function normalizedTerms(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => value.toLocaleLowerCase("tr-TR").split(/[^\p{L}\p{N}]+/u)).filter((value) => value.length > 2))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function rankProducts(products: ProductResult[], context: RequestContext): RankedProduct[] {
  const preferenceTerms = normalizedTerms(context.preferences);
  const useCaseTerms = normalizedTerms(context.useCase ? [context.useCase] : []);

  return products.map((product) => {
    const text = `${product.title} ${product.brand ?? ""} ${product.model ?? ""} ${product.features.join(" ")}`.toLocaleLowerCase("tr-TR");
    const matchedPreferences = preferenceTerms.filter((term) => text.includes(term));
    const matchedUseCase = useCaseTerms.filter((term) => text.includes(term));
    const budgetFit = context.budgetTRY !== undefined && product.priceTRY !== undefined
      ? product.priceTRY <= context.budgetTRY
        ? 35
        : Math.max(0, 35 * (context.budgetTRY / product.priceTRY))
      : 0;
    const preferenceFit = preferenceTerms.length ? 25 * (matchedPreferences.length / preferenceTerms.length) : 0;
    const useCaseFit = useCaseTerms.length ? 15 * (matchedUseCase.length / useCaseTerms.length) : 0;
    const featureFit = Math.min(10, product.features.length * 2.5);
    const valueScore = product.priceTRY !== undefined && context.budgetTRY !== undefined && product.priceTRY <= context.budgetTRY
      ? 15 * (1 - (product.priceTRY / context.budgetTRY) * 0.35)
      : product.priceTRY !== undefined ? 5 : 0;
    const scoreComponents: ScoreComponents = {
      budgetFit: round(budgetFit),
      preferenceFit: round(preferenceFit),
      useCaseFit: round(useCaseFit),
      featureFit: round(featureFit),
      valueScore: round(valueScore),
    };
    const evidenceSignals = Number(product.priceTRY !== undefined) + Number(context.budgetTRY !== undefined) + matchedPreferences.length + matchedUseCase.length;
    const possibleSignals = 2 + preferenceTerms.length + useCaseTerms.length;

    return {
      ...product,
      score: round(Object.values(scoreComponents).reduce((sum, value) => sum + value, 0)),
      scoreComponents,
      confidence: round(Math.min(0.95, 0.25 + 0.7 * (evidenceSignals / Math.max(1, possibleSignals)))),
      matchedTerms: [...new Set([...matchedPreferences, ...matchedUseCase])],
    };
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "tr"));
}

export function buildDecision(rankedProducts: RankedProduct[]): DecisionResult | undefined {
  if (!rankedProducts.length) return undefined;
  const winner = rankedProducts[0];
  const alternatives = rankedProducts.slice(1, 4);
  const reasons = [
    ...(winner.scoreComponents.budgetFit >= 35 ? ["Belirtilen bütçe içinde kalıyor."] : []),
    ...(winner.matchedTerms.length ? [`Tercihlerle eşleşen özellikler: ${winner.matchedTerms.join(", ")}.`] : []),
    `Doğrulanmış kaynak verileriyle ${winner.score}/100 puan aldı.`,
  ];
  const tradeoffs = [
    ...(winner.availability === "out_of_stock" ? ["Kaynakta stokta olmadığı belirtiliyor."] : []),
    ...(winner.scoreComponents.preferenceFit === 0 ? ["Kaynak metninde belirtilen tercihler için açık kanıt bulunmuyor."] : []),
  ];
  return {
    recommendedProductUrl: winner.url,
    recommendation: winner,
    alternatives,
    reasons,
    tradeoffs,
    confidence: winner.confidence,
    summary: `${winner.title}, yalnızca mevcut fiyat ve metin eşleşmelerine göre en yüksek puanı aldı (${winner.score}/100).`,
    rankedProducts,
  };
}