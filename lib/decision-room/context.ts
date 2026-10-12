import CarbonActivity from "@/app/models/CarbonActivity";
import CarbonData from "@/app/models/carbon-data";
import SustainabilityProfile from "@/app/models/profile";
import Project from "@/app/models/project";
import Site from "@/app/models/site";
import SustainableMaterial from "@/app/models/sustainableMaterial";
import Task from "@/app/models/task";
import { calculateActivityTotals } from "@/lib/carbonCalculation";
import { fetchEmissionFactors } from "@/lib/emissions";
import { normalizeCarbonActivityRecord } from "@/lib/carbonActivityContract";
import { isVerifiedTaskCarbonReduction } from "@/lib/taskMeasurement";
import { resolveTaskWorkflowType } from "@/lib/taskWorkflow";
import { CarbonActivityType } from "@/types/CarbonActivity";

export type DecisionRoomSource = "recorded_fact" | "deterministic_calculation";
export type GroundedContextSource = DecisionRoomSource;
export type GroundedValue<T> = { value: T; sourceType: GroundedContextSource };
type Recorded<T> = GroundedValue<T> & { sourceType: "recorded_fact" };
type Calculated<T> = GroundedValue<T> & { sourceType: "deterministic_calculation" };

export type DecisionRoomSite = {
  id: string;
  name: string;
  location: string;
  projectType: string;
  size: string;
  startDate: string | null;
  endDate: string | null;
  budget: string;
  status: string;
};

export type DecisionRoomProject = {
  id: string;
  name: string;
  description: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
};

export type DecisionRoomSustainabilityTarget = {
  reductionTarget: number;
  focusAreas: string[];
  sustainabilityGoals: string;
};

export type DecisionRoomCarbonActivity = {
  id: string;
  type: CarbonActivityType;
  value: number;
  description: string;
  sustainableEF: number | null;
  standardEF: number | null;
  fuelType: string | null;
  createdAt: string | null;
};

export type DecisionRoomCarbonMetrics = {
  totalEmissions: number;
  totalSavings: number;
  netEmissions: number;
  activityCount: number;
  unit: "kg CO₂";
};

export type DecisionRoomSupplierSummary = {
  id: string;
  name: string;
  location: string;
  rating: number | null;
  certifications: string[];
  specialties: string[];
};

export type DecisionRoomMaterial = {
  materialId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  availability: string;
  ecoImpact: {
    carbonFootprint: number | null;
    waterUsage: number | null;
    recyclability: number | null;
    renewable: boolean;
    local: boolean;
  };
  supplier: DecisionRoomSupplierSummary | null;
};

export type DecisionRoomOpenTask = {
  id: string;
  title: string;
  description: string;
  priority: string;
  impact: string;
  status: string;
  estimatedCarbonReduction: number | null;
  estimatedCarbonReductionUnit: "kg CO₂";
  dueDate: string | null;
  assignedTo: string | null;
};

export type DecisionRoomProjectCarbonSummary = {
  totalTasks: number;
  completedVerifiedOutcomeCount: number;
  verifiedActualCarbonReduction: number;
  verifiedActualCarbonReductionUnit: "kg CO₂";
  measurementPendingTaskCount: number;
  notVerifiableTaskCount: number;
  inventoryTaskCount: number;
};

export type DecisionRoomSiteCarbonData = {
  reductionTargetPercentage: number | null;
  baselineEmissions: number | null;
  currentEmissions: number | null;
  targetEmissions: number | null;
  baselineSetAt: string | null;
};

export type DecisionRoomContext = {
  site: Recorded<DecisionRoomSite>;
  project: Recorded<DecisionRoomProject>;
  sustainabilityTarget: Recorded<DecisionRoomSustainabilityTarget | null>;
  carbon: {
    activities: Array<Recorded<DecisionRoomCarbonActivity>>;
    metrics: Calculated<DecisionRoomCarbonMetrics>;
  };
  materials: Array<Recorded<DecisionRoomMaterial>>;
  openTasks: Array<Recorded<DecisionRoomOpenTask>>;
  projectCarbonSummary: Calculated<DecisionRoomProjectCarbonSummary>;
  siteCarbonData: Recorded<DecisionRoomSiteCarbonData | null>;
};

function toIsoDate(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function stringOrNull(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function numberOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function idValue(value: unknown): string { return String(value); }
function recorded<T>(value: T): Recorded<T> { return { value, sourceType: "recorded_fact" }; }

export class DecisionRoomContextDataError extends Error {
  readonly code = "DECISION_ROOM_CONTEXT_DATA_INVALID" as const;
}

function populatedSupplier(value: unknown): DecisionRoomSupplierSummary | null {
  if (!value || typeof value !== "object") return null;
  const supplier = value as Record<string, unknown>;
  return {
    id: idValue(supplier._id), name: stringValue(supplier.name), location: stringValue(supplier.location),
    rating: numberOrNull(supplier.rating),
    certifications: Array.isArray(supplier.certification) ? supplier.certification.filter((item): item is string => typeof item === "string") : [],
    specialties: Array.isArray(supplier.specialties) ? supplier.specialties.filter((item): item is string => typeof item === "string") : [],
  };
}

export async function loadDecisionRoomContext({ userEmail, siteId, projectId }: {
  userEmail: string; siteId: string; projectId: string;
}): Promise<DecisionRoomContext | null> {
  const [siteResult, projectResult, profileResult] = await Promise.all([
    Site.findOne({ _id: siteId, userId: userEmail }).lean(),
    Project.findOne({ _id: projectId, siteId, userId: userEmail }).lean(),
    SustainabilityProfile.findOne({ userId: userEmail }).lean(),
  ]);
  const site = siteResult as unknown as Record<string, any> | null;
  const project = projectResult as unknown as Record<string, any> | null;
  const profile = profileResult as unknown as Record<string, any> | null;
  if (!site || !project) return null;

  const [activities, materials, openTasks, projectTasks, factors, siteCarbonData] = await Promise.all([
    CarbonActivity.find({ userId: userEmail, siteId }).sort({ createdAt: 1 }).lean(),
    // The current material model is a global catalog with no project foreign key.
    SustainableMaterial.find().populate("supplier").sort({ createdAt: -1 }).lean(),
    Task.find({ projectId, status: { $ne: "done" } }).sort({ createdAt: -1 }).lean(),
    Task.find({ projectId }).sort({ createdAt: -1 }).lean(),
    fetchEmissionFactors(),
    CarbonData.findOne({ siteId, userId: userEmail }).lean(),
  ]);
  const calculationActivities = activities.map(normalizeCarbonActivityRecord);
  const totals = calculateActivityTotals(calculationActivities, factors);
  const projectTaskSummary = projectTasks.reduce(
    (summary, task) => {
      const taskType = resolveTaskWorkflowType({
        taskType: task.taskType,
        title: task.title,
        description: task.description,
      });
      const isInventoryTask = taskType === "inventory";
      const isVerifiedActualReduction =
        task.status === "done" &&
        !isInventoryTask &&
        isVerifiedTaskCarbonReduction(task.actualCarbonReduction, task.carbonImpactStatus);

      if (isInventoryTask) summary.inventoryTaskCount += 1;
      if (
        task.measurementMode === "baseline-post-action" &&
        (task.measurementStatus === "baseline-pending" ||
          task.measurementStatus === "post-action-pending" ||
          task.measurementStatus === "ready-to-calculate")
      ) {
        summary.measurementPendingTaskCount += 1;
      }
      if (task.carbonImpactStatus === "not-verifiable") summary.notVerifiableTaskCount += 1;
      if (isVerifiedActualReduction) {
        const nextVerifiedActualCarbonReduction = summary.verifiedActualCarbonReduction + task.actualCarbonReduction;
        if (!Number.isFinite(nextVerifiedActualCarbonReduction)) {
          throw new DecisionRoomContextDataError("verified actual carbon reduction total exceeds numeric limits");
        }
        summary.completedVerifiedOutcomeCount += 1;
        summary.verifiedActualCarbonReduction = nextVerifiedActualCarbonReduction;
      }

      return summary;
    },
    {
      totalTasks: projectTasks.length,
      completedVerifiedOutcomeCount: 0,
      verifiedActualCarbonReduction: 0,
      verifiedActualCarbonReductionUnit: "kg CO₂" as const,
      measurementPendingTaskCount: 0,
      notVerifiableTaskCount: 0,
      inventoryTaskCount: 0,
    }
  );
  const recordedSiteCarbonData = siteCarbonData as unknown as {
    reductionTarget?: unknown;
    baselineEmissions?: unknown;
    currentEmissions?: unknown;
    targetEmissions?: unknown;
    baselineSetAt?: Date | string | null;
  } | null;

  return {
    site: recorded({ id: idValue(site._id), name: stringValue(site.name), location: stringValue(site.location), projectType: stringValue(site.projectType), size: stringValue(site.size), startDate: toIsoDate(site.startDate), endDate: toIsoDate(site.endDate), budget: stringValue(site.budget), status: stringValue(site.status) }),
    project: recorded({ id: idValue(project._id), name: stringValue(project.name), description: stringValue(project.description), location: stringValue(project.location), startDate: toIsoDate(project.startDate), endDate: toIsoDate(project.endDate) }),
    sustainabilityTarget: recorded(profile ? { reductionTarget: typeof profile.reductionTarget === "number" ? profile.reductionTarget : 0, focusAreas: Array.isArray(profile.focusAreas) ? profile.focusAreas.filter((item): item is string => typeof item === "string") : [], sustainabilityGoals: stringValue(profile.sustainabilityGoals) } : null),
    carbon: {
      activities: activities.map((activity) => recorded({ id: idValue(activity._id), type: activity.type, value: activity.value, description: stringValue(activity.description), sustainableEF: numberOrNull(activity.sustainableEF), standardEF: numberOrNull(activity.standardEF), fuelType: stringOrNull(activity.fuelType), createdAt: toIsoDate(activity.createdAt) })),
      metrics: { value: { totalEmissions: totals.emissions, totalSavings: totals.savings, netEmissions: totals.emissions - totals.savings, activityCount: activities.length, unit: "kg CO₂" }, sourceType: "deterministic_calculation" },
    },
    materials: materials.map((material) => recorded({
      materialId: idValue(material._id),
      name: stringValue(material.name),
      description: stringValue(material.description),
      category: stringValue(material.category),
      price: material.price,
      unit: stringValue(material.unit),
      availability: stringValue(material.availability),
      ecoImpact: {
        carbonFootprint: numberOrNull(material.ecoImpact?.carbonFootprint),
        waterUsage: numberOrNull(material.ecoImpact?.waterUsage),
        recyclability: numberOrNull(material.ecoImpact?.recyclability),
        renewable: material.ecoImpact?.renewable === true,
        local: material.ecoImpact?.local === true,
      },
      supplier: populatedSupplier(material.supplier),
    })),
    openTasks: openTasks.map((task) => recorded({ id: idValue(task._id), title: stringValue(task.title), description: stringValue(task.description), priority: stringValue(task.priority), impact: stringValue(task.impact), status: stringValue(task.status), estimatedCarbonReduction: numberOrNull(task.estimatedCarbonReduction), estimatedCarbonReductionUnit: "kg CO₂", dueDate: toIsoDate(task.dueDate), assignedTo: stringOrNull(task.assignedTo) })),
    projectCarbonSummary: { value: projectTaskSummary, sourceType: "deterministic_calculation" },
    siteCarbonData: recorded(recordedSiteCarbonData ? {
      reductionTargetPercentage: numberOrNull(recordedSiteCarbonData.reductionTarget),
      baselineEmissions: numberOrNull(recordedSiteCarbonData.baselineEmissions),
      currentEmissions: numberOrNull(recordedSiteCarbonData.currentEmissions),
      targetEmissions: numberOrNull(recordedSiteCarbonData.targetEmissions),
      baselineSetAt: toIsoDate(recordedSiteCarbonData.baselineSetAt),
    } : null),
  };
}