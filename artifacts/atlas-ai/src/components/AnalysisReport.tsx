import { motion } from 'framer-motion';
import { Check, X, Sparkles, Shield } from 'lucide-react';
import { ScoreRing } from './ScoreRing';
import type { AnalysisResult } from '@/lib/atlas-ai';

interface AnalysisReportProps {
  result: AnalysisResult;
  onReset: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function confidenceLabel(level: number): { label: string; color: string } {
  if (level >= 88) return { label: 'Çok Yüksek', color: 'text-emerald-400' };
  if (level >= 72) return { label: 'Yüksek', color: 'text-primary' };
  if (level >= 55) return { label: 'Orta', color: 'text-amber-400' };
  return { label: 'Düşük', color: 'text-red-400' };
}

export function AnalysisReport({ result, onReset }: AnalysisReportProps) {
  const confidence = confidenceLabel(result.confidenceLevel);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* Top row: Score + Recommendation */}
      <div className="grid md:grid-cols-[auto_1fr] gap-6 items-stretch">
        {/* Atlas Score */}
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-4"
        >
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Atlas Skoru
          </div>
          <ScoreRing score={result.score} size={180} />
        </motion.div>

        {/* Recommendation */}
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-2xl p-8 relative overflow-hidden flex flex-col justify-between gap-6"
        >
          <div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
            }}
          />
          <div>
            <div className="text-xs uppercase tracking-widest text-primary mb-4 font-semibold">
              Öneri
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-foreground leading-snug">
              {result.recommendation}
            </div>
          </div>

          {/* Confidence Level — lives inside recommendation card */}
          <div className="pt-5 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                <Shield className="w-3.5 h-3.5" />
                Güven Seviyesi
              </div>
              <span className={`text-sm font-bold ${confidence.color}`}>
                {confidence.label} — {result.confidenceLevel}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${result.confidenceLevel}%` }}
                transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
                style={{
                  background:
                    result.confidenceLevel >= 88
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : result.confidenceLevel >= 72
                        ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--chart-2)))'
                        : result.confidenceLevel >= 55
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #ef4444, #f87171)',
                }}
              />
            </div>

            <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
              Bu öneri, mevcut veriler ve kriterleriniz doğrultusunda{' '}
              <span className={`font-medium ${confidence.color}`}>
                {result.confidenceLevel}% güven skoru
              </span>{' '}
              ile oluşturulmuştur.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Advantages & Disadvantages */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <div className="text-xs uppercase tracking-widest text-primary mb-5 font-semibold">
            Avantajlar
          </div>
          <div className="space-y-3.5">
            {result.advantages.map((advantage, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.09, duration: 0.4 }}
                className="flex gap-3 items-start"
                data-testid={`advantage-item-${index}`}
              >
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary" strokeWidth={3} />
                </div>
                <span className="text-sm text-card-foreground leading-relaxed">
                  {advantage}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-5 font-semibold">
            Dezavantajlar
          </div>
          <div className="space-y-3.5">
            {result.disadvantages.map((disadvantage, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.09, duration: 0.4 }}
                className="flex gap-3 items-start"
                data-testid={`disadvantage-item-${index}`}
              >
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center">
                  <X className="w-3 h-3 text-destructive/70" strokeWidth={3} />
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {disadvantage}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Alternatives */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">
          Alternatifler
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {result.alternatives.map((alt, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + index * 0.1, duration: 0.45 }}
              className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-all duration-300 cursor-pointer group"
              data-testid={`alternative-card-${index}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                  {alt.name}
                </div>
                <div
                  className="text-xs font-bold text-primary px-2.5 py-1 rounded-md flex-shrink-0 ml-2"
                  style={{ background: 'hsl(var(--primary) / 0.12)' }}
                >
                  {alt.score}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {alt.description}
              </p>
              {/* Mini score bar */}
              <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${alt.score}%` }}
                  transition={{
                    delay: 1 + index * 0.1,
                    duration: 0.8,
                    ease: 'easeOut',
                  }}
                  style={{
                    background:
                      'linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--primary)))',
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Reasoning */}
      <motion.div
        variants={itemVariants}
        className="relative bg-card border border-border rounded-2xl p-8 overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top right, hsl(var(--primary) / 0.05) 0%, transparent 60%)',
          }}
        />
        <div className="text-xs uppercase tracking-widest text-primary mb-4 font-semibold relative">
          Neden Bu Öneri?
        </div>
        <p className="text-base text-card-foreground leading-relaxed relative">
          {result.reasoning}
        </p>
      </motion.div>

      {/* Reset */}
      <motion.div
        variants={itemVariants}
        className="flex justify-center pt-4 pb-8"
      >
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-primary transition-colors underline decoration-dashed underline-offset-4"
          data-testid="button-new-question"
        >
          Yeni Soru Sor
        </button>
      </motion.div>
    </motion.div>
  );
}
