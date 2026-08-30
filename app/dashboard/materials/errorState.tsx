// errorState.tsx
import { motion } from "framer-motion";
import Button  from "@/components/ui/button";

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center min-h-[400px] bg-card rounded-xl border border-destructive/20 p-8 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-2xl">⚠️</span>
      </motion.div>
      
      <h3 className="text-xl font-semibold text-destructive mb-3">
        Unable to Load Materials
      </h3>
      
      <p className="text-muted-foreground mb-2 max-w-md">
        {error}
      </p>
      
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        External material sources may be temporarily unavailable. We have not substituted unavailable data with fabricated values.
      </p>

      <div className="flex gap-4">
        <Button 
          onClick={onRetry}
          variant="default"
          className="bg-primary hover:bg-primary/90"
        >
          <motion.span
            animate={{ rotate: 0 }}
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            🔄
          </motion.span>
          Try Again
        </Button>
        
        <Button 
          onClick={onRetry}
          variant="outline"
          className="border-border hover:bg-muted"
        >
          <span>📋</span>
          Retry source requests
        </Button>
      </div>

      {/* Additional help information */}
      <div className="mt-8 p-4 bg-muted/50 rounded-lg max-w-md">
        <h4 className="font-medium text-foreground mb-2">What happened?</h4>
        <ul className="text-sm text-muted-foreground text-left space-y-1">
          <li>• External data sources might be temporarily unavailable</li>
          <li>• Your connection might have been interrupted</li>
          <li>• Material values are shown only when a source responds</li>
        </ul>
      </div>
    </motion.div>
  );
}