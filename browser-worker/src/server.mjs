import { createServer } from "node:http";
import { URL } from "node:url";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.ATLAS_BROWSER_WORKER_TOKEN?.trim() || "";
const MAX_ACTIONS = Math.max(1, Math.min(50, Number(process.env.ATLAS_BROWSER_MAX_ACTIONS || 50)));
const DEFAULT_TIMEOUT = Math.max(5_000, Number(process.env.ATLAS_BROWSER_TIMEOUT_MS || 20_000));
const DEFAULT_ALLOWED = (process.env.ATLAS_DEFAULT_ALLOWED_DOMAINS || "")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

const HIGH_IMPACT = new Set(["login", "payment", "purchase", "message", "account-change"]);
const PURCHASE_ENV_ENABLED = process.env.ATLAS_ALLOW_LIVE_PURCHASE === "true";

let browserPromise;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

function normalizeDomain(value) {
  try {
    const raw = value.includes("://") ? value : `https://${value}`;
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function domainAllowed(url, allowedDomains) {
  const hostname = normalizeDomain(url);
  if (!hostname) return false;
  const allowed = (allowedDomains.length ? allowedDomains : DEFAULT_ALLOWED).map(normalizeDomain).filter(Boolean);
  return allowed.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function safeUrl(value, allowedDomains) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Sadece HTTP/HTTPS adreslerine izin veriliyor.");
  if (!domainAllowed(parsed.href, allowedDomains)) throw new Error(`Alan adı izin listesinde değil: ${parsed.hostname}`);
  return parsed.href;
}

function extractUrls(text) {
  return [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((m) => m[0].replace(/[.,;!?]+$/, ""));
}

function merchantSearchUrl(domain, query) {
  const encoded = encodeURIComponent(query);
  const known = {
    "trendyol.com": `https://www.trendyol.com/sr?q=${encoded}`,
    "hepsiburada.com": `https://www.hepsiburada.com/ara?q=${encoded}`,
    "n11.com": `https://www.n11.com/arama?q=${encoded}`,
    "amazon.com.tr": `https://www.amazon.com.tr/s?k=${encoded}`,
    "pazarama.com": `https://www.pazarama.com/arama?q=${encoded}`,
    "mediamarkt.com.tr": `https://www.mediamarkt.com.tr/tr/search.html?query=${encoded}`,
    "vatanbilgisayar.com": `https://www.vatanbilgisayar.com/arama/${encodeURIComponent(query)}/`,
    "teknosa.com": `https://www.teknosa.com/arama?q=${encoded}`,
    "pttavm.com": `https://www.pttavm.com/arama?q=${encoded}`,
    "koctas.com.tr": `https://www.koctas.com.tr/arama?q=${encoded}`,
    "boyner.com.tr": `https://www.boyner.com.tr/search?q=${encoded}`,
    "lcw.com": `https://www.lcw.com/arama?q=${encoded}`,
    "gratis.com": `https://www.gratis.com/search?q=${encoded}`,
    "watsons.com.tr": `https://www.watsons.com.tr/search?q=${encoded}`,
    "decathlon.com.tr": `https://www.decathlon.com.tr/search?Ntt=${encoded}`,
  };
  return known[domain] || `https://${domain}/search?q=${encoded}`;
}

function extractProductCandidates(text) {
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const pricePattern = /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:TL|₺)/i;
  return lines
    .filter((line) => pricePattern.test(line))
    .slice(0, 30)
    .map((line) => {
      const match = line.match(pricePattern);
      return { text: line.slice(0, 500), price: match?.[0] || null };
    });
}

async function getBrowser() {
  if (!browserPromise) browserPromise = chromium.launch({ headless: true });
  return browserPromise;
}

async function executeAction(page, action, allowedDomains, results) {
  const type = String(action?.type || "").trim();
  if (!type) throw new Error("Geçersiz tarayıcı aksiyonu.");
  if (HIGH_IMPACT.has(type) && type === "purchase" && !PURCHASE_ENV_ENABLED) {
    return { type, skipped: true, reason: "Canlı satın alma ATLAS_ALLOW_LIVE_PURCHASE=true olmadan devre dışı." };
  }

  if (type === "goto") {
    const url = safeUrl(String(action.url || ""), allowedDomains);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
    return { type, url: page.url(), title: await page.title() };
  }

  if (type === "search") {
    const domain = normalizeDomain(String(action.domain || allowedDomains[0] || ""));
    if (!domainAllowed(`https://${domain}`, allowedDomains)) throw new Error(`Arama alan adı izin listesinde değil: ${domain}`);
    const url = merchantSearchUrl(domain, String(action.query || ""));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
    const text = await page.locator("body").innerText({ timeout: DEFAULT_TIMEOUT }).catch(() => "");
    const candidates = extractProductCandidates(text);
    results.products.push(...candidates.map((x) => ({ ...x, merchant: domain, url: page.url() })));
    return { type, merchant: domain, url: page.url(), title: await page.title(), candidates: candidates.length };
  }

  if (type === "click") {
    const selector = String(action.selector || "").slice(0, 500);
    await page.locator(selector).first().click({ timeout: DEFAULT_TIMEOUT });
    return { type, selector };
  }

  if (type === "fill") {
    const selector = String(action.selector || "").slice(0, 500);
    const value = String(action.value || "").slice(0, 2000);
    await page.locator(selector).first().fill(value, { timeout: DEFAULT_TIMEOUT });
    return { type, selector };
  }

  if (type === "press") {
    const selector = String(action.selector || "").slice(0, 500);
    const key = String(action.key || "Enter").slice(0, 50);
    await page.locator(selector).first().press(key, { timeout: DEFAULT_TIMEOUT });
    return { type, selector, key };
  }

  if (type === "extract") {
    const text = await page.locator("body").innerText({ timeout: DEFAULT_TIMEOUT }).catch(() => "");
    const limited = text.slice(0, 30_000);
    results.products.push(...extractProductCandidates(limited).map((x) => ({ ...x, url: page.url() })));
    return { type, url: page.url(), title: await page.title(), text: limited };
  }

  if (type === "screenshot") {
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return { type, base64: buffer.toString("base64"), url: page.url() };
  }

  if (type === "login" || type === "payment" || type === "message" || type === "account-change") {
    return { type, blocked: true, reason: "Yüksek etkili işlem worker tarafından otomatik yürütülmez." };
  }

  throw new Error(`Desteklenmeyen aksiyon: ${type}`);
}

async function runTask(task, confirmed) {
  const allowedDomains = Array.isArray(task.allowedDomains) ? task.allowedDomains.map(normalizeDomain).filter(Boolean) : [];
  const goal = String(task.goal || "").trim();
  const actions = Array.isArray(task.actions) ? task.actions : [];
  const requiresConfirmation = actions.some((a) => HIGH_IMPACT.has(String(a?.type || "")));

  if (requiresConfirmation && !confirmed) {
    return { status: "confirmation_required", goal, actions: actions.map((a) => ({ type: a?.type, url: a?.url, domain: a?.domain })) };
  }

  const browser = await getBrowser();
  const context = await browser.newContext({ locale: "tr-TR" });
  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);
  const results = { status: "completed", goal, actions: [], products: [], pages: [] };

  try {
    const urls = extractUrls(goal);
    if (urls.length) {
      for (const url of urls.slice(0, Math.min(urls.length, MAX_ACTIONS))) {
        const safe = safeUrl(url, allowedDomains);
        await page.goto(safe, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        const text = await page.locator("body").innerText({ timeout: DEFAULT_TIMEOUT }).catch(() => "");
        results.pages.push({ url: page.url(), title: await page.title(), text: text.slice(0, 20_000) });
      }
    } else if (actions.length === 0 && allowedDomains.length) {
      const query = goal.slice(0, 180);
      for (const domain of allowedDomains.slice(0, Math.min(allowedDomains.length, MAX_ACTIONS))) {
        const url = merchantSearchUrl(domain, query);
        await page.goto(safeUrl(url, allowedDomains), { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        const text = await page.locator("body").innerText({ timeout: DEFAULT_TIMEOUT }).catch(() => "");
        results.products.push(...extractProductCandidates(text).map((x) => ({ ...x, merchant: domain, url: page.url() })));
        results.pages.push({ url: page.url(), title: await page.title() });
      }
    }

    for (const action of actions.slice(0, MAX_ACTIONS)) {
      results.actions.push(await executeAction(page, action, allowedDomains, results));
    }

    return results;
  } finally {
    await context.close();
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "atlas-browser-worker" });
  if (url.pathname !== "/run" || req.method !== "POST") return json(res, 404, { ok: false, error: "Not found" });
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { success: false, error: "Yetkisiz browser worker isteği." });

  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    const body = JSON.parse(raw || "{}");
    const result = await runTask(body.task || {}, body.confirmed === true);
    return json(res, 200, { success: true, result });
  } catch (error) {
    return json(res, 400, { success: false, error: error instanceof Error ? error.message : "Browser worker hatası." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Atlas Browser Worker (Tarayıcı İşçisi) listening on :${PORT}`);
});

process.on("SIGTERM", async () => {
  const browser = await browserPromise?.catch?.(() => null);
  await browser?.close?.();
  server.close(() => process.exit(0));
});
