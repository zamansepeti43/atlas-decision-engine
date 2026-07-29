import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface LoadingStateProps {
  loadingText?: string;
  steps?: string[];
}

export function LoadingState({
  loadingText = 'Atlas analiz ediyor',
  steps = ['Soru analiz ediliyor', 'İçerik hazırlanıyor', 'Son rötuşlar yapılıyor'],
}: LoadingStateProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stepCount = steps.length;
    const interval = stepCount > 1 ? 900 : 700;

    for (let i = 1; i < stepCount; i++) {
      timers.push(
        setTimeout(() => {
          setCompletedSteps((prev) => [...prev, i - 1]);
          setActiveStep(i);
        }, i * interval)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      {/* Orb */}
      <div className="relative w-36 h-36 mb-10">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/20"
            animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' }}
          />
        ))}

        <motion.div
          className="absolute inset-2 rounded-full border border-primary/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          style={{
            borderTopColor: 'hsl(var(--primary))',
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
          }}
        />

        <motion.div
          className="absolute inset-6 rounded-full flex items-center justify-center"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.05) 70%)' }}
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="w-5 h-5 rounded-full bg-primary"
            animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ boxShadow: '0 0 16px 4px hsl(var(--primary) / 0.5)' }}
          />
        </motion.div>
      </div>

      {/* Loading text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold text-foreground mb-8 tracking-wide"
      >
        {loadingText}
        <AnimatedDots />
      </motion.p>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-3">
        {steps.map((step, index) => {
          const isDone = completedSteps.includes(index);
          const isActive = activeStep === index;

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (index * 900) / 1000, duration: 0.4 }}
              className="flex items-center gap-3"
            >
              <div className="relative w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {isDone ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3.5 6L6.5 2" stroke="hsl(var(--primary-foreground))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                ) : isActive ? (
                  <motion.div
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{ boxShadow: '0 0 8px hsl(var(--primary) / 0.8)' }}
                  />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-border" />
                )}
              </div>
              <span
                className={`text-sm transition-colors duration-300 ${
                  isDone ? 'text-primary font-medium' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground/40'
                }`}
              >
                {step}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="text-primary" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}>
          .
        </motion.span>
      ))}
    </span>
  );
}
