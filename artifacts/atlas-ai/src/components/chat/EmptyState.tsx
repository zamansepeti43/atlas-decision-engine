import { motion } from 'framer-motion';
import { BookOpen, Map, PenLine, Scale, type LucideIcon } from 'lucide-react';

interface Props {
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS: Array<{ label: string; text: string; icon: LucideIcon }> = [
  { label: 'Karar Analizi', text: 'iPhone mı Samsung mı almalıyım? Fotoğraf çok önemli.', icon: Scale },
  { label: 'Öğrenme', text: 'Yapay zeka nedir ve nasıl çalışır? Hiç bilmiyorum.', icon: BookOpen },
  { label: 'Planlama', text: '6 ayda Python öğrenmek istiyorum, plan yap.', icon: Map },
  { label: 'Yazı', text: 'Yöneticime terfi talebimi içeren bir e-posta yaz.', icon: PenLine },
];

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
} satisfies Record<string, unknown>;

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
} satisfies Record<string, unknown>;

export function EmptyState({ onSuggestion }: Props) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="w-full max-w-2xl text-center space-y-10"
      >
        {/* Logo */}
        <motion.div variants={item}>
          <h1 className="text-5xl md:text-7xl font-serif font-bold mb-3">
            <span className="text-foreground">Atlas</span>{' '}
            <span
              className="text-primary"
              style={{ textShadow: '0 0 40px hsl(var(--primary) / 0.35)' }}
            >
              AI
            </span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground font-light tracking-wide">
            Her karar için akıllı bir danışman
          </p>
        </motion.div>

        {/* Capability chips */}
        <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-2">
          {['Karar Analizi', 'Öğrenme', 'Planlama', 'Araştırma', 'Yazı', 'Problem Çözümü'].map((cap) => (
            <span
              key={cap}
              className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground/60"
            >
              {cap}
            </span>
          ))}
        </motion.div>

        {/* Suggestions */}
        <motion.div variants={item} className="grid md:grid-cols-2 gap-3">
          {SUGGESTIONS.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
            <motion.button
              key={suggestion.label}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSuggestion(suggestion.text)}
              className="text-left bg-card border border-border hover:border-primary/40 rounded-2xl px-5 py-4 transition-all duration-200 group"
              data-testid={`suggestion-${suggestion.label}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {suggestion.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                {suggestion.text}
              </p>
            </motion.button>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
