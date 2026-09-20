import CarbonActivity from "@/app/models/CarbonActivity";
import SustainabilityProfile from "@/app/models/profile";
import Project from "@/app/models/project";
import Site from "@/app/models/site";
import SustainableMaterial from "@/app/models/sustainableMaterial";
import Task from "@/app/models/task";
import { calculateActivityTotals } from "@/lib/carbonCalculation";
import { fetchEmissionFactors } from "@/lib/emissions";

export type DecisionRoomSource = "recorded_fact" | "deterministic_calculation";
type Recorded<T> = { value: T; sourceType: "recorded_fact" };
type Calculated<T> = { value: T; sourceType: "deterministic_calculation" };

export type DecisionRoomContext = {
  site: Recorded<Record<string, unknown>>;
  project: Recorded<Record<string, unknown>>;
  sustainabilityTarget: Recorded<Record<string, unknown> | null>;
  carbon: {
    activities: Array<Recorded<Record<string, unknown>>>;
    metrics: Calculated<Record<string, number | string>>;
  };
  materials: Array<Recorded<Record<string, unknown>>>;
  openTasks: Array<Recorded<Record<string, unknown>>>;
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

function populatedSupplier(value: unknown): Record<string, unknown> | null {
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

  const [activities, materials, openTasks, factors] = await Promise.all([
    CarbonActivity.find({ userId: userEmail, siteId }).sort({ createdAt: 1 }).lean(),
    // The current material model is a global catalog with no project foreign key.
    SustainableMaterial.find().populate("supplier").sort({ createdAt: -1 }).lean(),
    Task.find({ projectId, status: { $ne: "done" } }).sort({ createdAt: -1 }).lean(),
    fetchEmissionFactors(),
  ]);
  const calculationActivities = activities.map((activity) => ({
    id: idValue(activity._id), timestamp: toIsoDate(activity.createdAt) ?? new Date(0).toISOString(),
    description: stringValue(activity.description), type: activity.type,
    value: typeof activity.value === "number" && Number.isFinite(activity.value) ? activity.value : 0,
    sustainableEF: activity.sustainableEF, standardEF: activity.standardEF, fuelType: activity.fuelType,
  }));
  const totals = calculateActivityTotals(calculationActivities, factors);

  return {
    site: recorded({ id: idValue(site._id), name: stringValue(site.name), location: stringValue(site.location), projectType: stringValue(site.projectType), size: stringValue(site.size), startDate: toIsoDate(site.startDate), endDate: toIsoDate(site.endDate), budget: stringValue(site.budget), status: stringValue(site.status) }),
    project: recorded({ id: idValue(project._id), name: stringValue(project.name), description: stringValue(project.description), location: stringValue(project.location), startDate: toIsoDate(project.startDate), endDate: toIsoDate(project.endDate) }),
    sustainabilityTarget: recorded(profile ? { reductionTarget: typeof profile.reductionTarget === "number" ? profile.reductionTarget : 0, focusAreas: Array.isArray(profile.focusAreas) ? profile.focusAreas.filter((item): item is string => typeof item === "string") : [], sustainabilityGoals: stringValue(profile.sustainabilityGoals) } : null),
    carbon: {
      activities: activities.map((activity) => recorded({ id: idValue(activity._id), type: activity.type, value: activity.value, description: stringValue(activity.description), sustainableEF: numberOrNull(activity.sustainableEF), standardEF: numberOrNull(activity.standardEF), fuelType: stringOrNull(activity.fuelType), createdAt: toIsoDate(activity.createdAt) })),
      metrics: { value: { totalEmissions: totals.emissions, totalSavings: totals.savings, netEmissions: totals.emissions - totals.savings, activityCount: activities.length, unit: "kg CO₂" }, sourceType: "deterministic_calculation" },
    },
    materials: materials.map((material) => recorded({ id: idValue(material._id), name: stringValue(material.name), description: stringValue(material.description), category: stringValue(material.category), price: material.price, unit: stringValue(material.unit), availability: stringValue(material.availability), ecoImpact: material.ecoImpact, supplier: populatedSupplier(material.supplier) })),
    openTasks: openTasks.map((task) => recorded({ id: idValue(task._id), title: stringValue(task.title), description: stringValue(task.description), priority: stringValue(task.priority), impact: stringValue(task.impact), status: stringValue(task.status), estimatedCarbonReduction: numberOrNull(task.estimatedCarbonReduction), estimatedCarbonReductionUnit: "kg CO₂", dueDate: toIsoDate(task.dueDate), assignedTo: stringOrNull(task.assignedTo) })),
  };
}