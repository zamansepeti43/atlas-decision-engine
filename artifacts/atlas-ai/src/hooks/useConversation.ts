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
import { handleAssistantAction } from '@/lib/assistant-actions';
import { runIzciCheck } from '@/lib/assistant-store';
import { addDecisionHistory } from '@/lib/decision-history';

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

function uid(): string { return Math.random().toString(36).slice(2, 10); }

export function useConversation() {
  const [state, setState] = useState<ConversationState>(() => ({ ...INITIAL_STATE, ...loadConversation() }));
  const [memory, setMemory] = useState<UserMemory>(getMemory);
  const stateRef = useRef(state);
  const memoryRef = useRef(memory);
  const sendingRef = useRef(false);
  const skipNextPersistenceRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
    if (skipNextPersistenceRef.current) { skipNextPersistenceRef.current = false; return; }
    saveConversation({ messages: state.messages, context: state.context, isAnsweringClarification: state.isAnsweringClarification });
  }, [state]);

  useEffect(() => { memoryRef.current = memory; }, [memory]);
  useEffect(() => { runIzciCheck(); }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;
    const current = stateRef.current;
    const userMsg: ConversationMessage = { id: uid(), role: 'user', type: 'text', content: trimmed, timestamp: new Date() };
    setState((prev) => ({ ...prev, messages: [...prev.messages, userMsg], isThinking: true, error: null }));

    try {
      const assistantAction = handleAssistantAction(trimmed);
      if (assistantAction.handled) {
        const atlasMsg: ConversationMessage = { id: uid(), role: 'atlas', type: 'text', content: assistantAction.reply ?? 'İşlem tamamlandı.', timestamp: new Date() };
        setState((prev) => ({ ...prev, messages: [...prev.messages, atlasMsg], isThinking: false, error: null, isAnsweringClarification: false }));
        return;
      }

      const history = buildConversationHistoryFromMessages(current.messages);
      const result = await processUserTurn(trimmed, current.context, current.isAnsweringClarification, memoryRef.current, history);

      if (result.type === 'clarification') {
        const atlasMsg: ConversationMessage = { id: uid(), role: 'atlas', type: 'clarification', content: result.content.intro, clarificationData: result.content, timestamp: new Date() };
        setState((prev) => ({ ...prev, messages: [...prev.messages, atlasMsg], isThinking: false, context: result.context, isAnsweringClarification: true }));
      } else {
        const atlasMsg: ConversationMessage = { id: uid(), role: 'atlas', type: 'rich', content: '', richContent: result.data, timestamp: new Date() };
        setState((prev) => ({ ...prev, messages: [...prev.messages, atlasMsg], isThinking: false, context: result.context, isAnsweringClarification: false }));

        if ('metadata' in result.data) {
          const metadata = result.data.metadata;
          if (memoryRef.current.permissionGranted) {
            const updatedMemory = applyMemoryCandidates(metadata.memoryCandidates);
            memoryRef.current = updatedMemory;
            setMemory(updatedMemory);
          }
          if (metadata.decision) {
            addDecisionHistory({
              question: trimmed,
              intent: result.data.intent,
              summary: metadata.decision.summary,
              confidence: metadata.decision.confidence,
            });
          }
        }
      }
    } catch (err) {
      console.error('[Atlas AI] processUserTurn failed:', err);
      const userMessage = err instanceof AtlasUserSafeError ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.';
      setState((prev) => ({ ...prev, isThinking: false, error: userMessage }));
    } finally {
      sendingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    sendingRef.current = false;
    stateRef.current = INITIAL_STATE;
    skipNextPersistenceRef.current = true;
    clearConversation();
    setState(INITIAL_STATE);
  }, []);

  const handleClearMemory = useCallback(() => { const cleared = clearMemory(); memoryRef.current = cleared; setMemory(cleared); }, []);
  const handleGrantMemory = useCallback(() => { const updated = grantMemoryPermission(); memoryRef.current = updated; setMemory(updated); }, []);
  const handleRevokeMemory = useCallback(() => { const updated = revokeMemoryPermission(); memoryRef.current = updated; setMemory(updated); }, []);

  return { messages: state.messages, isThinking: state.isThinking, isAnsweringClarification: state.isAnsweringClarification, error: state.error, sendMessage, reset, memory, clearMemory: handleClearMemory, grantMemory: handleGrantMemory, revokeMemory: handleRevokeMemory };
}
