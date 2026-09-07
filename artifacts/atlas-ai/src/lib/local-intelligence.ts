/**
 * Atlas local intelligence — zero external API dependency.
 * Deterministic helpers that work offline in the browser.
 */

import { analyzeScamText, type ScamAnalysis } from './atlas-capabilities';
import { analyzeUrl } from './offline-tools';
import { getMemory, updateMemory, type UserMemory } from './memory';

export type LocalCommandKind =
  | 'scam'
  | 'url-security'
  | 'budget'
  | 'memory'
  | 'task'
  | 'reminder'
  | 'track'
  | 'research'
  | 'conversation';

export interface LocalCommand {
  kind: LocalCommandKind;
  confidence: number;
  payload: string;
}

export function classifyLocalCommand(text: string): LocalCommand {
  const value = text.trim();
  const lower = value.toLocaleLowerCase('tr-TR');

  if (/(dolandır|sahte|phishing|oltalama|şüpheli mesaj|güvenli mi|güvenilir mi)/i.test(lower))
    return { kind: 'scam', confidence: 0.96, payload: value };
  if (/(link|url|bağlantı).*(güven|güvenli|şüpheli|kontrol|incele)|https?:\/\//i.test(value))
    return { kind: 'url-security', confidence: 0.93, payload: value };
  if (/(bütçe|harcama|gelir|gider|borç|tasarruf|param|maaş)/i.test(lower))
    return { kind: 'budget', confidence: 0.9, payload: value };
  if (/(hafıza|hatırla|hatırlıyor musun|unut|tercihimi)/i.test(lower))
    return { kind: 'memory', confidence: 0.92, payload: value };
  if (/(hatırlat|hatırlatıcı)/i.test(lower)) return { kind: 'reminder', confidence: 0.95, payload: value };
  if (/(görev oluştur|görev ekle)/i.test(lower)) return { kind: 'task', confidence: 0.95, payload: value };
  if (/(takip et|takibe al)/i.test(lower)) return { kind: 'track', confidence: 0.95, payload: value };
  if (/(araştır|kaynak bul|incele)/i.test(lower)) return { kind: 'research', confidence: 0.82, payload: value };
  return { kind: 'conversation', confidence: 0.55, payload: value };
}

export function formatScamResult(text: string): string {
  const result: ScamAnalysis = analyzeScamText(text);
  const signalText = result.signals.length ? result.signals.map((s) => `• ${s}`).join('\n') : '• Belirgin şüpheli sinyal bulunmadı.';
  return `🛡️ Dolandırıcılık Kalkanı\n\nRisk: ${result.riskLevel}\nSkor: ${result.score}/100\n\n${signalText}\n\n${result.recommendation}\n\nNot: Bu yerel kural motoru kesin güvenlik garantisi vermez.`;
}

export function formatUrlResult(text: string): string {
  const match = text.match(/https?:\/\/[^\s)]+/i)?.[0];
  if (!match) return 'Kontrol edebilmem için mesajına http:// veya https:// ile başlayan bağlantıyı ekle.';
  const result = analyzeUrl(match);
  const signals = result.signals.length ? result.signals.map((s) => `• ${s}`).join('\n') : '• Belirgin risk sinyali bulunmadı.';
  return `🔎 Bağlantı Güvenlik Kontrolü\n\n${result.level}\nSkor: ${result.score}/100\n\n${signals}\n\n${result.recommendation}`;
}

export function formatMemoryResult(): string {
  const memory = getMemory();
  if (!memory.permissionGranted) return 'Atlas hafızası şu anda kapalı. Ayarlardan hafızayı etkinleştirirsen, izin verdiğin tercihleri ve karar kriterlerini cihazında yerel olarak saklayabilirim.';
  const items = [
    memory.budget && `Bütçe: ${memory.budget}`,
    memory.location && `Konum: ${memory.location}`,
    memory.occupation && `Meslek: ${memory.occupation}`,
    memory.preferredBrands.length && `Tercih edilen markalar: ${memory.preferredBrands.join(', ')}`,
    memory.excludedBrands.length && `Hariç tutulan markalar: ${memory.excludedBrands.join(', ')}`,
    memory.decisionCriteria.length && `Karar kriterleri: ${memory.decisionCriteria.join(', ')}`,
    memory.recentTopics.length && `Son konular: ${memory.recentTopics.join(', ')}`,
  ].filter(Boolean) as string[];
  return items.length ? `🧠 Atlas'ın yerel hafızasında:\n\n${items.map((x) => `• ${x}`).join('\n')}` : '🧠 Hafızan açık fakat henüz kaydedilmiş anlamlı bir tercih yok.';
}

export function exportMemory(): string {
  return JSON.stringify(getMemory(), null, 2);
}

export function importMemory(json: string): UserMemory {
  const parsed = JSON.parse(json) as Partial<UserMemory>;
  if (!parsed || typeof parsed !== 'object') throw new Error('Geçersiz hafıza dosyası.');
  const safe: Partial<UserMemory> = {
    budget: typeof parsed.budget === 'string' ? parsed.budget.slice(0, 120) : undefined,
    location: typeof parsed.location === 'string' ? parsed.location.slice(0, 120) : undefined,
    occupation: typeof parsed.occupation === 'string' ? parsed.occupation.slice(0, 120) : undefined,
    goals: Array.isArray(parsed.goals) ? parsed.goals.filter((x): x is string => typeof x === 'string').slice(0, 20) : [],
    preferences: parsed.preferences && typeof parsed.preferences === 'object' ? Object.fromEntries(Object.entries(parsed.preferences).filter(([, v]) => typeof v === 'string').slice(0, 20)) : {},
    excludedBrands: Array.isArray(parsed.excludedBrands) ? parsed.excludedBrands.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    preferredBrands: Array.isArray(parsed.preferredBrands) ? parsed.preferredBrands.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    decisionCriteria: Array.isArray(parsed.decisionCriteria) ? parsed.decisionCriteria.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    recentTopics: Array.isArray(parsed.recentTopics) ? parsed.recentTopics.filter((x): x is string => typeof x === 'string').slice(0, 5) : [],
    trackedProducts: Array.isArray(parsed.trackedProducts) ? parsed.trackedProducts.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    opportunitySignals: Array.isArray(parsed.opportunitySignals) ? parsed.opportunitySignals.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    behavioralPatterns: Array.isArray(parsed.behavioralPatterns) ? parsed.behavioralPatterns.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    permissionGranted: Boolean(parsed.permissionGranted),
  };
  return updateMemory(safe);
}
