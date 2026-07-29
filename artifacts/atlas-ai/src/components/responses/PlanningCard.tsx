import { motion } from 'framer-motion';
import { MapPin, Clock, CheckCircle2 } from 'lucide-react';
import type { PlanningData } from '@/lib/intent-router';

interface Props {
  data: PlanningData;
  onReset: () => void;
}

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.13, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const PHASE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

export function PlanningCard({ data, onReset }: Props) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="w-full max-w-3xl mx-auto space-y-5"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{data.goal}</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Eylem Planı</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5 flex-shrink-0">
          <Clock className="w-3 h-3 text-primary" />
          {data.totalDuration}
        </div>
      </motion.div>

      {/* Phases timeline */}
      <motion.div variants={item} className="space-y-3">
        {data.phases.map((phase, pi) => (
          <motion.div
            key={pi}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + pi * 0.12, duration: 0.5 }}
            className="bg-card border border-border rounded-2xl p-6"
            data-testid={`phase-${pi}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-background flex-shrink-0"
                  style={{ background: PHASE_COLORS[pi % PHASE_COLORS.length] }}
                >
                  {pi + 1}
                </div>
                <span className="text-sm font-semibold text-foreground">{phase.name}</span>
              </div>
              <span className="text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1">
                {phase.duration}
              </span>
            </div>

            <div className="space-y-2 pl-9">
              {phase.tasks.map((task, ti) => (
                <motion.div
                  key={ti}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + pi * 0.12 + ti * 0.06, duration: 0.4 }}
                  className="flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground leading-relaxed">{task}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tips */}
      {data.successTips.length > 0 && (
        <motion.div variants={item} className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">
            Başarı İpuçları
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {data.successTips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="text-primary flex-shrink-0 font-bold">→</span>
                {tip}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="flex justify-center pt-2">
        <button onClick={onReset} className="text-sm text-muted-foreground hover:text-primary transition-colors underline decoration-dashed underline-offset-4" data-testid="button-new-question">
          Yeni Soru Sor
        </button>
      </motion.div>
    </motion.div>
  );
}
