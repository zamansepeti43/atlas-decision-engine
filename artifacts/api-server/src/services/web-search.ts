import type { ResearchStatus, WebSource } from "../lib/chat-types.js";

const TAVILY_URL = "https://api.tavily.com/search";
const DEFAULT_SEARXNG_INSTANCES = [
  "https://searx.tiekoetter.com",
  "https://searxng.site",
];

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  published_date?: unknown;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

interface SearXNGResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  publishedDate?: unknown;
  published_date?: unknown;
}

interface SearXNGResponse {
  results?: SearXNGResult[];
}

export interface WebSearchResult {
  sources: WebSource[];
  research: ResearchStatus;
}

export interface WebSearchOptions {
  includeDomains?: string[];
  excludeDomains?: string[];
  searchDepth?: "basic" | "advanced";
}

type Fetcher = typeof fetch;
type FetchResponse = Awaited<ReturnType<Fetcher>> & {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

function domainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function configuredSearxngInstances(): string[] {
  const configured = process.env.SEARXNG_BASE_URLS ?? process.env.SEARXNG_BASE_URL;
  if (!configured) return DEFAULT_SEARXNG_INSTANCES;
  return configured.split(",").map((value) => value.trim()).filter(Boolean);
}

function normalizeSources(results: SearXNGResult[], retrievedAt: string): WebSource[] {
  return results.flatMap((result): WebSource[] => {
    if (typeof result.title !== "string" || typeof result.url !== "string") return [];
    const domain = domainFromUrl(result.url);
    if (!domain) return [];
    const snippet = typeof result.content === "string" ? result.content.trim() : "";
    if (!snippet && !result.title.trim()) return [];
    const publishedDate = typeof result.publishedDate === "string"
      ? result.publishedDate
      : typeof result.published_date === "string"
        ? result.published_date
        : undefined;
    return [{
      title: result.title.trim(),
      url: result.url,
      snippet,
      ...(publishedDate && { publishedDate }),
      domain,
      retrievedAt,
    }];
  });
}

async function searchSearXNG(
  query: string,
  fetcher: Fetcher,
  options: WebSearchOptions,
): Promise<WebSearchResult> {
  const instances = configuredSearxngInstances();
  let lastStatus: number | undefined;
  let lastError = "SearXNG arama sağlayıcısı kullanılamıyor.";

  for (const baseUrl of instances) {
    try {
      const endpoint = new URL("/search", baseUrl);
      endpoint.searchParams.set("q", query.trim().slice(0, 500));
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("language", "tr-TR");
      endpoint.searchParams.set("safesearch", "0");

      const response = await fetcher(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      }) as FetchResponse;
      lastStatus = response.status;

      if (!response.ok) {
        lastError = `SearXNG isteği ${response.status} durumuyla başarısız oldu.`;
        continue;
      }

      const payload = await response.json() as SearXNGResponse;
      const retrievedAt = new Date().toISOString();
      const allowed = new Set((options.includeDomains ?? []).map((domain) => domain.replace(/^www\./, "").toLowerCase()));
      const blocked = new Set((options.excludeDomains ?? []).map((domain) => domain.replace(/^www\./, "").toLowerCase()));
      const sources = [...new Map(
        normalizeSources(payload.results ?? [], retrievedAt)
          .filter((source) => (!allowed.size || allowed.has(source.domain)) && !blocked.has(source.domain))
          .map((source) => [source.url, source]),
      ).values()];

      if (sources.length > 0) {
        return { sources, research: { requested: true, status: "completed", provider: "searxng", retrievedAt } };
      }
      lastError = "SearXNG sonuç döndürmedi.";
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      lastError = timedOut ? "SearXNG araması zaman aşımına uğradı." : "SearXNG ağ hatası nedeniyle kullanılamıyor.";
    }
  }

  return {
    sources: [],
    research: {
      requested: true,
      status: "failed",
      provider: "searxng",
      ...(lastStatus !== undefined && { httpStatus: lastStatus }),
      error: lastError,
    },
  };
}

async function searchTavily(
  query: string,
  apiKey: string,
  fetcher: Fetcher,
  options: WebSearchOptions,
): Promise<WebSearchResult> {
  try {
    const response = await fetcher(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim().slice(0, 500),
        search_depth: options.searchDepth ?? "basic",
        max_results: 8,
        include_answer: false,
        include_raw_content: false,
        ...(options.includeDomains?.length && { include_domains: options.includeDomains }),
        ...(options.excludeDomains?.length && { exclude_domains: options.excludeDomains }),
      }),
      signal: AbortSignal.timeout(12_000),
    }) as FetchResponse;

    if (!response.ok) {
      const authenticationFailure = response.status === 401 || response.status === 403;
      const error = authenticationFailure
        ? "Web search provider kimlik doğrulaması başarısız."
        : response.status === 429
          ? "Web search provider istek limiti aşıldı."
          : response.status >= 500
            ? "Web search provider geçici olarak kullanılamıyor."
            : `Web search isteği ${response.status} durumuyla başarısız oldu.`;
      return {
        sources: [],
        research: {
          requested: true,
          status: authenticationFailure ? "unavailable" : "failed",
          provider: "tavily",
          httpStatus: response.status,
          error,
        },
      };
    }

    const payload = await response.json() as TavilyResponse;
    const retrievedAt = new Date().toISOString();
    const normalizedSources = (payload.results ?? []).flatMap((result): WebSource[] => {
      if (typeof result.title !== "string" || typeof result.url !== "string" || typeof result.content !== "string") return [];
      const domain = domainFromUrl(result.url);
      if (!domain) return [];
      return [{
        title: result.title.trim(),
        url: result.url,
        snippet: result.content.trim(),
        ...(typeof result.published_date === "string" && { publishedDate: result.published_date }),
        domain,
        retrievedAt,
      }];
    });
    const sources = [...new Map(normalizedSources.map((source) => [source.url, source])).values()];

    return { sources, research: { requested: true, status: "completed", provider: "tavily", retrievedAt } };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      sources: [],
      research: {
        requested: true,
        status: "failed",
        provider: "tavily",
        error: timedOut ? "Web search provider zaman aşımına uğradı." : "Web search provider ağ hatası nedeniyle kullanılamıyor.",
      },
    };
  }
}

/**
 * Atlas web araması: SearXNG önce gelir; Tavily yalnızca SearXNG başarısızsa
 * ve TAVILY_API_KEY mevcutsa son çare olarak kullanılır.
 */
export async function searchWeb(
  query: string,
  apiKey = process.env.TAVILY_API_KEY,
  fetcher: Fetcher = fetch,
  options: WebSearchOptions = {},
): Promise<WebSearchResult> {
  const primary = await searchSearXNG(query, fetcher, options);
  if (primary.sources.length > 0) return primary;

  if (apiKey) return searchTavily(query, apiKey, fetcher, options);

  return {
    sources: [],
    research: {
      requested: true,
      status: "unavailable",
      provider: "searxng",
      error: "SearXNG sonuç vermedi ve Tavily son çare sağlayıcısı yapılandırılmamış.",
    },
  };
}
