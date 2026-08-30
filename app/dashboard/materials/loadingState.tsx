// loadingState.tsx
import { motion } from "framer-motion";

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-card rounded-xl border border-border p-8">
      <motion.div
        className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mb-4"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      
      <motion.h3 
        className="text-xl font-semibold text-foreground mb-2"
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
      >
        Loading Sustainable Materials
      </motion.h3>
      
      <p className="text-muted-foreground text-center max-w-md">
        Loading material data from configured external sources...
      </p>

      {/* Loading progress indicators */}
      <div className="mt-6 w-full max-w-xs space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>OpenLCA Nexus</span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            ✓
          </motion.span>
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>USGS Data</span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            ✓
          </motion.span>
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>EPC Database</span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            ✓
          </motion.span>
        </div>
      </div>
    </div>
  );
}