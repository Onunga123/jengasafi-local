"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityForm } from "@/components/activityForm";
import { ActivityLog } from "@/components/carbonActivity";
import type { CarbonData } from "@/lib/carbonCalculation";

interface CarbonDataProps {
  siteId: string;
}

const emptyCarbonData: Pick<CarbonData, "activities" | "totalEmissions" | "activitySavings" | "verifiedTaskSavings" | "manualTaskSavings" | "totalSavings" | "netEmissions" | "trend"> = {
  activities: [],
  totalEmissions: 0,
  activitySavings: 0,
  verifiedTaskSavings: 0,
  manualTaskSavings: 0,
  totalSavings: 0,
  netEmissions: 0,
  trend: [],
};

export default function CarbonData({ siteId }: CarbonDataProps) {
  const [carbonData, setCarbonData] = useState(emptyCarbonData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityFeedback, setActivityFeedback] = useState<"success" | "error" | null>(null);

  const fetchCarbonData = useCallback(async () => {
    if (!siteId) {
      setCarbonData(emptyCarbonData);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/carbon-trends?siteId=${encodeURIComponent(siteId)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Carbon data request failed");

      const data = await response.json();
      setCarbonData({
        activities: Array.isArray(data.activities) ? data.activities : [],
        totalEmissions: typeof data.totalEmissions === "number" ? data.totalEmissions : 0,
        activitySavings: typeof data.activitySavings === "number" ? data.activitySavings : 0,
        verifiedTaskSavings: typeof data.verifiedTaskSavings === "number" ? data.verifiedTaskSavings : 0,
        manualTaskSavings: typeof data.manualTaskSavings === "number" ? data.manualTaskSavings : 0,
        totalSavings: typeof data.totalSavings === "number" ? data.totalSavings : 0,
        netEmissions: typeof data.netEmissions === "number" ? data.netEmissions : 0,
        trend: Array.isArray(data.trend) ? data.trend : [],
      });
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load recorded carbon data.");
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void fetchCarbonData();
  }, [fetchCarbonData]);

  return (
    <section className="space-y-6" aria-labelledby="carbon-data-title">
      <div>
        <h1 id="carbon-data-title" className="text-3xl font-bold text-emerald-800">Carbon Data</h1>
        <p className="mt-1 text-gray-600">Record and review the project activity data used for carbon reporting.</p>
      </div>

      {!siteId ? (
        <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Create or select a construction project before recording carbon data.
        </div>
      ) : (
        <>
          <section aria-labelledby="record-carbon-activity-title" className="space-y-3">
            <div>
              <h2 id="record-carbon-activity-title" className="text-xl font-semibold text-slate-900">Record activity</h2>
              <p className="mt-1 text-sm text-slate-600">Add ordinary project emissions or activity-derived carbon-saving data.</p>
            </div>
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
                void fetchCarbonData();
              }}
              onActivityError={() => setActivityFeedback("error")}
            />
          </section>

          <section aria-labelledby="recorded-activity-title" className="space-y-3">
            <div>
              <h2 id="recorded-activity-title" className="text-xl font-semibold text-slate-900">Recorded activity</h2>
              <p className="mt-1 text-sm text-slate-600">Review the CarbonActivity records currently used by Carbon Intelligence.</p>
            </div>
            {error && (
              <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {isLoading ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading recorded activity…</div>
            ) : (
              <ActivityLog activities={carbonData.activities} />
            )}
          </section>
        </>
      )}
    </section>
  );
}