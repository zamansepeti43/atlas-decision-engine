import { useEffect, useSyncExternalStore } from 'react';
import { getAssistantState, runIzciCheck, subscribeAssistantState } from '@/lib/assistant-store';

export function useAssistantState() {
  const state = useSyncExternalStore(subscribeAssistantState, getAssistantState, getAssistantState);

  useEffect(() => {
    runIzciCheck();
  }, []);

  return state;
}
