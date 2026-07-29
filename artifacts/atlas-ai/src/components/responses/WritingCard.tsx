import { motion } from 'framer-motion';
import { useState } from 'react';
import { PenLine, Copy, Check } from 'lucide-react';
import type { WritingData } from '@/lib/intent-router';

interface Props {
  data: WritingData;
  onReset: () => void;
}

export function WritingCard({ data, onReset }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render markdown-ish formatting (bold, headers)
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return <h3 key={i} className="text-lg font-semibold text-foreground mt-4 mb-2">{line.slice(2)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={i} className="text-base font-semibold text-primary mt-3 mb-1.5">{line.slice(3)}</h4>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-foreground">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return <p key={i} className="flex gap-2 text-sm text-card-foreground"><span className="text-primary flex-shrink-0">•</span><span>{line.slice(2)}</span></p>;
      }
      if (line.startsWith('Konu:') || line.startsWith('Sayın') || line.startsWith('[')) {
        return <p key={i} className={`text-sm leading-relaxed ${line.startsWith('Konu:') ? 'font-semibold text-foreground' : 'text-card-foreground'}`}>{line}</p>;
      }
      if (line === '') return <div key={i} className="h-3" />;
      return <p key={i} className="text-sm text-card-foreground leading-relaxed">{line}</p>;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-3xl mx-auto space-y-5"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <PenLine className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{data.contentType}</h2>
            <p className="text-xs text-muted-foreground">{data.wordCount} kelime</p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-card border border-border hover:border-primary/40 rounded-xl text-muted-foreground hover:text-primary transition-all duration-200"
          data-testid="button-copy"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-primary" /><span className="text-primary">Kopyalandı</span></>
          ) : (
            <><Copy className="w-3.5 h-3.5" /><span>Kopyala</span></>
          )}
        </motion.button>
      </motion.div>

      {/* Editor frame */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative bg-card border border-border rounded-2xl overflow-hidden"
      >
        {/* Toolbar bar */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-border">
          {['#0a0a0a', '#1a1a1a', '#2a2a2a'].map((c, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, border: '1px solid #333' }} />
          ))}
          <div className="ml-3 text-xs text-muted-foreground/50 font-mono">{data.taskDescription}.txt</div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-1 font-mono text-sm min-h-[200px]">
          {renderContent(data.content)}
        </div>
      </motion.div>

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-5 space-y-3"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Düzenleme Önerileri
          </p>
          <ul className="space-y-2">
            {data.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                {s}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex justify-center pt-2">
        <button onClick={onReset} className="text-sm text-muted-foreground hover:text-primary transition-colors underline decoration-dashed underline-offset-4" data-testid="button-new-question">
          Yeni Soru Sor
        </button>
      </motion.div>
    </motion.div>
  );
}
