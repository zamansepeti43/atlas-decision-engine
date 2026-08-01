import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { detectIntentSync, processQuery, type AtlasResponseData, type IntentDetectionResult, type ChatHistoryEntry } from '@/lib/intent-router';
import { AnalysisReport } from '@/components/AnalysisReport';
import { ConversationCard } from '@/components/responses/ConversationCard';
import { LearningCard } from '@/components/responses/LearningCard';
import { WritingCard } from '@/components/responses/WritingCard';
import { ResearchCard } from '@/components/responses/ResearchCard';
import { PlanningCard } from '@/components/responses/PlanningCard';
import { ProblemSolvingCard } from '@/components/responses/ProblemSolvingCard';
import { LoadingState } from '@/components/LoadingState';
import { getMemory, grantMemoryPermission, type UserMemory } from '@/lib/memory';
import { memorySnapshot } from '@/lib/memory';

const CHAT_HISTORY_STORAGE_KEY = 'atlas_chat_history_v1';
const CHAT_ARCHIVE_STORAGE_KEY = 'atlas_chat_archive_v1';

const PLACEHOLDER_EXAMPLES = [
  '40.000 TL bütçem var. Hangi telefonu almalıyım?',
  'Yapay zeka nedir? Nasıl çalışır?',
  '6 ayda İngilizce öğrenme planı yap',
  'İş arkadaşıma veda e-postası yaz',
  'Elektrikli araba mı yoksa hybrid mi almalıyım?',
  'Python programlama dili hakkında araştırma yap',
  'Kariyer değişikliği için adım adım rehber',
];

const INTENT_LABELS: Record<string, string> = {
  conversation: 'Sohbet',
  decision: 'Karar Analizi',
  learning: 'Öğrenme',
  writing: 'Yazı Asistanı',
  research: 'Araştırma',
  planning: 'Planlama',
  'problem-solving': 'Problem Çözümü',
};

export default function Home() {
  console.log("HOME COMPONENT RENDER EDILDI");
  const [question, setQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<AtlasResponseData | null>(null);
  const [intentPreview, setIntentPreview] = useState<IntentDetectionResult | null>(null);
  const [activeLoadingConfig, setActiveLoadingConfig] = useState<IntentDetectionResult | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);
  const [memory, setMemory] = useState<UserMemory>(getMemory);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotate placeholder text
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Live intent preview while typing
  useEffect(() => {
    if (!question.trim() || question.length < 8) {
      setIntentPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      setIntentPreview(detectIntentSync(question));
    }, 350);
    return () => clearTimeout(timer);
  }, [question]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatHistoryEntry[];
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch {
      // ignore storage issues
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore storage issues
    }
  }, [history]);

  const memoryLines = memorySnapshot(memory);

  const handleSubmit = async () => {
    if (!question.trim() || isProcessing) return;

    const detected = detectIntentSync(question);
    const nextUserTurn: ChatHistoryEntry = { role: 'user', content: question };
    const nextHistory = [...history, nextUserTurn];

    setActiveLoadingConfig(detected);
    setIsProcessing(true);
    setResponse(null);

    try {
      const result = await processQuery(question, nextHistory, memoryLines.join('\n'));
      const assistantContent = result.intent === 'conversation'
        ? result.data.message
        : JSON.stringify(result.data);
      const nextAssistantTurn: ChatHistoryEntry = { role: 'assistant', content: assistantContent };
      setHistory([...nextHistory, nextAssistantTurn]);
      setResponse(result);

      if (!memory.permissionGranted) {
        const granted = grantMemoryPermission();
        setMemory(granted);
      }
    } catch (err) {
      console.error('Atlas AI error:', err);
    } finally {
      setIsProcessing(false);
      setQuestion('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleReset = () => {
    if (history.length > 0) {
      try {
        const archive = JSON.parse(localStorage.getItem(CHAT_ARCHIVE_STORAGE_KEY) ?? '[]') as ChatHistoryEntry[][];
        localStorage.setItem(CHAT_ARCHIVE_STORAGE_KEY, JSON.stringify([...archive, history]));
      } catch {
        // ignore storage issues
      }
    }

    setQuestion('');
    setResponse(null);
    setIntentPreview(null);
    setActiveLoadingConfig(null);
    setHistory([]);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleFollowUp = (q: string) => {
    setQuestion(q);
    setResponse(null);
    setIntentPreview(null);
    setTimeout(() => handleSubmitWith(q), 50);
  };

  const handleSubmitWith = async (q: string) => {
    const detected = detectIntentSync(q);
    const nextUserTurn: ChatHistoryEntry = { role: 'user', content: q };
    const nextHistory = [...history, nextUserTurn];

    setActiveLoadingConfig(detected);
    setIsProcessing(true);
    try {
      const result = await processQuery(q, nextHistory, memoryLines.join('\n'));
      const assistantContent = result.intent === 'conversation'
        ? result.data.message
        : JSON.stringify(result.data);
      const nextAssistantTurn: ChatHistoryEntry = { role: 'assistant', content: assistantContent };
      setHistory([...nextHistory, nextAssistantTurn]);
      setResponse(result);
    } catch (err) {
      console.error('Atlas AI error:', err);
    } finally {
      setIsProcessing(false);
      setQuestion('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const showInput = !response && !isProcessing;
  const showLoading = isProcessing;
  const showResponse = !!response && !isProcessing;

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">
        <AnimatePresence mode="wait">

          {/* ── Input view ── */}
          {showInput && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="max-w-3xl mx-auto"
            >
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="text-center mb-16"
              >
                <h1 className="text-5xl md:text-7xl font-serif font-bold mb-4">
                  <span className="text-foreground">Atlas</span>{' '}
                  <span className="text-primary" style={{ textShadow: '0 0 30px hsl(var(--primary) / 0.3)' }}>
                    AI
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground font-light tracking-wide">
                  Seninle birlikte düşünen, konuşmaya devam eden bir düşünce ortağı
                </p>
              </motion.div>

              {memoryLines.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-8 rounded-2xl border border-primary/20 bg-card/70 p-4 text-sm text-muted-foreground"
                >
                  <p className="mb-2 font-semibold text-foreground">Atlas hafızası</p>
                  <ul className="space-y-1">
                    {memoryLines.map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {history.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4"
                >
                  {history.map((entry, index) => (
                    <div
                      key={`${entry.role}-${index}`}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${entry.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'}`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                        {entry.role === 'user' ? 'Sen' : 'Atlas'}
                      </p>
                      <p className="mt-1">{entry.content}</p>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Input */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                className="space-y-4"
              >
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={PLACEHOLDER_EXAMPLES[placeholderIdx]}
                    className="w-full min-h-[160px] bg-card/50 backdrop-blur-sm border-2 border-border rounded-2xl px-6 py-5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all duration-300 resize-none text-lg leading-relaxed"
                    data-testid="input-question"
                    autoFocus
                  />

                  {/* Live intent badge */}
                  <AnimatePresence>
                    {intentPreview && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-4 right-4 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border"
                        style={{
                          background: 'hsl(var(--primary) / 0.08)',
                          borderColor: 'hsl(var(--primary) / 0.3)',
                          color: 'hsl(var(--primary))',
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {INTENT_LABELS[intentPreview.intent] ?? intentPreview.intent}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  onClick={handleSubmit}
                  disabled={!question.trim()}
                  className="w-full py-5 rounded-2xl font-semibold text-lg text-primary-foreground bg-gradient-to-r from-primary via-chart-2 to-primary transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group"
                  whileHover={{ scale: question.trim() ? 1.015 : 1 }}
                  whileTap={{ scale: question.trim() ? 0.98 : 1 }}
                  data-testid="button-submit"
                  style={{ backgroundSize: '200% 100%' }}
                >
                  <span className="relative z-10">Atlas'a Sor</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                </motion.button>

                {/* Intent hint row */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center gap-3 flex-wrap"
                >
                  {Object.entries(INTENT_LABELS).map(([key, label]) => (
                    <span key={key} className="text-xs text-muted-foreground/40">
                      {label}
                    </span>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {/* ── Loading view ── */}
          {showLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto"
            >
              {/* Compact header */}
              <div className="text-center mb-12">
                <h1 className="text-3xl md:text-4xl font-serif font-bold mb-1">
                  <span className="text-foreground">Atlas</span>{' '}
                  <span className="text-primary">AI</span>
                </h1>
                {activeLoadingConfig && (
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {INTENT_LABELS[activeLoadingConfig.intent]}
                  </p>
                )}
              </div>
              <LoadingState
                loadingText={activeLoadingConfig?.loadingText}
                steps={activeLoadingConfig?.loadingSteps}
              />
            </motion.div>
          )}

          {/* ── Response view ── */}
          {showResponse && response && (
            <motion.div
              key="response"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Compact header */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-10"
              >
                <h1 className="text-3xl md:text-4xl font-serif font-bold mb-1">
                  <span className="text-foreground">Atlas</span>{' '}
                  <span className="text-primary">AI</span>
                </h1>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  {INTENT_LABELS[response.intent] ?? response.intent}
                </p>
              </motion.div>

              <div className="mb-6 rounded-2xl border border-border/80 bg-card/70 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Sohbet akışı</p>
                <p className="mt-1">Atlas önceki mesajlarını hatırlıyor ve bir sonraki cevapta geçmişi kullanıyor.</p>
              </div>

              {history.length > 0 && (
                <div className="mb-6 space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4">
                  {history.map((entry, index) => (
                    <div
                      key={`${entry.role}-${index}`}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${entry.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'}`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                        {entry.role === 'user' ? 'Sen' : 'Atlas'}
                      </p>
                      <p className="mt-1">{entry.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Route to correct card */}
              {response.intent === 'decision' && (
                <AnalysisReport result={response.data} onReset={handleReset} />
              )}
              {response.intent === 'conversation' && (
                <ConversationCard data={response.data} onFollowUp={handleFollowUp} onReset={handleReset} />
              )}
              {response.intent === 'learning' && (
                <LearningCard data={response.data} onFollowUp={handleFollowUp} onReset={handleReset} />
              )}
              {response.intent === 'writing' && (
                <WritingCard data={response.data} onReset={handleReset} />
              )}
              {response.intent === 'research' && (
                <ResearchCard data={response.data} onReset={handleReset} />
              )}
              {response.intent === 'planning' && (
                <PlanningCard data={response.data} onReset={handleReset} />
              )}
              {response.intent === 'problem-solving' && (
                <ProblemSolvingCard data={response.data} onReset={handleReset} />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
