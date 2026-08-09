import type { ResearchStatus, WebSource } from "../lib/chat-types.js";

const TAVILY_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  published_date?: unknown;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

export interface WebSearchResult {
  sources: WebSource[];
  research: ResearchStatus;
}

export interface WebSearchOptions {
  includeDomains?: string[];
  excludeDomains?: string[];
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

export async function searchWeb(
  query: string,
  apiKey = process.env.TAVILY_API_KEY,
  fetcher: Fetcher = fetch,
  options: WebSearchOptions = {},
): Promise<WebSearchResult> {
  if (!apiKey) {
    return {
      sources: [],
      research: { requested: true, status: "unavailable", provider: "tavily", error: "TAVILY_API_KEY yapılandırılmamış." },
    };
  }

  try {
    const response = await fetcher(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim().slice(0, 500),
        search_depth: "basic",
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