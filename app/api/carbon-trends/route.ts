import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CarbonActivity from "@/app/models/CarbonActivity";
import CarbonData from "@/app/models/carbon-data";
import Project from "@/app/models/project";
import Task from "@/app/models/task";
import { fetchEmissionFactors } from "@/lib/emissions";
import { generateForecast } from "@/lib/forecast";
import { CarbonActivityType } from "@/types/CarbonActivity";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { calculateActivityTotals } from "@/lib/carbonCalculation";

const clean = (n: any) => (typeof n === "number" && isFinite(n) ? n : 0);

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
    const calculationActivities = activities.map((act) => ({
      id: String(act._id),
      timestamp: new Date(act.createdAt).toISOString(),
      description: act.description ?? "",
      type: act.type,
      value: clean(act.value),
      sustainableEF: act.sustainableEF,
      standardEF: act.standardEF,
      fuelType: act.fuelType,
    }));

    const trend: any[] = [];

    activities.forEach((act) => {
      let emissions = 0;
      let savings = 0;

      // Savings activities
      if (
        [
          CarbonActivityType.RENEWABLE,
          CarbonActivityType.MATERIAL,
          CarbonActivityType.RECYCLING,
          CarbonActivityType.WATER_REUSE,
        ].includes(act.type as CarbonActivityType)
      ) {
        if (act.type === CarbonActivityType.RENEWABLE) {
          savings = clean(act.value) * clean(factors.energyGrid);
        } else if (act.type === CarbonActivityType.MATERIAL) {
          savings =
            clean(act.value) *
            (clean(act.standardEF) - clean(act.sustainableEF));
        } else if (act.type === CarbonActivityType.RECYCLING) {
          savings = clean(act.value) * clean(factors.wasteLandfill);
        } else if (act.type === CarbonActivityType.WATER_REUSE) {
          savings = clean(act.value) * clean(factors.water);
        }
      } else {
        // Emissions activities
        if (act.type === CarbonActivityType.ENERGY) {
          emissions =
            act.fuelType === "diesel"
              ? clean(act.value) * clean(factors.energyDiesel)
              : clean(act.value) * clean(factors.energyGrid);
        } else if (act.type === CarbonActivityType.TRANSPORT) {
          emissions = clean(act.value) * clean(factors.transport);
        } else if (act.type === CarbonActivityType.MACHINERY) {
          emissions = clean(act.value) * clean(factors.fuelDiesel);
        } else if (act.type === CarbonActivityType.WASTE) {
          emissions = clean(act.value) * clean(factors.wasteLandfill);
        } else if (act.type === CarbonActivityType.WATER) {
          emissions = clean(act.value) * clean(factors.water);
        }
      }

      trend.push({
        time: act.createdAt,
        emissions: clean(emissions),
        savings: clean(savings),
        net: clean(emissions - savings),
      });
    });

    const totals = calculateActivityTotals(calculationActivities, factors);
    const ownedProjects = siteId
      ? await Project.find({ userId: user.email, siteId }).select("_id").lean()
      : [];
    const projectIds = ownedProjects.map((project) => String(project._id));
    const completedTasks = projectIds.length
      ? await Task.find({ projectId: { $in: projectIds }, status: "done" })
          .select("actualCarbonReduction")
          .lean()
      : [];
    const completedTaskSavings = completedTasks.reduce((sum, task) => {
      const reduction = task.actualCarbonReduction;
      return typeof reduction === "number" && Number.isFinite(reduction) && reduction >= 0
        ? sum + reduction
        : sum;
    }, 0);
    const activitySavings = clean(totals.savings);
    const totalSavings = activitySavings + completedTaskSavings;
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
      totalEmissions: clean(totals.emissions),
      activitySavings,
      completedTaskSavings,
      totalSavings,
      netEmissions: clean(totals.emissions - totalSavings),
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
