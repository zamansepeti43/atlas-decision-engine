import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import type { ResearchData } from '@/lib/intent-router';

interface Props {
  data: ResearchData;
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

export function ResearchCard({ data, onReset }: Props) {
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
          <Search className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{data.topic}</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Araştırma Raporu</p>
        </div>
      </motion.div>

      {/* Executive Summary */}
      <motion.div variants={item} className="relative bg-card border border-border rounded-2xl p-7 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / 0.05) 0%, transparent 60%)' }}
        />
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Yönetici Özeti</p>
        <p className="text-base text-card-foreground leading-relaxed">{data.executiveSummary}</p>
      </motion.div>

      {/* Findings */}
      <motion.div variants={item} className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">
          Temel Bulgular
        </p>
        <div className="space-y-3">
          {data.findings.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
              className="bg-card border border-border rounded-xl p-5 flex gap-4"
              data-testid={`finding-${i}`}
            >
              <div
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground"
                style={{ background: 'hsl(var(--primary))' }}
              >
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{f.headline}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Conclusion */}
      <motion.div
        variants={item}
        className="bg-card border border-border rounded-2xl p-6 border-l-2"
        style={{ borderLeftColor: 'hsl(var(--primary))' }}
      >
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Sonuç</p>
        <p className="text-sm text-card-foreground leading-relaxed">{data.conclusion}</p>
      </motion.div>

      <motion.div variants={item} className="flex justify-center pt-2">
        <button onClick={onReset} className="text-sm text-muted-foreground hover:text-primary transition-colors underline decoration-dashed underline-offset-4" data-testid="button-new-question">
          Yeni Soru Sor
        </button>
      </motion.div>
    </motion.div>
  );
}
