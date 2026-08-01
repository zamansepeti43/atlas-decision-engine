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
  preferences: Record<string, string>;   // key → value, e.g. "phone_os" → "ios"
  recentTopics: string[];                 // last 5 topics
  trackedProducts: string[];              // products the user follows
  opportunitySignals: string[];           // price / review / alternate alerts
  behavioralPatterns: string[];           // shadow-mode observations
  permissionGranted: boolean;
  lastUpdated: string;
}

const STORAGE_KEY = 'atlas_memory_v1';
const MAX_RECENT_TOPICS = 5;

const DEFAULT_MEMORY: UserMemory = {
  goals: [],
  preferences: {},
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

/** Returns a human-readable summary of what Atlas remembers, for display. */
export function memorySnapshot(mem: UserMemory): string[] {
  const lines: string[] = [];
  if (mem.budget) lines.push(`Bütçe: ${mem.budget}`);
  if (mem.location) lines.push(`Konum: ${mem.location}`);
  if (mem.occupation) lines.push(`Meslek: ${mem.occupation}`);
  if (mem.recentTopics.length > 0) lines.push(`Son konular: ${mem.recentTopics.join(', ')}`);
  if (mem.trackedProducts.length > 0) lines.push(`Takip edilen ürünler: ${mem.trackedProducts.join(', ')}`);
  if (mem.opportunitySignals.length > 0) lines.push(`Fırsat sinyalleri: ${mem.opportunitySignals.join(', ')}`);
  if (mem.behavioralPatterns.length > 0) lines.push(`Davranış kalıpları: ${mem.behavioralPatterns.join(', ')}`);
  return lines;
}
