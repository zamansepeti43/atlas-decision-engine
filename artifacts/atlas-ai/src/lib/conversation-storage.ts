import type { CollectedContext, ConversationMessage } from './conversation-engine';

export const CONVERSATION_STORAGE_KEY = 'atlas_conversation_v2';

export interface PersistedConversationState {
  messages: ConversationMessage[];
  context: CollectedContext | null;
  isAnsweringClarification: boolean;
}

const EMPTY_CONVERSATION: PersistedConversationState = {
  messages: [],
  context: null,
  isAnsweringClarification: false,
};

function isContext(value: unknown): value is CollectedContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as Partial<CollectedContext>;
  return typeof context.originalQuestion === 'string' &&
    typeof context.intent === 'string' &&
    Array.isArray(context.options) &&
    Array.isArray(context.priorities) &&
    Array.isArray(context.clarificationAnswers) &&
    typeof context.round === 'number';
}

function reviveMessage(value: unknown): ConversationMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<ConversationMessage>;
  if (typeof message.id !== 'string' ||
      (message.role !== 'user' && message.role !== 'atlas') ||
      (message.type !== 'text' && message.type !== 'clarification' && message.type !== 'rich') ||
      typeof message.content !== 'string') return null;

  const timestamp = new Date(message.timestamp as unknown as string);
  if (Number.isNaN(timestamp.getTime())) return null;
  if (message.type === 'rich' && !message.richContent) return null;
  if (message.type === 'clarification' && !message.clarificationData) return null;

  return { ...message, timestamp } as ConversationMessage;
}

export function parseConversationState(raw: string | null): PersistedConversationState {
  if (!raw) return { ...EMPTY_CONVERSATION };
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedConversationState>;
    if (!Array.isArray(parsed.messages)) return { ...EMPTY_CONVERSATION };
    const messages = parsed.messages.map(reviveMessage).filter((message): message is ConversationMessage => message !== null);
    const context = parsed.context === null || parsed.context === undefined
      ? null
      : isContext(parsed.context) ? parsed.context : null;
    return {
      messages,
      context,
      isAnsweringClarification: parsed.isAnsweringClarification === true && context !== null,
    };
  } catch {
    return { ...EMPTY_CONVERSATION };
  }
}

export function loadConversation(storage: Pick<Storage, 'getItem'> = localStorage): PersistedConversationState {
  return parseConversationState(storage.getItem(CONVERSATION_STORAGE_KEY));
}

export function saveConversation(
  state: PersistedConversationState,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  try {
    storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[Atlas AI] Konuşma kaydedilemedi', error);
  }
}

export function clearConversation(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  try {
    storage.removeItem(CONVERSATION_STORAGE_KEY);
  } catch (error) {
    console.error('[Atlas AI] Konuşma kaydı temizlenemedi', error);
  }
}