// components/kpi-summary.tsx
"use client";

import { CarbonData, calculateEfficiencyScore } from "@/lib/carbonCalculation";

interface KPISummaryProps {
  carbonData: CarbonData;
  isLoading: boolean;
}

export function KPISummary({ carbonData, isLoading }: KPISummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Emissions */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Total Emissions</h3>
            <p className="text-3xl font-bold text-destructive">
              {isLoading ? '...' : `${carbonData.totalEmissions.toFixed(2)} kg CO₂`}
            </p>
          </div>
          {!isLoading && carbonData.totalEmissions > 0 && (
            <div className="bg-destructive/10 text-destructive text-xs px-2 py-1 rounded">
              Recorded
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Recorded project activity</p>
      </div>
      
      {/* Carbon Savings */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Carbon Savings</h3>
            <p className="text-3xl font-bold text-emerald-600">
              {isLoading ? '...' : `${carbonData.totalSavings.toFixed(2)} kg CO₂`}
            </p>
          </div>
          {!isLoading && carbonData.totalSavings > 0 && (
            <div className="bg-emerald-500/10 text-emerald-600 text-xs px-2 py-1 rounded">
              Saved
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Calculated from recorded activity</p>
      </div>

      {/* Net Emissions */}
      <div className={`bg-card p-6 rounded-lg border shadow-sm ${
        carbonData.netEmissions >= 0 ? 'border-destructive/20' : 'border-emerald-500/20'
      }`}>
        <h3 className="text-lg font-semibold text-foreground mb-2">Net Emissions</h3>
        <p className={`text-3xl font-bold ${
          carbonData.netEmissions >= 0 ? 'text-destructive' : 'text-emerald-600'
        }`}>
          {isLoading ? '...' : `${carbonData.netEmissions.toFixed(2)} kg CO₂`}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {carbonData.netEmissions < 0 ? 'Carbon Negative! 🎉' : 'Tracking progress'}
        </p>
      </div>

      {/* Efficiency Score */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-2">Efficiency Score</h3>
        <p className="text-3xl font-bold text-blue-600">
          {isLoading ? '...' : calculateEfficiencyScore(carbonData)}
        </p>
        <p className="text-xs text-muted-foreground mt-2">Calculated efficiency band</p>
      </div>
    </div>
  );
}