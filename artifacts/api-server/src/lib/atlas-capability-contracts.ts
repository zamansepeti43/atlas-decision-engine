/**
 * Atlas capability contracts.
 *
 * These contracts separate orchestration from external permissions/providers.
 * Atlas never claims a provider-backed capability is live until its adapter is configured.
 */

export type AtlasCapabilityId =
  | "merchant-prices"
  | "banking"
  | "image-ocr-scam"
  | "phone-assistant"
  | "checkout"
  | "web-agent";

export type CapabilityMode = "local" | "provider" | "native" | "disabled";

export interface CapabilityStatus {
  id: AtlasCapabilityId;
  label: string;
  mode: CapabilityMode;
  ready: boolean;
  requiresUserConsent: boolean;
  description: string;
  missing?: string[];
}

export interface MerchantPriceCandidate {
  merchant: string;
  title: string;
  priceTRY?: number;
  url: string;
  retrievedAt: string;
  source: "merchant-page" | "structured-data" | "search-result";
}

export interface BankAccountSnapshot {
  provider: string;
  accountId: string;
  currency: string;
  balance?: number;
  availableBalance?: number;
  retrievedAt: string;
  source: "open-banking" | "import";
}

export interface PurchaseAuthorization {
  orderId: string;
  merchant: string;
  totalTRY: number;
  confirmedByUser: boolean;
  createdAt: string;
}

export interface WebAgentPolicy {
  allowedDomains: string[];
  maxActions: number;
  requireConfirmationFor: Array<"login" | "payment" | "purchase" | "message" | "account-change">;
}

export const ATLAS_CAPABILITY_STATUSES: CapabilityStatus[] = [
  {
    id: "merchant-prices",
    label: "Gerçek zamanlı mağaza fiyatları",
    mode: "provider",
    ready: Boolean(process.env.TAVILY_API_KEY),
    requiresUserConsent: false,
    description: "On-demand web/merchant search with product normalization and price verification. Multiple Turkish merchant domains can be queried in parallel.",
    missing: process.env.TAVILY_API_KEY ? undefined : ["TAVILY_API_KEY veya doğrudan merchant adapters"],
  },
  {
    id: "banking",
    label: "Banka bağlantısı",
    mode: "provider",
    ready: Boolean(process.env.OPEN_BANKING_AUTHORIZE_URL),
    requiresUserConsent: true,
    description: "Uses a regulated/open-banking provider or explicit statement import. Atlas never asks for internet-banking passwords.",
    missing: process.env.OPEN_BANKING_AUTHORIZE_URL ? undefined : ["OPEN_BANKING_AUTHORIZE_URL", "provider client credentials/callback"],
  },
  {
    id: "image-ocr-scam",
    label: "Görsel OCR + dolandırıcılık analizi",
    mode: "local",
    ready: true,
    requiresUserConsent: false,
    description: "Turkish OCR runs in the user's browser with Tesseract.js loaded only on demand; extracted text is then analyzed locally by Scam Shield.",
  },
  {
    id: "phone-assistant",
    label: "Telefon görüşmesi asistanı",
    mode: "native",
    ready: false,
    requiresUserConsent: true,
    description: "Requires an Android/iOS native companion and OS-level call/audio permissions. A normal web page cannot silently capture cellular calls.",
    missing: ["native mobile companion", "explicit OS permissions", "platform-compliant call/audio integration"],
  },
  {
    id: "checkout",
    label: "Onaylı satın alma",
    mode: "provider",
    ready: false,
    requiresUserConsent: true,
    description: "Atlas can prepare and validate checkout, but payment/purchase remains behind explicit user confirmation.",
    missing: ["merchant checkout adapter", "explicit purchase confirmation"],
  },
  {
    id: "web-agent",
    label: "Kontrollü web ajanı",
    mode: "provider",
    ready: Boolean(process.env.ATLAS_BROWSER_WORKER_URL),
    requiresUserConsent: true,
    description: "A controlled browser worker can execute allowlisted web actions; authentication, payments and destructive actions always require confirmation.",
    missing: process.env.ATLAS_BROWSER_WORKER_URL ? undefined : ["ATLAS_BROWSER_WORKER_URL", "domain/action policy", "secure session handling"],
  },
];

export function getCapabilityStatuses(): CapabilityStatus[] {
  return ATLAS_CAPABILITY_STATUSES.map((status) => ({
    ...status,
    missing: status.missing ? [...status.missing] : undefined,
  }));
}

export function assertPurchaseAuthorized(auth: PurchaseAuthorization): void {
  if (!auth.confirmedByUser) throw new Error("Purchase requires explicit user confirmation.");
  if (!Number.isFinite(auth.totalTRY) || auth.totalTRY <= 0) throw new Error("Invalid purchase total.");
}

export function isAllowedAgentAction(action: WebAgentPolicy["requireConfirmationFor"][number], confirmed: boolean): boolean {
  if (["login", "payment", "purchase", "message", "account-change"].includes(action)) return confirmed;
  return true;
}
