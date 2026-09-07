export interface DecisionHistoryEntry {
  id: string;
  question: string;
  intent: string;
  summary: string;
  confidence: number;
  createdAt: string;
}

const KEY = 'atlas_decision_history_v1';
const LIMIT = 30;

function read(): DecisionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getDecisionHistory(): DecisionHistoryEntry[] {
  return read();
}

export function addDecisionHistory(entry: Omit<DecisionHistoryEntry, 'id' | 'createdAt'>): DecisionHistoryEntry {
  const item: DecisionHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([item, ...read()].slice(0, LIMIT)));
  } catch {
    // Local storage may be unavailable; the conversation itself still works.
  }
  return item;
}

export function clearDecisionHistory(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
