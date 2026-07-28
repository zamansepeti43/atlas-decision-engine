import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeDecision, type AnalysisResult } from '@/lib/atlas-ai';
import { AnalysisReport } from '@/components/AnalysisReport';
import { LoadingState } from '@/components/LoadingState';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!question.trim() || isAnalyzing) return;
    
    setIsAnalyzing(true);
    try {
      const analysisResult = await analyzeDecision(question);
      setResult(analysisResult);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setQuestion('');
    setResult(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden">
      {/* Ambient background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="input"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto"
            >
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-center mb-16"
              >
                <h1 className="text-5xl md:text-7xl font-serif font-bold mb-4">
                  <span className="text-foreground">Atlas</span>{' '}
                  <span
                    className="text-primary"
                    style={{
                      textShadow: '0 0 30px hsl(var(--primary) / 0.3)'
                    }}
                  >
                    AI
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground font-light tracking-wide">
                  Karar Vermeden Önce Atlas AI'a Sor
                </p>
              </motion.div>

              {/* Input Section */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="relative">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="40.000 TL bütçem var. Hangi telefonu almalıyım?"
                    className="w-full min-h-[180px] bg-card/50 backdrop-blur-sm border-2 border-border rounded-2xl px-6 py-5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all duration-300 resize-none text-lg leading-relaxed focus:gold-glow"
                    data-testid="input-question"
                    disabled={isAnalyzing}
                  />
                </div>

                <motion.button
                  onClick={handleAnalyze}
                  disabled={!question.trim() || isAnalyzing}
                  className="w-full py-5 rounded-2xl font-semibold text-lg text-primary-foreground bg-gradient-to-r from-primary via-chart-2 to-primary bg-size-200 hover:bg-pos-100 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  whileHover={{ scale: question.trim() && !isAnalyzing ? 1.02 : 1 }}
                  whileTap={{ scale: question.trim() && !isAnalyzing ? 0.98 : 1 }}
                  data-testid="button-analyze"
                  style={{
                    backgroundSize: '200% 100%',
                    backgroundPosition: '0% 0%'
                  }}
                >
                  <span className="relative z-10">
                    {isAnalyzing ? 'Analiz Ediliyor...' : 'Analiz Et'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                </motion.button>
              </motion.div>

              {/* Loading State */}
              <AnimatePresence>
                {isAnalyzing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-12"
                  >
                    <LoadingState />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="report"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Compact header for report view */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
              >
                <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">
                  <span className="text-foreground">Atlas</span>{' '}
                  <span className="text-primary">AI</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Analiz Raporu
                </p>
              </motion.div>

              <AnalysisReport result={result} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
