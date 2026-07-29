import { motion } from 'framer-motion';
import type { ClarificationContent } from '@/lib/conversation-engine';

interface Props {
  data: ClarificationContent;
  onQuickAnswer: (text: string) => void;
}

export function ClarificationCard({ data, onQuickAnswer }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      {/* Intro */}
      <p className="text-sm text-card-foreground leading-relaxed">{data.intro}</p>

      {/* Questions */}
      <div className="space-y-4">
        {data.questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
            className="space-y-2.5"
          >
            <p className="text-sm font-medium text-foreground">{q.text}</p>

            {q.quickAnswers && q.quickAnswers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {q.quickAnswers.map((answer) => (
                  <motion.button
                    key={answer}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onQuickAnswer(answer)}
                    className="text-xs px-3.5 py-2 rounded-full border border-border hover:border-primary/60 hover:bg-primary/8 hover:text-primary text-muted-foreground transition-all duration-200"
                    data-testid={`quick-answer-${answer}`}
                  >
                    {answer}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground/50">
        Bir seçeneğe tıklayın veya aşağıya yazın
      </p>
    </motion.div>
  );
}
