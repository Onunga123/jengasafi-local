"use client";

import React, { useState, useEffect } from "react";
import {
  NetEmissionsTrend,
  EmissionsVsSavings,
  PredictiveAnalysis,
} from "../carbonCharts";
import { ActivityLog } from "../carbonActivity";
import { DataSourceCredibility } from "../dataCredibility";
import { CarbonData } from "@/lib/carbonCalculation";
import { ActivityForm } from "../activityForm";
import { KPISummary } from "../kpiSummary";
import { AIInsights } from "../aiInsights";
import { ClientApiError, requestJson } from "@/lib/client-errors";

type Props = {
  siteId: string;
  refreshSignal?: number;
  completedTaskId?: string | null;
  completedTaskTitle?: string | null;
carbonEmitted: number;
carbonSaved: number;
trend: { 
  time: string; 
  emissions: number;
  savings: number;
  net: number }[]
};


// ---------- Main Dashboard Component ----------
export default function EnvironmentalMonitoringDashboard({
  siteId,
  refreshSignal,
  completedTaskId,
  completedTaskTitle,
}: Props) {
  const [carbonData, setCarbonData] = useState<CarbonData>({
    activities: [],
    totalEmissions: 0,
    totalSavings: 0,
    netEmissions: 0,
    baselineEmissions: null,
    reductionTarget: null,
    baselineSetAt: null,
    requiredReduction: null,
    progressPercentage: null,
    remainingReduction: null,
    trend: [],
    forecast: [],
  });

  const [insights, setInsights] = useState<string[]>([]);
  const [activityFeedback, setActivityFeedback] = useState<'success' | 'error' | null>(null);
  const [actualReduction, setActualReduction] = useState("");
  const [actualReductionError, setActualReductionError] = useState<string | null>(null);
  const [actualReductionFeedback, setActualReductionFeedback] = useState<string | null>(null);
  const [isSavingActualReduction, setIsSavingActualReduction] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [carbonDataError, setCarbonDataError] = useState(false);
  const [insightsError, setInsightsError] = useState(false);
  const [isSettingBaseline, setIsSettingBaseline] = useState(false);
  const [baselineFeedback, setBaselineFeedback] = useState<{ kind: 'status' | 'alert'; message: string } | null>(null);
  const [dataSources, setDataSources] = useState({
    kenyaPower: { lastUpdated: "", credibility: "External dataset" },
    unfccc: { lastUpdated: "", credibility: "External dataset" },
    localData: { lastUpdated: "", credibility: "Recorded activity" },
  });

  // Fetch data on component mount
  useEffect(() => {
    void Promise.all([fetchCarbonData(), fetchInsights()]);
    fetchDataSources();

    const interval = setInterval(fetchCarbonData, 30000);
    return () => clearInterval(interval);
  }, [siteId, refreshSignal]);

  const fetchCarbonData = async () => {
    try {
      const response = await fetch(`/api/carbon-trends?siteId=${siteId}`);
      if (!response.ok) throw new Error("Carbon data request failed");
      const data = await response.json();
      setCarbonData(data);
      setCarbonDataError(false);
    } catch (error) {
      console.error("Error fetching carbon data:", error);
      setCarbonDataError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInsights = async () => {
    try {
      const response = await fetch(`/api/insights?siteId=${siteId}`);
      if (!response.ok) throw new Error("Carbon insights request failed");
      const data = await response.json();
      setInsights(data.insights || []);
      setInsightsError(false);
    } catch (error) {
      console.error("Error fetching insights:", error);
      setInsightsError(true);
    }
  };

  const handleActualReductionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActualReductionError(null);
    setActualReductionFeedback(null);

    if (!completedTaskId) {
      setActualReductionError("The completed EcoTask could not be identified. Please return to EcoTasks and try again.");
      return;
    }

    const trimmedValue = actualReduction.trim();
    if (!trimmedValue) {
      setActualReductionError("Enter the measured carbon reduction.");
      return;
    }

    const reduction = Number(trimmedValue);
    if (!Number.isFinite(reduction)) {
      setActualReductionError("Enter a valid numeric value.");
      return;
    }

    if (reduction < 0) {
      setActualReductionError("Actual carbon reduction cannot be negative.");
      return;
    }

    setIsSavingActualReduction(true);
    try {
      await requestJson(`/api/tasks/${completedTaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualCarbonReduction: reduction }),
      });

      setActualReduction("");
      setActualReductionFeedback("Actual carbon reduction saved successfully.");
      await Promise.all([fetchCarbonData(), fetchInsights()]);
    } catch (error) {
      setActualReductionError(
        error instanceof Error
          ? error.message
          : "Failed to save the actual carbon reduction. Please try again."
      );
    } finally {
      setIsSavingActualReduction(false);
    }
  };

  // Asks the server to freeze the current recorded emissions as the site's
  // baseline. Only siteId is sent; the emissions value is calculated and
  // stored server-side by /api/carbon-data/set-baseline.
  const handleSetBaseline = async () => {
    if (isSettingBaseline || !siteId) return;
    const confirmed = window.confirm(
      "Set the current recorded emissions as your carbon reduction baseline? This baseline will be frozen and used to calculate future progress."
    );
    if (!confirmed) return;

    setBaselineFeedback(null);
    setIsSettingBaseline(true);
    try {
      await requestJson("/api/carbon-data/set-baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      setBaselineFeedback({ kind: "status", message: "Baseline set. Target progress now updates from this baseline." });
      await fetchCarbonData();
    } catch (error) {
      if (error instanceof ClientApiError && error.status === 409) {
        // Baseline already exists: not a failure. Resync the UI with the server.
        setBaselineFeedback({ kind: "status", message: error.message });
        await fetchCarbonData();
      } else {
        setBaselineFeedback({
          kind: "alert",
          message: error instanceof Error ? error.message : "Failed to set baseline. Please try again.",
        });
      }
    } finally {
      setIsSettingBaseline(false);
    }
  };

  const fetchDataSources = async () => {
    setDataSources({
      kenyaPower: {
        lastUpdated: new Date().toISOString(),
        credibility: "External dataset",
      },
      unfccc: {
        lastUpdated: new Date().toISOString(),
        credibility: "External dataset",
      },
      localData: {
        lastUpdated: new Date().toISOString(),
        credibility: "Recorded activity",
      },
    });
  };

  return (
    <>
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Carbon Intelligence
            </h1>
            <p className="text-muted-foreground">
              Monitor emissions and savings from construction activities
            </p>
          </div>

          {/* KPI Summary */}
          {carbonDataError && (
            <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Carbon data could not be refreshed.</span>
                <button
                  type="button"
                  onClick={() => void fetchCarbonData()}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          <KPISummary
            carbonData={carbonData}
            isLoading={isLoading}
            onSetBaseline={siteId ? handleSetBaseline : undefined}
            isSettingBaseline={isSettingBaseline}
            baselineFeedback={baselineFeedback}
          />

          {/* Data Source Credibility */}
          <DataSourceCredibility dataSources={dataSources} />

          <section aria-labelledby="trends-forecast-title">
            <div>
              <h2 id="trends-forecast-title">Trends &amp; Forecast</h2>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Net Emissions Trend */}
              <NetEmissionsTrend carbonData={carbonData} />
              <EmissionsVsSavings carbonData={carbonData} />
            </div>

            {/* Predictive Analysis Chart */}
            <PredictiveAnalysis carbonData={carbonData} />
          </section>

          <section aria-labelledby="carbon-insights-section-title">
            <div>
              <h2 id="carbon-insights-section-title">Additional Carbon Insights</h2>
            </div>

            {/* Activity-based insights */}
            {insightsError && (
              <div role="alert" className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Carbon insights could not be refreshed.</span>
                  <button
                    type="button"
                    onClick={() => void fetchInsights()}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            <AIInsights insights={insights} isLoading={isLoading} />
          </section>

          <section aria-labelledby="activity-history-title">
            <div>
              <h2 id="activity-history-title">Activity History</h2>
            </div>

            {/* Activity Log */}
            <ActivityLog activities={carbonData.activities} />
          </section>

          {/* Completed EcoTask result */}
          {completedTaskId && (
            <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4" aria-labelledby="completed-ecotask-result-title">
              {completedTaskTitle && (
                <p className="font-semibold text-emerald-900">Completed EcoTask: {completedTaskTitle}</p>
              )}
              <p id="completed-ecotask-result-title" className="mt-1 text-sm font-semibold text-emerald-900">Record the actual carbon reduction measured after completing this EcoTask.</p>
              <p className="mt-1 text-sm text-emerald-800">Estimated reduction is the prediction recorded when the task was created. Actual carbon reduction is the measured result and is entered separately below.</p>
              <form onSubmit={handleActualReductionSubmit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="actual-carbon-reduction" className="block text-sm font-semibold text-emerald-950">
                    Actual Carbon Reduction (kg CO₂)
                  </label>
                  <input
                    id="actual-carbon-reduction"
                    name="actualCarbonReduction"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={actualReduction}
                    onChange={(event) => {
                      setActualReduction(event.target.value);
                      setActualReductionError(null);
                      setActualReductionFeedback(null);
                    }}
                    aria-describedby={actualReductionError ? "actual-carbon-reduction-error" : undefined}
                    aria-invalid={actualReductionError ? "true" : "false"}
                    className="mt-1 w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="Enter the measured result, e.g. 8.4"
                    disabled={isSavingActualReduction}
                  />
                </div>
                {actualReductionError && (
                  <p id="actual-carbon-reduction-error" role="alert" className="text-sm text-red-700">
                    {actualReductionError}
                  </p>
                )}
                {actualReductionFeedback && (
                  <p role="status" className="text-sm font-medium text-emerald-700">
                    {actualReductionFeedback}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSavingActualReduction}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                >
                  {isSavingActualReduction ? "Saving measured result..." : "Save Actual Carbon Reduction"}
                </button>
              </form>
            </section>
          )}
          {activityFeedback === "success" && (
            <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Activity recorded successfully.</p>
          )}
          {activityFeedback === "error" && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Failed to record activity. Please try again.</p>
          )}
          <ActivityForm
            siteId={siteId}
            onActivityAdded={() => {
              setActivityFeedback("success");
              fetchCarbonData();
              fetchInsights();
            }}
            onActivityError={() => setActivityFeedback("error")}
          />
        </div>
      </div>
    </>
  );
}
