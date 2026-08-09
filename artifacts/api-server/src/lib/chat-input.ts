import type { ChatHistoryEntry, ProductResult } from "./chat-types.js";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_ENTRIES = 20;
const MAX_HISTORY_CONTENT_LENGTH = 2_000;
const MAX_MEMORY_LENGTH = 4_000;
const MAX_PRIOR_PRODUCTS = 10;

export type ParsedChatInput =
  | { ok: true; message: string; history: ChatHistoryEntry[]; memorySummary: string; priorProducts: ProductResult[] }
  | { ok: false; error: string };

export function parseChatInput(body: unknown): ParsedChatInput {
  if (!body || typeof body !== "object") return { ok: false, error: "Geçerli bir istek gövdesi gerekli." };
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.message !== "string" || !candidate.message.trim()) return { ok: false, error: "Mesaj gerekli." };
  const message = candidate.message.trim();
  if (message.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.` };
  if (candidate.history !== undefined && !Array.isArray(candidate.history)) return { ok: false, error: "Geçmiş bir dizi olmalı." };

  const history = (Array.isArray(candidate.history) ? candidate.history : [])
    .flatMap((entry): ChatHistoryEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const value = entry as Record<string, unknown>;
      if ((value.role !== "user" && value.role !== "assistant") || typeof value.content !== "string" || !value.content.trim()) return [];
      return [{ role: value.role, content: value.content.trim().slice(0, MAX_HISTORY_CONTENT_LENGTH) }];
    })
    .slice(-MAX_HISTORY_ENTRIES);
  const priorHistory = history.at(-1)?.role === "user" && history.at(-1)?.content === message
    ? history.slice(0, -1)
    : history;
  const memorySummary = typeof candidate.memorySummary === "string"
    ? candidate.memorySummary.trim().slice(0, MAX_MEMORY_LENGTH)
    : "";
  const priorProducts = (Array.isArray(candidate.priorProducts) ? candidate.priorProducts : [])
    .flatMap((entry): ProductResult[] => {
      if (!entry || typeof entry !== "object") return [];
      const product = entry as Record<string, unknown>;
      if (
        typeof product.title !== "string" ||
        typeof product.url !== "string" ||
        typeof product.priceTRY !== "number" ||
        typeof product.retrievedAt !== "string" ||
        !product.source ||
        typeof product.source !== "object"
      ) return [];
      const source = product.source as Record<string, unknown>;
      if (typeof source.title !== "string" || typeof source.url !== "string" || typeof source.domain !== "string") return [];
      let parsedUrl: URL;
      let parsedSourceUrl: URL;
      try {
        parsedUrl = new URL(product.url);
        parsedSourceUrl = new URL(source.url);
      } catch {
        return [];
      }
      if ((parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") ||
          (parsedSourceUrl.protocol !== "https:" && parsedSourceUrl.protocol !== "http:") ||
          Number.isNaN(Date.parse(product.retrievedAt))) return [];
      const priceTRY = typeof product.priceTRY === "number" && Number.isFinite(product.priceTRY) && product.priceTRY > 0
        ? product.priceTRY
        : undefined;
      if (priceTRY === undefined) return [];
      return [{
        title: product.title.slice(0, 300),
        ...(typeof product.brand === "string" && product.brand.trim() && { brand: product.brand.trim().slice(0, 100) }),
        ...(typeof product.model === "string" && product.model.trim() && { model: product.model.trim().slice(0, 200) }),
        url: parsedUrl.toString(),
        priceTRY,
        currency: "TRY",
        ...(typeof product.seller === "string" && product.seller.trim() && { seller: product.seller.trim().slice(0, 200) }),
        source: {
          title: source.title.slice(0, 300),
          url: parsedSourceUrl.toString(),
          domain: source.domain.slice(0, 200),
        },
        features: (Array.isArray(product.features) ? product.features : [])
          .filter((feature): feature is string => typeof feature === "string")
          .map((feature) => feature.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 20),
        ...(product.availability === "in_stock" || product.availability === "out_of_stock"
          ? { availability: product.availability }
          : {}),
        retrievedAt: new Date(product.retrievedAt).toISOString(),
      }];
    })
    .slice(0, MAX_PRIOR_PRODUCTS);

  return { ok: true, message, history: priorHistory, memorySummary, priorProducts };
}