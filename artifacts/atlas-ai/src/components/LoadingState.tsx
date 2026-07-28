import { motion } from 'framer-motion';

export function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center py-16"
    >
      {/* Animated rings */}
      <div className="relative w-32 h-32 mb-8">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="absolute inset-0 rounded-full border-2 border-primary/30"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.4,
              ease: "easeInOut"
            }}
          />
        ))}
        
        {/* Center glow */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="w-16 h-16 rounded-full bg-primary/20 gold-glow-strong" />
        </motion.div>
      </div>

      {/* Loading text with animated dots */}
      <div className="flex items-center gap-2">
        <span className="text-lg text-foreground font-medium">
          Atlas Brain analiz ediyor
        </span>
        <div className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="text-lg text-primary"
              animate={{
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: index * 0.2,
                ease: "easeInOut"
              }}
            >
              .
            </motion.span>
          ))}
        </div>
      </div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-muted-foreground mt-3 text-center max-w-md"
      >
        Verileriniz analiz ediliyor ve en iyi öneriler hazırlanıyor
      </motion.p>
    </motion.div>
  );
}
