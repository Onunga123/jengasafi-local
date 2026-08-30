"use client";
import { motion } from "framer-motion";
import { UserMetrics } from "@/lib/materials/types";

interface MaterialsHeaderProps {
  userMetrics: UserMetrics | null;
  materialsCount: number;
}

export function MaterialsHeader({ userMetrics, materialsCount }: MaterialsHeaderProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        {/* Title Section */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Sustainable Materials Hub
          </h1>
          <p className="text-muted-foreground text-lg">
            Explore {materialsCount} materials with available carbon and sustainability information
          </p>
        </div>

        {/* Metrics Section */}
        {userMetrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-auto">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-green-50 border border-green-200 rounded-lg p-3 text-center"
            >
              <div className="text-2xl font-bold text-green-700">
                {userMetrics.totalSavings > 1000 
                  ? `${(userMetrics.totalSavings / 1000).toFixed(1)}t`
                  : `${userMetrics.totalSavings.toFixed(0)}kg`
                }
              </div>
              <div className="text-xs text-green-600 font-medium">CO₂ Saved</div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center"
            >
              <div className="text-2xl font-bold text-blue-700">
                {userMetrics.netEmissions > 1000 
                  ? `${(userMetrics.netEmissions / 1000).toFixed(1)}t`
                  : `${userMetrics.netEmissions.toFixed(0)}kg`
                }
              </div>
              <div className="text-xs text-blue-600 font-medium">Net Emissions</div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center"
            >
              <div className="text-2xl font-bold text-purple-700">
                {userMetrics.materialsUsed}
              </div>
              <div className="text-xs text-purple-600 font-medium">Materials Used</div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center"
            >
              <div className="text-2xl font-bold text-orange-700">
                {userMetrics.sustainabilityScore}/5
              </div>
              <div className="text-xs text-orange-600 font-medium">Sustainability</div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Project Info */}
      {userMetrics && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Project: {userMetrics.projectType}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Location: {userMetrics.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>Budget: ${userMetrics.budget.toLocaleString()}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}