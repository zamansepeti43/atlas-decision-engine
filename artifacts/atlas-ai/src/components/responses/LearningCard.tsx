import { motion } from 'framer-motion';
import { BookOpen, Lightbulb, ChevronRight } from 'lucide-react';
import type { LearningData } from '@/lib/intent-router';

interface Props {
  data: LearningData;
  onFollowUp: (q: string) => void;
  onReset: () => void;
}

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function LearningCard({ data, onFollowUp, onReset }: Props) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="w-full max-w-3xl mx-auto space-y-5"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{data.topic}</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Öğrenme Rehberi</p>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div variants={item} className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / 0.05) 0%, transparent 60%)' }}
        />
        <p className="text-base text-card-foreground leading-relaxed">{data.summary}</p>
      </motion.div>

      {/* Key points */}
      <motion.div variants={item} className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">
          Temel Kavramlar
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {data.keyPoints.map((kp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
              className="bg-card border border-border rounded-xl p-5"
              data-testid={`key-point-${i}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-sm font-semibold text-primary">{kp.title}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{kp.detail}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Example */}
      {data.example && (
        <motion.div variants={item} className="bg-card border border-primary/20 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lightbulb className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Örnek</p>
              <p className="text-sm text-card-foreground leading-relaxed">{data.example}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Next topics */}
      {data.nextTopics.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">
            Devam Edebilirsiniz
          </p>
          <div className="flex flex-wrap gap-2">
            {data.nextTopics.map((t, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(`${t} nedir, anlat`)}
                className="flex items-center gap-1.5 text-sm bg-card border border-border hover:border-primary/40 hover:text-primary rounded-full px-4 py-2 text-muted-foreground transition-all duration-200"
                data-testid={`next-topic-${i}`}
              >
                <ChevronRight className="w-3 h-3" />
                {t}
              </button>
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
