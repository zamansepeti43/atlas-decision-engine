import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const steps = [
  { id: 0, label: 'Soru analiz ediliyor', delay: 0 },
  { id: 1, label: 'Veriler ve seçenekler taranıyor', delay: 900 },
  { id: 2, label: 'Öneri hazırlanıyor', delay: 1900 },
];

export function LoadingState() {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step) => {
      if (step.delay > 0) {
        timers.push(
          setTimeout(() => {
            setCompletedSteps((prev) => [...prev, step.id - 1]);
            setActiveStep(step.id);
          }, step.delay)
        );
      }
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      {/* Orb animation */}
      <div className="relative w-36 h-36 mb-10">
        {/* Outer pulsing rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/20"
            animate={{
              scale: [1, 1.6, 1],
              opacity: [0.4, 0, 0.4],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              delay: i * 0.6,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Middle rotating ring */}
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

        {/* Inner glowing core */}
        <motion.div
          className="absolute inset-6 rounded-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.05) 70%)',
          }}
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

      {/* Main heading */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold text-foreground mb-8 tracking-wide"
      >
        Atlas Brain analiz ediyor
        <AnimatedDots />
      </motion.p>

      {/* Step list */}
      <div className="w-full max-w-xs space-y-3">
        {steps.map((step) => {
          const isDone = completedSteps.includes(step.id);
          const isActive = activeStep === step.id;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay / 1000, duration: 0.4 }}
              className="flex items-center gap-3"
            >
              {/* Status dot */}
              <div className="relative w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {isDone ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path
                        d="M1.5 4L3.5 6L6.5 2"
                        stroke="hsl(var(--primary-foreground))"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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

              {/* Label */}
              <span
                className={`text-sm transition-colors duration-300 ${
                  isDone
                    ? 'text-primary font-medium'
                    : isActive
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground/40'
                }`}
              >
                {step.label}
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
        <motion.span
          key={i}
          className="text-primary"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}
