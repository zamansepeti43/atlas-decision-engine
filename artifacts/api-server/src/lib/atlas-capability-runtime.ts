import { randomUUID } from "node:crypto";

export type CapabilityId =
  | "live-shopping"
  | "banking"
  | "ocr-scam"
  | "call-assistant"
  | "assisted-purchase"
  | "web-agent";

export type CapabilityMode = "ready" | "needs-permission" | "needs-connector" | "needs-native" | "unavailable";

export interface CapabilityStatus {
  id: CapabilityId;
  label: string;
  mode: CapabilityMode;
  description: string;
  nextStep: string;
}

export interface ActionApproval {
  id: string;
  capability: CapabilityId;
  action: string;
  createdAt: string;
  expiresAt: string;
  requiresExplicitConfirmation: boolean;
}

const STATUS: CapabilityStatus[] = [
  {
    id: "live-shopping",
    label: "Canlı Mağaza Fiyatları",
    mode: "needs-connector",
    description: "Bir sorguda birden fazla mağazanın güncel ürün/fiyat sayfalarını toplamak ve doğrulamak için adaptör katmanı.",
    nextStep: "Mağaza adaptörleri veya yetkili arama sağlayıcısı bağlanmalı; doğrulanmayan fiyat gösterilmemeli.",
  },
  {
    id: "banking",
    label: "Banka Bağlantısı",
    mode: "needs-connector",
    description: "Hesap bakiyesi ve işlem hareketlerini kullanıcı izniyle okuyabilecek Open Banking bağlantı sözleşmesi.",
    nextStep: "Ülke/banka destekleyen lisanslı bir Open Banking sağlayıcısı ve kullanıcı OAuth/onay akışı gerekir.",
  },
  {
    id: "ocr-scam",
    label: "OCR + Dolandırıcılık Kalkanı",
    mode: "needs-permission",
    description: "Kullanıcının seçtiği görselden metin çıkarıp URL, ödeme, OTP ve aciliyet sinyallerini yerel olarak analiz eder.",
    nextStep: "Tarayıcıya görsel seçme izni verildiğinde yerel OCR çalıştırılabilir.",
  },
  {
    id: "call-assistant",
    label: "Görüşme Asistanı",
    mode: "needs-native",
    description: "Canlı görüşme sesini otomatik kaydetmek yerine, yalnızca işletim sistemi tarafından izin verilen ses/transkript köprüsünü tüketir.",
    nextStep: "Android/iOS native companion ve açık mikrofon/görüşme izinleri gerekir.",
  },
  {
    id: "assisted-purchase",
    label: "Onaylı Satın Alma",
    mode: "needs-permission",
    description: "Atlas ürünü bulup sepet/checkout adımlarını hazırlayabilir; ödeme ve nihai sipariş açık kullanıcı onayı ister.",
    nextStep: "Merchant checkout connector ve işlem öncesi tek seferlik onay kapısı gerekir.",
  },
  {
    id: "web-agent",
    label: "Kontrollü Web Ajanı",
    mode: "needs-permission",
    description: "İzin verilen alanlarda sayfa gezintisi, veri toplama ve görev yürütme için policy tabanlı ajan sözleşmesi.",
    nextStep: "Browser worker bağlanmalı; ödeme, hesap değişikliği ve dış iletişim gibi yüksek etkili aksiyonlar onay kapısından geçmeli.",
  },
];

export function getCapabilityStatuses(): CapabilityStatus[] {
  return STATUS.map((item) => ({ ...item }));
}

export function createActionApproval(
  capability: CapabilityId,
  action: string,
  ttlMs = 5 * 60_000,
): ActionApproval {
  const now = Date.now();
  return {
    id: randomUUID(),
    capability,
    action: action.trim().slice(0, 500),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + Math.max(10_000, ttlMs)).toISOString(),
    requiresExplicitConfirmation: true,
  };
}

export function isApprovalValid(approval: ActionApproval | null | undefined): boolean {
  if (!approval || !approval.requiresExplicitConfirmation) return false;
  return Date.now() < Date.parse(approval.expiresAt);
}

export function assertApprovedAction(approval: ActionApproval | null | undefined): void {
  if (!isApprovalValid(approval)) {
    throw new Error("Bu işlem için geçerli kullanıcı onayı gerekiyor.");
  }
}
