/**
 * Atlas capability contracts.
 *
 * These contracts deliberately separate what Atlas can orchestrate from what
 * requires a platform/provider integration. No capability is reported as
 * active unless its runtime adapter is actually configured.
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
    ready: false,
    requiresUserConsent: false,
    description: "Merchant adapters can retrieve live public product pages when a compatible provider/route is configured.",
    missing: ["merchant/search provider or permitted merchant adapters", "anti-bot/CORS-compatible server runtime"],
  },
  {
    id: "banking",
    label: "Banka bağlantısı",
    mode: "provider",
    ready: false,
    requiresUserConsent: true,
    description: "Uses a regulated/open-banking provider or an explicit statement import; Atlas never asks for internet-banking passwords.",
    missing: ["open-banking provider credentials/consent flow"],
  },
  {
    id: "image-ocr-scam",
    label: "Görsel OCR + dolandırıcılık analizi",
    mode: "local",
    ready: false,
    requiresUserConsent: false,
    description: "The scam engine is local, while OCR needs a browser/native OCR runtime to be bundled or enabled.",
    missing: ["OCR runtime (for example a bundled Tesseract.js worker)"],
  },
  {
    id: "phone-assistant",
    label: "Telefon görüşmesi asistanı",
    mode: "native",
    ready: false,
    requiresUserConsent: true,
    description: "Requires an Android/iOS native companion and OS-level call/audio permissions; a normal web page cannot silently capture cellular calls.",
    missing: ["native mobile companion", "explicit OS permissions", "platform-compliant call/audio integration"],
  },
  {
    id: "checkout",
    label: "Satın alma",
    mode: "provider",
    ready: false,
    requiresUserConsent: true,
    description: "Atlas can prepare and validate a checkout, but payment/purchase must remain behind explicit user confirmation.",
    missing: ["merchant checkout adapter", "explicit purchase confirmation"],
  },
  {
    id: "web-agent",
    label: "Otonom web ajanı",
    mode: "provider",
    ready: false,
    requiresUserConsent: true,
    description: "A controlled browser worker is required. Authentication, payments and destructive actions always require confirmation.",
    missing: ["browser automation runtime", "domain/action policy", "secure session handling"],
  },
];

export function getCapabilityStatuses(): CapabilityStatus[] {
  return ATLAS_CAPABILITY_STATUSES.map((status) => ({
    ...status,
    missing: status.missing ? [...status.missing] : undefined,
  }));
}

export function assertPurchaseAuthorized(auth: PurchaseAuthorization): void {
  if (!auth.confirmedByUser) {
    throw new Error("Purchase requires explicit user confirmation.");
  }
  if (!Number.isFinite(auth.totalTRY) || auth.totalTRY <= 0) {
    throw new Error("Invalid purchase total.");
  }
}

export function isAllowedAgentAction(action: WebAgentPolicy["requireConfirmationFor"][number], confirmed: boolean): boolean {
  if (["login", "payment", "purchase", "message", "account-change"].includes(action)) return confirmed;
  return true;
}
