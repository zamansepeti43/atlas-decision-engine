import { motion } from 'framer-motion';
import { Check, X, Sparkles } from 'lucide-react';
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
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export function AnalysisReport({ result, onReset }: AnalysisReportProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-4xl mx-auto space-y-8"
    >
      {/* Atlas Score */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center justify-center py-12"
      >
        <div className="text-sm uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Atlas Skoru
        </div>
        <ScoreRing score={result.score} size={220} />
      </motion.div>

      {/* Recommendation */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded-xl p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="text-sm uppercase tracking-wider text-primary mb-4 font-semibold">
          Öneri
        </div>
        <div className="text-2xl md:text-3xl font-semibold text-foreground leading-tight">
          {result.recommendation}
        </div>
      </motion.div>

      {/* Advantages & Disadvantages Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Advantages */}
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="text-sm uppercase tracking-wider text-primary mb-6 font-semibold">
            Avantajlar
          </div>
          <div className="space-y-4">
            {result.advantages.map((advantage, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className="flex gap-3 items-start"
              >
                <div className="mt-0.5 flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" strokeWidth={3} />
                  </div>
                </div>
                <div className="text-sm text-card-foreground leading-relaxed">
                  {advantage}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Disadvantages */}
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="text-sm uppercase tracking-wider text-muted-foreground mb-6 font-semibold">
            Dezavantajlar
          </div>
          <div className="space-y-4">
            {result.disadvantages.map((disadvantage, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className="flex gap-3 items-start"
              >
                <div className="mt-0.5 flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
                    <X className="w-3 h-3 text-destructive/80" strokeWidth={3} />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {disadvantage}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Alternatives */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
          Alternatifler
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {result.alternatives.map((alternative, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + index * 0.1 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {alternative.name}
                </div>
                <div className="text-sm font-bold text-primary px-2 py-1 bg-primary/10 rounded">
                  {alternative.score}
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {alternative.description}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Reasoning */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-xl p-8"
      >
        <div className="text-sm uppercase tracking-wider text-primary mb-4 font-semibold">
          Neden Bu Öneri?
        </div>
        <div className="text-base text-card-foreground leading-relaxed">
          {result.reasoning}
        </div>
      </motion.div>

      {/* Reset Button */}
      <motion.div
        variants={itemVariants}
        className="flex justify-center pt-8"
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
