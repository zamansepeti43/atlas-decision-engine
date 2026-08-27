export interface AtlasLearningEvent {
  task: string;
  skills: string[];
  outcome: "success" | "failure" | "partial";
  lesson: string;
  createdAt: string;
}

export interface AtlasLearningState {
  events: AtlasLearningEvent[];
}

const MAX_EVENTS = 100;

export function recordLearningEvent(
  state: AtlasLearningState,
  event: Omit<AtlasLearningEvent, "createdAt">,
): AtlasLearningState {
  const next: AtlasLearningEvent = { ...event, createdAt: new Date().toISOString() };
  return { events: [...state.events, next].slice(-MAX_EVENTS) };
}

export function summarizeLessons(state: AtlasLearningState): string {
  if (!state.events.length) return "Henüz doğrulanmış öğrenme kaydı yok.";

  const successful = state.events.filter((event) => event.outcome === "success");
  const failed = state.events.filter((event) => event.outcome === "failure");
  const lessons = state.events
    .filter((event) => event.lesson.trim())
    .slice(-10)
    .map((event) => `- [${event.outcome}] ${event.lesson}`)
    .join("\n");

  return [
    `Öğrenme kayıtları: ${state.events.length}`,
    `Başarılı: ${successful.length}, başarısız: ${failed.length}`,
    "Son dersler:",
    lessons,
  ].join("\n");
}

export function buildLearningInstruction(state: AtlasLearningState): string {
  return `Geçmiş görevlerden doğrulanmış dersleri tekrar kullan. Başarısız denemeleri körü körüne tekrarlama.\n${summarizeLessons(state)}`;
}
