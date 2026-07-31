import { useState, useCallback } from 'react';
import {
  processUserTurn,
  buildConversationHistoryFromMessages,
  type ConversationMessage,
  type CollectedContext,
} from '@/lib/conversation-engine';
import { detectIntentSync } from '@/lib/intent-router';
import { getMemory, extractAndSave, clearMemory, grantMemoryPermission, type UserMemory } from '@/lib/memory';

// ─── State ────────────────────────────────────────────────────────────────────

interface ConversationState {
  messages: ConversationMessage[];
  isThinking: boolean;
  context: CollectedContext | null;
  isAnsweringClarification: boolean;
}

const INITIAL_STATE: ConversationState = {
  messages: [],
  isThinking: false,
  context: null,
  isAnsweringClarification: false,
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversation() {
  const [state, setState] = useState<ConversationState>(INITIAL_STATE);
  const [memory, setMemory] = useState<UserMemory>(getMemory);

  /**
   * Send any user message (first question OR clarification answer).
   * Automatically determines context and routes to the engine.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || state.isThinking) return;

      // 1. Optimistically add user message + start thinking
      const userMsg: ConversationMessage = {
        id: uid(),
        role: 'user',
        type: 'text',
        content: text,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        isThinking: true,
      }));

      try {
        const history = buildConversationHistoryFromMessages([...state.messages, userMsg]);

        const result = await processUserTurn(
          text,
          state.context,
          state.isAnsweringClarification,
          memory,
          history
        );

        if (result.type === 'clarification') {
          // Atlas needs more info → show clarification card
          const atlasMsg: ConversationMessage = {
            id: uid(),
            role: 'atlas',
            type: 'clarification',
            content: result.content.intro,
            clarificationData: result.content,
            timestamp: new Date(),
          };
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, atlasMsg],
            isThinking: false,
            context: result.context,
            isAnsweringClarification: true,
          }));
        } else {
          // Atlas has a full response
          const atlasMsg: ConversationMessage = {
            id: uid(),
            role: 'atlas',
            type: 'rich',
            content: '',
            richContent: result.data,
            timestamp: new Date(),
          };
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, atlasMsg],
            isThinking: false,
            context: result.context,
            isAnsweringClarification: false,
          }));

          // Persist saveable facts to memory (if permitted)
          if (memory.permissionGranted) {
            const ctx = result.context;
            extractAndSave({
              budget: ctx.budget,
              location: ctx.location,
              topic: ctx.originalQuestion.slice(0, 40),
            });
            setMemory(getMemory());
          }
        }
      } catch (err) {
        console.error('[Atlas AI] processUserTurn failed:', err);
        const errMsg: ConversationMessage = {
          id: uid(),
          role: 'atlas',
          type: 'text',
          content: 'Bir hata oluştu. Lütfen tekrar deneyin.',
          timestamp: new Date(),
        };
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, errMsg],
          isThinking: false,
        }));
      }
    },
    [state, memory]
  );

  /** Reset the conversation (keeps memory). */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /** Wipe all persisted memory. */
  const handleClearMemory = useCallback(() => {
    const cleared = clearMemory();
    setMemory(cleared);
  }, []);

  /** Grant permission to persist long-term context. */
  const handleGrantMemory = useCallback(() => {
    const updated = grantMemoryPermission();
    setMemory(updated);
  }, []);

  return {
    messages: state.messages,
    isThinking: state.isThinking,
    isAnsweringClarification: state.isAnsweringClarification,
    sendMessage,
    reset,
    memory,
    clearMemory: handleClearMemory,
    grantMemory: handleGrantMemory,
  };
}
