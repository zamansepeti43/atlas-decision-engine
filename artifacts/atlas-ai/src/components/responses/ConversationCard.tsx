import { motion } from 'framer-motion';
import { MessageCircle, ArrowRight } from 'lucide-react';
import type { ConversationData } from '@/lib/intent-router';

interface Props {
  data: ConversationData;
  onFollowUp: (q: string) => void;
  onReset: () => void;
}

export function ConversationCard({ data, onFollowUp, onReset }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Message bubble */}
      <div className="bg-card border border-border rounded-2xl p-7 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top left, hsl(var(--primary) / 0.04) 0%, transparent 60%)',
          }}
        />
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <p className="text-base text-card-foreground leading-relaxed">{data.message}</p>
        </div>
      </div>

      {/* Follow-up suggestions */}
      {data.followUps.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="space-y-3"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">
            Devam Edebilirsiniz
          </p>
          <div className="grid gap-2">
            {data.followUps.map((q, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
                onClick={() => onFollowUp(q)}
                className="flex items-center justify-between gap-3 bg-card border border-border hover:border-primary/40 rounded-xl px-5 py-3.5 text-sm text-left text-muted-foreground hover:text-foreground transition-all duration-200 group"
                data-testid={`followup-suggestion-${i}`}
              >
                <span>{q}</span>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex justify-center pt-2"
      >
        <button
          onClick={onReset}
          className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
          data-testid="button-new-question"
        >
          Yeni bir soru sor
        </button>
      </motion.div>
    </motion.div>
  );
}
