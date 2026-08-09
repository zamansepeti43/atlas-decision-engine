import { useState, useCallback, useEffect, useRef } from 'react';
import {
  processUserTurn,
  buildConversationHistoryFromMessages,
  type ConversationMessage,
  type CollectedContext,
} from '@/lib/conversation-engine';
import { AtlasUserSafeError } from '@/lib/intent-router';
import {
  getMemory,
  applyMemoryCandidates,
  clearMemory,
  grantMemoryPermission,
  revokeMemoryPermission,
  type UserMemory,
} from '@/lib/memory';
import { clearConversation, loadConversation, saveConversation } from '@/lib/conversation-storage';

// ─── State ────────────────────────────────────────────────────────────────────

interface ConversationState {
  messages: ConversationMessage[];
  isThinking: boolean;
  context: CollectedContext | null;
  isAnsweringClarification: boolean;
  error: string | null;
}

const INITIAL_STATE: ConversationState = {
  messages: [],
  isThinking: false,
  context: null,
  isAnsweringClarification: false,
  error: null,
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversation() {
  const [state, setState] = useState<ConversationState>(() => ({
    ...INITIAL_STATE,
    ...loadConversation(),
  }));
  const [memory, setMemory] = useState<UserMemory>(getMemory);
  const stateRef = useRef(state);
  const memoryRef = useRef(memory);
  const sendingRef = useRef(false);
  const skipNextPersistenceRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
    if (skipNextPersistenceRef.current) {
      skipNextPersistenceRef.current = false;
      return;
    }
    saveConversation({
      messages: state.messages,
      context: state.context,
      isAnsweringClarification: state.isAnsweringClarification,
    });
  }, [state]);

  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  /**
   * Send any user message (first question OR clarification answer).
   * Automatically determines context and routes to the engine.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;
      sendingRef.current = true;
      const current = stateRef.current;

      // 1. Optimistically add user message + start thinking
      const userMsg: ConversationMessage = {
        id: uid(),
        role: 'user',
        type: 'text',
        content: trimmed,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        isThinking: true,
        error: null,
      }));

      try {
        const history = buildConversationHistoryFromMessages(current.messages);

        const result = await processUserTurn(
          trimmed,
          current.context,
          current.isAnsweringClarification,
          memoryRef.current,
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

          if (memoryRef.current.permissionGranted && 'metadata' in result.data) {
            const updatedMemory = applyMemoryCandidates(result.data.metadata.memoryCandidates);
            memoryRef.current = updatedMemory;
            setMemory(updatedMemory);
          }
        }
      } catch (err) {
        console.error('[Atlas AI] processUserTurn failed:', err);
        const userMessage = err instanceof AtlasUserSafeError
          ? err.message
          : 'Bir hata oluştu. Lütfen tekrar deneyin.';
        setState((prev) => ({
          ...prev,
          isThinking: false,
          error: userMessage,
        }));
      } finally {
        sendingRef.current = false;
      }
    },
    []
  );

  /** Reset the conversation (keeps memory). */
  const reset = useCallback(() => {
    sendingRef.current = false;
    stateRef.current = INITIAL_STATE;
    skipNextPersistenceRef.current = true;
    clearConversation();
    setState(INITIAL_STATE);
  }, []);

  /** Wipe all persisted memory. */
  const handleClearMemory = useCallback(() => {
    const cleared = clearMemory();
    memoryRef.current = cleared;
    setMemory(cleared);
  }, []);

  /** Grant permission to persist long-term context. */
  const handleGrantMemory = useCallback(() => {
    const updated = grantMemoryPermission();
    memoryRef.current = updated;
    setMemory(updated);
  }, []);

  const handleRevokeMemory = useCallback(() => {
    const updated = revokeMemoryPermission();
    memoryRef.current = updated;
    setMemory(updated);
  }, []);

  return {
    messages: state.messages,
    isThinking: state.isThinking,
    isAnsweringClarification: state.isAnsweringClarification,
    error: state.error,
    sendMessage,
    reset,
    memory,
    clearMemory: handleClearMemory,
    grantMemory: handleGrantMemory,
    revokeMemory: handleRevokeMemory,
  };
}
