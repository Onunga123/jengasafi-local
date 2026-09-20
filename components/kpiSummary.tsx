// components/kpi-summary.tsx
"use client";

import { CarbonData, calculateEfficiencyScore } from "@/lib/carbonCalculation";

const formatCarbon = (value: number) => `${value.toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} kg CO₂`;

// Shared KPI status badge box. Fixed width/height, no flex shrink and centered
// text so every badge renders with identical dimensions regardless of label
// length or font metrics. Only colour classes are supplied per badge.
const kpiBadgeClass =
  "inline-flex h-6 w-20 shrink-0 items-center justify-center whitespace-nowrap rounded text-xs";

interface KPISummaryProps {
  carbonData: CarbonData;
  isLoading: boolean;
  // Optional baseline action. When provided, the unset-baseline empty state
  // renders a button that asks the parent to set the baseline server-side.
  onSetBaseline?: () => void;
  isSettingBaseline?: boolean;
  baselineFeedback?: { kind: 'status' | 'alert'; message: string } | null;
}

export function KPISummary({
  carbonData,
  isLoading,
  onSetBaseline,
  isSettingBaseline = false,
  baselineFeedback = null,
}: KPISummaryProps) {
  const hasRecordedEmissions =
    typeof carbonData.totalEmissions === "number" &&
    Number.isFinite(carbonData.totalEmissions) &&
    carbonData.totalEmissions > 0;
  const hasValidProgress =
    typeof carbonData.baselineEmissions === "number" &&
    Number.isFinite(carbonData.baselineEmissions) &&
    carbonData.baselineEmissions > 0 &&
    typeof carbonData.reductionTarget === "number" &&
    Number.isFinite(carbonData.reductionTarget) &&
    carbonData.reductionTarget > 0 &&
    typeof carbonData.requiredReduction === "number" &&
    Number.isFinite(carbonData.requiredReduction) &&
    carbonData.requiredReduction > 0 &&
    typeof carbonData.progressPercentage === "number" &&
    Number.isFinite(carbonData.progressPercentage) &&
    typeof carbonData.remainingReduction === "number" &&
    Number.isFinite(carbonData.remainingReduction);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Emissions */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground mb-2">Total Emissions</h3>
            <p className="text-3xl font-bold text-destructive">
              {isLoading ? '...' : `${carbonData.totalEmissions.toFixed(2)} kg CO₂`}
            </p>
          </div>
          {!isLoading && carbonData.totalEmissions > 0 && (
            <div className={`${kpiBadgeClass} bg-red-500/10 text-red-600`}>
              Recorded
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Project activity</p>
      </div>
      
      {/* Carbon Savings */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground mb-2">Carbon Savings</h3>
            <p className="text-3xl font-bold text-emerald-600">
              {isLoading ? '...' : `${carbonData.totalSavings.toFixed(2)} kg CO₂`}
            </p>
          </div>
          {!isLoading && carbonData.totalSavings > 0 && (
            <div className={`${kpiBadgeClass} bg-emerald-500/10 text-emerald-600`}>
              Saved
            </div>
          )}
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>Includes:</p>
          <p>Activity-derived savings: {isLoading ? '...' : `${(carbonData.activitySavings ?? 0).toFixed(2)} kg CO₂`}</p>
          <p>Completed task outcomes: {isLoading ? '...' : `${(carbonData.completedTaskSavings ?? 0).toFixed(2)} kg CO₂`}</p>
        </div>
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

      {/* Carbon Reduction Target */}
      <div className="md:col-span-4 bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Carbon Reduction Target</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading target progress...</p>
            ) : !hasValidProgress ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Carbon reduction baseline not set. Set your current recorded emissions as the baseline to start tracking target progress.
                </p>
                {onSetBaseline && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={onSetBaseline}
                      disabled={isSettingBaseline || !hasRecordedEmissions}
                      aria-describedby={!hasRecordedEmissions ? "baseline-zero-emissions-hint" : undefined}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    >
                      {isSettingBaseline ? "Setting baseline..." : "Set current emissions as baseline"}
                    </button>
                    {!hasRecordedEmissions && (
                      <p id="baseline-zero-emissions-hint" className="text-xs text-muted-foreground">
                        Record at least one emissions activity before setting a baseline.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <p>
                  Target: <span className="font-semibold text-foreground">{carbonData.reductionTarget}%</span>
                </p>
                <p>
                  Required reduction: <span className="font-semibold text-foreground">{formatCarbon(carbonData.requiredReduction!)}</span>
                </p>
                <p>
                  Achieved savings: <span className="font-semibold text-foreground">{formatCarbon(carbonData.totalSavings)}</span>
                </p>
                <p>
                  Remaining reduction: <span className="font-semibold text-foreground">{formatCarbon(carbonData.remainingReduction!)}</span>
                </p>
              </div>
            )}
          </div>
          {baselineFeedback && (
            <p
              role={baselineFeedback.kind}
              className={(baselineFeedback.kind === "alert" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700") + " rounded-md px-3 py-2 text-sm"}
            >
              {baselineFeedback.message}
            </p>
          )}
        </div>
        {!isLoading && hasValidProgress && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Progress:</span>
                <span className="font-semibold text-foreground">
                  {carbonData.progressPercentage!.toFixed(2)}%
                </span>
              </div>
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Carbon reduction target progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={carbonData.progressPercentage!}
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${carbonData.progressPercentage!}%` }}
                />
              </div>
            </div>
          )}
      </div>
    </div>
  );
}