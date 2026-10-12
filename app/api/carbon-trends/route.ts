import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CarbonActivity from "@/app/models/CarbonActivity";
import CarbonData from "@/app/models/carbon-data";
import Project from "@/app/models/project";
import Task from "@/app/models/task";
import ManualCarbonReduction from "@/app/models/ManualCarbonReduction";
import { fetchEmissionFactors } from "@/lib/emissions";
import { generateForecast } from "@/lib/forecast";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { calculateActivityTotals } from "@/lib/carbonCalculation";
import { isVerifiedTaskCarbonReduction } from "@/lib/taskMeasurement";
import {
  CarbonActivityContractError,
  normalizeCarbonActivityRecord,
} from "@/lib/carbonActivityContract";

type CarbonDataSummary = {
  baselineEmissions?: number;
  reductionTarget?: number;
  baselineSetAt?: Date | null;
};

export async function GET(req: Request) {
  try {
    const user = await requireAuth();

    await connectDB();

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");

    const carbonData = siteId
      ? await CarbonData.findOne({ siteId, userId: user.email })
          .select("baselineEmissions reductionTarget baselineSetAt")
          .lean<CarbonDataSummary>()
      : null;
    const baselineEmissions =
      typeof carbonData?.baselineEmissions === "number" &&
      Number.isFinite(carbonData.baselineEmissions) &&
      carbonData.baselineEmissions > 0
        ? carbonData.baselineEmissions
        : null;
    const reductionTarget =
      typeof carbonData?.reductionTarget === "number" &&
      Number.isFinite(carbonData.reductionTarget)
        ? carbonData.reductionTarget
        : null;
    const baselineSetAt = carbonData?.baselineSetAt ?? null;

    // Scope the response to a site when requested; otherwise preserve the
    // dashboard's all-user activity summary.
    const activities = await CarbonActivity.find({
      userId: user.email,
      ...(siteId ? { siteId } : {}),
    }).sort({ createdAt: 1 });

    const factors = await fetchEmissionFactors();
    const calculationActivities = activities.map(normalizeCarbonActivityRecord);
    const activityTotals = calculationActivities.map((activity) =>
      calculateActivityTotals([activity], factors)
    );
    const trend = calculationActivities.map((activity, index) => ({
      time: activity.timestamp,
      emissions: activityTotals[index].emissions,
      savings: activityTotals[index].savings,
      net: activityTotals[index].emissions - activityTotals[index].savings,
    }));
    const totals = calculateActivityTotals(calculationActivities, factors);
    const ownedProjects = siteId
      ? await Project.find({ userId: user.email, siteId }).select("_id").lean()
      : [];
    const projectIds = ownedProjects.map((project) => String(project._id));
    const completedTasks = projectIds.length
      ? await Task.find({ projectId: { $in: projectIds }, status: "done" })
          .select("actualCarbonReduction carbonImpactStatus")
          .lean()
      : [];
    const verifiedTaskIds = new Set(
      completedTasks
        .filter((task) => isVerifiedTaskCarbonReduction(task.actualCarbonReduction, task.carbonImpactStatus))
        .map((task) => String(task._id))
    );
    const completedTaskSavings = completedTasks.reduce((sum, task) => {
      const reduction = task.actualCarbonReduction;
      return isVerifiedTaskCarbonReduction(reduction, task.carbonImpactStatus)
        ? sum + reduction
        : sum;
    }, 0);
    const manualReductions = projectIds.length
      ? await ManualCarbonReduction.find({
          projectId: { $in: projectIds },
          siteId,
          userId: user.email,
          unit: "kg CO₂e",
          amount: { $gte: 0 },
        }).lean()
      : [];
    const manualTaskSavings = manualReductions.reduce((sum, reduction) => {
      const amount = reduction.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return sum;
      return verifiedTaskIds.has(String(reduction.taskId)) ? sum : sum + amount;
    }, 0);
    const activitySavings = totals.savings;
    const totalSavings = activitySavings + completedTaskSavings + manualTaskSavings;
    const canCalculateProgress =
      typeof baselineEmissions === "number" &&
      Number.isFinite(baselineEmissions) &&
      baselineEmissions > 0 &&
      typeof reductionTarget === "number" &&
      Number.isFinite(reductionTarget) &&
      reductionTarget > 0 &&
      typeof totalSavings === "number" &&
      Number.isFinite(totalSavings) &&
      totalSavings >= 0;
    const calculatedRequiredReduction = canCalculateProgress
      ? baselineEmissions * reductionTarget / 100
      : null;
    const hasValidRequiredReduction =
      typeof calculatedRequiredReduction === "number" &&
      Number.isFinite(calculatedRequiredReduction) &&
      calculatedRequiredReduction > 0;
    const requiredReduction = hasValidRequiredReduction ? calculatedRequiredReduction : null;
    const progressPercentage = hasValidRequiredReduction
      ? Math.min(100, Math.max(0, (totalSavings / calculatedRequiredReduction) * 100))
      : null;
    const remainingReduction = hasValidRequiredReduction
      ? Math.max(0, calculatedRequiredReduction - totalSavings)
      : null;

    const forecast = generateForecast(trend);

    return NextResponse.json({
      activities,
      totalEmissions: totals.emissions,
      activitySavings,
      completedTaskSavings,
      verifiedTaskSavings: completedTaskSavings,
      manualTaskSavings,
      totalSavings,
      netEmissions: totals.emissions - totalSavings,
      baselineEmissions,
      reductionTarget,
      baselineSetAt,
      requiredReduction,
      progressPercentage,
      remainingReduction,
      trend,
      forecast,
    });
  } catch (err) {
    if (err instanceof CarbonActivityContractError) {
      console.error("❌ Invalid CarbonActivity data in /api/carbon-trends:", err.message);
      return NextResponse.json({ error: "Carbon activity data is invalid; totals could not be calculated" }, { status: 422 });
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("❌ Error in /api/carbon-trends:", err);
    return NextResponse.json(
      {
        activities: [],
        totalEmissions: 0,
        activitySavings: 0,
        completedTaskSavings: 0,
        verifiedTaskSavings: 0,
        manualTaskSavings: 0,
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
      },
      { status: 500 }
    );
  }
}
