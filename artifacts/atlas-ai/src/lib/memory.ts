/**
 * Atlas AI — Memory System
 *
 * Persists user context across sessions in localStorage.
 * Never stores anything without explicit permission.
 *
 * OpenAI upgrade path: sync to a backend store tied to user ID.
 */

export interface UserMemory {
  budget?: string;
  location?: string;
  occupation?: string;
  goals: string[];
  preferences: Record<string, string>;
  excludedBrands: string[];
  preferredBrands: string[];
  decisionCriteria: string[];
  recentTopics: string[];
  trackedProducts: string[];
  opportunitySignals: string[];
  behavioralPatterns: string[];
  permissionGranted: boolean;
  lastUpdated: string;
}

const STORAGE_KEY = 'atlas_memory_v1';
const MAX_RECENT_TOPICS = 5;
const MAX_EXCLUDED_BRANDS = 8;
const MAX_PREFERRED_BRANDS = 8;
const MAX_DECISION_CRITERIA = 8;

const DEFAULT_MEMORY: UserMemory = {
  goals: [],
  preferences: {},
  excludedBrands: [],
  preferredBrands: [],
  decisionCriteria: [],
  recentTopics: [],
  trackedProducts: [],
  opportunitySignals: [],
  behavioralPatterns: [],
  permissionGranted: false,
  lastUpdated: new Date().toISOString(),
};

export function getMemory(): UserMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEMORY };
    return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

export function updateMemory(updates: Partial<UserMemory>): UserMemory {
  const current = getMemory();
  const next: UserMemory = {
    ...current,
    ...updates,
    preferences: { ...current.preferences, ...(updates.preferences ?? {}) },
    goals: updates.goals ?? current.goals,
    recentTopics: updates.recentTopics ?? current.recentTopics,
    trackedProducts: updates.trackedProducts ?? current.trackedProducts,
    opportunitySignals: updates.opportunitySignals ?? current.opportunitySignals,
    behavioralPatterns: updates.behavioralPatterns ?? current.behavioralPatterns,
    preferredBrands: updates.preferredBrands ?? current.preferredBrands,
    decisionCriteria: updates.decisionCriteria ?? current.decisionCriteria,
    excludedBrands: updates.excludedBrands ?? current.excludedBrands,
    lastUpdated: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — fail silently
  }
  return next;
}

export function grantMemoryPermission(): UserMemory {
  return updateMemory({ permissionGranted: true });
}

export function revokeMemoryPermission(): UserMemory {
  return updateMemory({ permissionGranted: false });
}

export function clearMemory(): UserMemory {
  const cleared = { ...DEFAULT_MEMORY };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return cleared;
}

/**
 * After a successful interaction, extract saveable facts and persist them
 * (only if permission has been granted).
 */
export function extractAndSave(facts: {
  budget?: string;
  location?: string;
  topic?: string;
  occupation?: string;
  preference?: { key: string; value: string };
  trackedProduct?: string;
  signal?: string;
  pattern?: string;
}): void {
  const mem = getMemory();
  if (!mem.permissionGranted) return;

  const updates: Partial<UserMemory> = {};

  if (facts.budget) updates.budget = facts.budget;
  if (facts.location) updates.location = facts.location;
  if (facts.occupation) updates.occupation = facts.occupation;

  if (facts.topic) {
    const recent = [facts.topic, ...mem.recentTopics].slice(0, MAX_RECENT_TOPICS);
    updates.recentTopics = recent;
  }

  if (facts.preference) {
    updates.preferences = {
      ...mem.preferences,
      [facts.preference.key]: facts.preference.value,
    };
  }

  if (facts.trackedProduct) {
    updates.trackedProducts = [...new Set([facts.trackedProduct, ...mem.trackedProducts])].slice(0, 8);
  }

  if (facts.signal) {
    updates.opportunitySignals = [...new Set([facts.signal, ...mem.opportunitySignals])].slice(0, 8);
  }

  if (facts.pattern) {
    updates.behavioralPatterns = [...new Set([facts.pattern, ...mem.behavioralPatterns])].slice(0, 8);
  }

  updateMemory(updates);
}

export interface BackendMemoryCandidate {
  key: 'budgetTRY' | 'preference' | 'useCase' | 'exclusion' | 'preferredBrand' | 'decisionCriterion';
  value: string | number;
  reason: string;
  learning?: string;
  confidence?: number;
  scope?: 'user';
  source?: 'explicit_feedback' | 'user_correction';
  domain?: string;
  category?: string;
}

const MAX_MEMORY_VALUE_LENGTH = 120;

function normalizeBrand(brand: string): string {
  return brand.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function normalizeToken(token: string): string {
  return token.toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]+/g, '').trim();
}

function displayBrand(brand: string): string {
  const normalized = brand.toLocaleLowerCase('tr-TR');
  if (normalized.length <= 3) return normalized.toUpperCase();
  return normalized.charAt(0).toLocaleUpperCase('tr-TR') + normalized.slice(1);
}

function isSensitive(value: string): boolean {
  return /password|parola|şifre|token|secret|api.?key|kart numarası/i.test(value);
}

/** Applies only the backend's allow-listed, non-sensitive memory fields. */
export function applyMemoryCandidates(candidates: BackendMemoryCandidate[]): UserMemory {
  const memory = getMemory();
  if (!memory.permissionGranted || !Array.isArray(candidates)) return memory;

  const updates: Partial<UserMemory> = {};
  const preferences = { ...memory.preferences };
  let excludedBrands = [...memory.excludedBrands];
  let preferredBrands = [...memory.preferredBrands] as string[];
  let decisionCriteria = [...memory.decisionCriteria] as string[];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate.reason !== 'string') continue;

    if (candidate.key === 'budgetTRY' && typeof candidate.value === 'number' && Number.isFinite(candidate.value) && candidate.value > 0) {
      updates.budget = `${Math.round(candidate.value).toLocaleString('tr-TR')} TL`;
      continue;
    }

    if (candidate.key === 'exclusion' && typeof candidate.value === 'string') {
      const brand = normalizeBrand(candidate.value);
      if (!brand || isSensitive(brand)) continue;
      const conf = candidate.confidence ?? 0.95;
      if (conf === 0) {
        excludedBrands = excludedBrands.filter((item) => item !== brand);
      } else if (conf >= 0.6 && !excludedBrands.includes(brand)) {
        excludedBrands = [...excludedBrands, brand];
        // A brand that is now excluded cannot be a preference.
        preferredBrands = preferredBrands.filter((item) => item !== brand);
      }
      continue;
    }

    if (candidate.key === 'preferredBrand' && typeof candidate.value === 'string') {
      const brand = normalizeBrand(candidate.value);
      if (!brand || isSensitive(brand)) continue;
      const conf = candidate.confidence ?? 0.85;
      if (conf === 0) {
        preferredBrands = preferredBrands.filter((item) => item !== brand);
      } else if (conf >= 0.6) {
        preferredBrands = [...new Set([...preferredBrands, brand])].slice(0, MAX_PREFERRED_BRANDS);
        // Bir markayı tercih etmek, daha önce dışlanmışsa dışlamayı kaldırır.
        excludedBrands = excludedBrands.filter((item) => item !== brand);
      }
      continue;
    }

    if (candidate.key === 'decisionCriterion' && typeof candidate.value === 'string') {
      const criterion = normalizeToken(candidate.value);
      if (!criterion || isSensitive(criterion)) continue;
      const conf = candidate.confidence ?? 0.70;
      if (conf === 0) {
        decisionCriteria = decisionCriteria.filter((item) => normalizeToken(item) !== criterion);
      } else if (conf >= 0.6) {
        decisionCriteria = [...new Set([...decisionCriteria, criterion])].slice(0, MAX_DECISION_CRITERIA);
      }
      continue;
    }

    if ((candidate.key === 'preference' || candidate.key === 'useCase') && typeof candidate.value === 'string') {
      const value = candidate.value.trim().slice(0, MAX_MEMORY_VALUE_LENGTH);
      if (!value || isSensitive(value)) continue;
      preferences[candidate.key === 'preference' ? 'preference' : 'useCase'] = value;
    }
  }

  if (excludedBrands.join('|') !== memory.excludedBrands.join('|')) updates.excludedBrands = excludedBrands;
  if (preferredBrands.join('|') !== memory.preferredBrands.join('|')) updates.preferredBrands = preferredBrands;
  if (decisionCriteria.join('|') !== memory.decisionCriteria.join('|')) updates.decisionCriteria = decisionCriteria;

  if (Object.keys(preferences).length !== Object.keys(memory.preferences).length ||
      Object.entries(preferences).some(([key, value]) => memory.preferences[key] !== value)) {
    updates.preferences = preferences;
  }

  return Object.keys(updates).length > 0 ? updateMemory(updates) : memory;
}

/** Returns a human-readable summary of what Atlas remembers, for display. */
export function memorySnapshot(mem: UserMemory): string[] {
  const lines: string[] = [];
  if (mem.budget) lines.push(`Bütçe: ${mem.budget}`);
  if (mem.location) lines.push(`Konum: ${mem.location}`);
  if (mem.occupation) lines.push(`Meslek: ${mem.occupation}`);
  if (Object.keys(mem.preferences).length > 0) lines.push(`Tercihler: ${Object.values(mem.preferences).join(', ')}`);
  if (mem.preferredBrands.length > 0) lines.push(`Tercih edilen markalar: ${mem.preferredBrands.map(displayBrand).join(', ')}`);
  if (mem.decisionCriteria.length > 0) lines.push(`Karar kriterleri: ${mem.decisionCriteria.map(displayBrand).join(', ')}`);
  if (mem.excludedBrands.length > 0) lines.push(`Hariç: ${mem.excludedBrands.map(displayBrand).join(', ')}`);
  if (mem.recentTopics.length > 0) lines.push(`Son konular: ${mem.recentTopics.join(', ')}`);
  if (mem.trackedProducts.length > 0) lines.push(`Takip edilen ürünler: ${mem.trackedProducts.join(', ')}`);
  if (mem.opportunitySignals.length > 0) lines.push(`Fırsat sinyalleri: ${mem.opportunitySignals.join(', ')}`);
  if (mem.behavioralPatterns.length > 0) lines.push(`Davranış kalıpları: ${mem.behavioralPatterns.join(', ')}`);
  return lines;
}
