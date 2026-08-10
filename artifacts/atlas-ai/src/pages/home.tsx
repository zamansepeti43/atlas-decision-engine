import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoaderCircle, MemoryStick, RotateCcw, Send, Trash2 } from 'lucide-react';
import { ClarificationCard } from '@/components/chat/ClarificationCard';
import { EmptyState } from '@/components/chat/EmptyState';
import { GroundedResults } from '@/components/chat/GroundedResults';
import { useConversation } from '@/hooks/useConversation';
import { detectIntentSync, type AtlasResponseData } from '@/lib/intent-router';
import { memorySnapshot } from '@/lib/memory';

const PLACEHOLDERS = [
  '40.000 TL bütçem var. Hangi telefonu almalıyım?',
  'Yapay zeka nedir? Nasıl çalışır?',
  '6 ayda İngilizce öğrenme planı yap',
  'Elektrikli araba mı yoksa hibrit mi almalıyım?',
];

const INTENT_LABELS: Record<string, string> = {
  conversation: 'Sohbet', decision: 'Karar Analizi', learning: 'Öğrenme',
  writing: 'Yazı Asistanı', research: 'Araştırma', planning: 'Planlama',
  'problem-solving': 'Problem Çözümü',
};

type BackendResponse = Extract<AtlasResponseData, { kind: 'backend' }>;

function isBackendResponse(response: AtlasResponseData | undefined): response is BackendResponse {
  return Boolean(response && 'kind' in response && response.kind === 'backend');
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const conversation = useConversation();

  useEffect(() => {
    const timer = window.setInterval(() => setPlaceholderIndex((index) => (index + 1) % PLACEHOLDERS.length), 3500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation.messages, conversation.isThinking]);

  const submit = (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || conversation.isThinking) return;
    setQuestion('');
    void conversation.sendMessage(trimmed);
    window.setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const intentPreview = question.trim().length >= 8 ? detectIntentSync(question) : null;
  const memoryLines = memorySnapshot(conversation.memory);

  return (
    <main className="min-h-[100dvh] w-full bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-6 md:px-8 md:py-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-5">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="Atlas" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
            <div><h1 className="font-serif text-2xl font-bold">Atlas <span className="text-primary">AI</span></h1><p className="text-xs text-muted-foreground">Birlikte düşünen karar asistanı</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={conversation.memory.permissionGranted ? conversation.revokeMemory : conversation.grantMemory} aria-pressed={conversation.memory.permissionGranted} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
              <MemoryStick className="h-3.5 w-3.5" aria-hidden="true" />
              {conversation.memory.permissionGranted ? 'Hafızayı devre dışı bırak' : 'Hafızayı etkinleştir'}
            </button>
            <button type="button" onClick={conversation.clearMemory} aria-label="Uzun süreli hafızayı temizle" title="Uzun süreli hafızayı temizle" className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" onClick={conversation.reset} aria-label="Sohbeti sıfırla" title="Sohbeti sıfırla" className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-primary"><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </header>

        {conversation.memory.permissionGranted && memoryLines.length > 0 && (
          <aside className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground" aria-label="Atlas hafızası">
            <span className="font-semibold text-foreground">Atlas hafızası: </span>{memoryLines.join(' · ')}
          </aside>
        )}

        <section className="flex-1" aria-label="Sohbet">
          {conversation.messages.length === 0 ? <EmptyState onSuggestion={submit} /> : (
            <div className="mx-auto max-w-3xl space-y-5 pb-8" aria-live="polite">
              {conversation.messages.map((message) => {
                const response = isBackendResponse(message.richContent) ? message.richContent : null;
                return (
                  <motion.article key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={message.role === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto w-full max-w-[92%]'}>
                    <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{message.role === 'user' ? 'Sen' : 'Atlas'}</p>
                    <div className={message.role === 'user' ? 'rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground' : 'rounded-2xl rounded-bl-sm border border-border bg-card px-5 py-4 text-sm leading-relaxed text-card-foreground'}>
                      {message.type === 'clarification' && message.clarificationData ? (
                        <ClarificationCard data={message.clarificationData} onQuickAnswer={submit} />
                      ) : response ? (
                        <>
                          <p className="whitespace-pre-wrap">{response.data.message}</p>
                          <GroundedResults metadata={response.metadata} />
                          {response.data.followUps.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{response.data.followUps.map((followUp) => <button key={followUp} type="button" onClick={() => submit(followUp)} className="rounded-full border border-primary/30 px-3 py-2 text-xs text-primary hover:bg-primary/10">{followUp}</button>)}</div>}
                        </>
                      ) : <p className="whitespace-pre-wrap">{message.content}</p>}
                    </div>
                  </motion.article>
                );
              })}
              <AnimatePresence>{conversation.isThinking && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 text-sm text-muted-foreground" role="status"><LoaderCircle className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />Atlas yanıt hazırlıyor</motion.div>}</AnimatePresence>
              <div ref={endRef} />
            </div>
          )}
        </section>

        {conversation.error && <div className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{conversation.error}</div>}

        <div className="sticky bottom-0 mx-auto w-full max-w-3xl border-t border-border/70 bg-background/95 py-4 backdrop-blur">
          <div className="relative">
            <label htmlFor="atlas-question" className="sr-only">Atlas'a mesaj yaz</label>
            <textarea id="atlas-question" ref={textareaRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={PLACEHOLDERS[placeholderIndex]} disabled={conversation.isThinking} rows={3} className="w-full resize-none rounded-2xl border-2 border-border bg-card/90 px-5 py-4 pr-16 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none disabled:opacity-60" data-testid="input-question" />
            <button type="button" onClick={() => submit()} disabled={!question.trim() || conversation.isThinking} aria-label="Mesajı gönder" className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-submit"><Send className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          {intentPreview && <div className="mt-2 px-1 text-right text-xs text-muted-foreground/60">{INTENT_LABELS[intentPreview.intent]}</div>}
        </div>
      </div>
    </main>
  );
}
