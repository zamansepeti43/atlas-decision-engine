import { motion } from 'framer-motion';
import { Zap, AlertTriangle } from 'lucide-react';
import type { ProblemSolvingData } from '@/lib/intent-router';

interface Props {
  data: ProblemSolvingData;
  onReset: () => void;
}

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.13, delayChildren: 0.05 } },
} satisfies Record<string, unknown>;
const item = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
} satisfies Record<string, unknown>;

const EFFORT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'Düşük': { label: 'Düşük Efor', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  'Orta': { label: 'Orta Efor', color: 'text-primary', bg: 'bg-primary/10' },
  'Yüksek': { label: 'Yüksek Efor', color: 'text-amber-400', bg: 'bg-amber-400/10' },
};

export function ProblemSolvingCard({ data, onReset }: Props) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="w-full max-w-3xl mx-auto space-y-5"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{data.problemStatement}</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Problem Çözümü</p>
        </div>
      </motion.div>

      {/* Quick fix banner */}
      <motion.div
        variants={item}
        className="flex items-start gap-3 bg-primary/8 border border-primary/25 rounded-2xl px-5 py-4"
      >
        <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-1">Hızlı Çözüm</p>
          <p className="text-sm text-foreground">{data.quickFix}</p>
        </div>
      </motion.div>

      {/* Diagnosis */}
      <motion.div variants={item} className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Teşhis</p>
            <p className="text-sm text-card-foreground leading-relaxed">{data.diagnosis}</p>
          </div>
        </div>
      </motion.div>

      {/* Solutions */}
      <motion.div variants={item} className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">
          Çözüm Adımları
        </p>
        {data.solutions.map((sol, si) => {
          const effortCfg = EFFORT_CONFIG[sol.effort] ?? EFFORT_CONFIG['Orta'];
          return (
            <motion.div
              key={si}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + si * 0.12, duration: 0.5 }}
              className="bg-card border border-border rounded-2xl p-6"
              data-testid={`solution-${si}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-background flex-shrink-0"
                    style={{ background: 'hsl(var(--primary))' }}
                  >
                    {si + 1}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{sol.title}</span>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${effortCfg.color} ${effortCfg.bg}`}>
                  {effortCfg.label}
                </span>
              </div>

              <div className="space-y-2 pl-9">
                {sol.steps.map((step, sti) => (
                  <motion.div
                    key={sti}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + si * 0.12 + sti * 0.07, duration: 0.4 }}
                    className="flex items-start gap-2.5"
                  >
                    <span className="text-xs text-primary font-bold flex-shrink-0 mt-0.5 w-4">{sti + 1}.</span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div variants={item} className="flex justify-center pt-2">
        <button onClick={onReset} className="text-sm text-muted-foreground hover:text-primary transition-colors underline decoration-dashed underline-offset-4" data-testid="button-new-question">
          Yeni Soru Sor
        </button>
      </motion.div>
    </motion.div>
  );
}
