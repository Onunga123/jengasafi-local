import mongoose from "mongoose";
import CarbonActivity from "@/app/models/CarbonActivity";
import { CarbonActivityType } from "@/types/CarbonActivity";
import { calculateActivityTotals } from "@/lib/carbonCalculation";
import { fetchEmissionFactors } from "@/lib/emissions";

export class TaskMeasurementValidationError extends Error {
  status = 400;
}

export function isVerifiedTaskCarbonReduction(
  value: unknown,
  status: unknown
): value is number {
  return status === "verified" && typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function getTaskCarbonReductionStatus(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0
    ? "verified" as const
    : "not-verifiable" as const;
}

export function isNegativeTaskCarbonReduction(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value < 0;
}

export function getTaskMeasurementStatus(task: {
  measurementMode?: "none" | "baseline-post-action";
  baselineActivityId?: unknown;
  postActionActivityId?: unknown;
  actualCarbonReduction?: unknown;
  carbonImpactStatus?: "verified" | "not-verifiable";
}) {
  if (task.measurementMode !== "baseline-post-action") return undefined;
  if (isNegativeTaskCarbonReduction(task.actualCarbonReduction)) return "not-verifiable" as const;
  if (
    task.baselineActivityId &&
    task.postActionActivityId &&
    isVerifiedTaskCarbonReduction(task.actualCarbonReduction, task.carbonImpactStatus)
  ) {
    return "verified" as const;
  }
  if (task.baselineActivityId && task.postActionActivityId) return "ready-to-calculate" as const;
  if (task.baselineActivityId) return "post-action-pending" as const;
  return "baseline-pending" as const;
}

type ValidateTaskMeasurementInput = {
  siteId: unknown;
  userId: string;
  measurementActivityType?: unknown;
  baselineActivityId?: unknown;
  postActionActivityId?: unknown;
  /**
   * When provided, referenced activities must not be explicitly associated with a different task
   * (null = the task does not exist yet) and must not be associated with the opposite measurement phase.
   * When omitted, association checks are skipped (used by the calculation path).
   */
  associationTaskId?: string | null;
};

export async function validateTaskMeasurement({
  siteId,
  userId,
  measurementActivityType,
  baselineActivityId,
  postActionActivityId,
  associationTaskId,
}: ValidateTaskMeasurementInput) {
  const hasBaseline = baselineActivityId !== undefined && baselineActivityId !== null && baselineActivityId !== "";
  const hasPostAction = postActionActivityId !== undefined && postActionActivityId !== null && postActionActivityId !== "";
  const hasMeasurementType = measurementActivityType !== undefined && measurementActivityType !== null && measurementActivityType !== "";

  if (hasMeasurementType && !Object.values(CarbonActivityType).includes(measurementActivityType as CarbonActivityType)) {
    throw new TaskMeasurementValidationError("Invalid measurement activity type");
  }

  const activityIds = [
    ...(hasBaseline ? [baselineActivityId] : []),
    ...(hasPostAction ? [postActionActivityId] : []),
  ];

  for (const activityId of activityIds) {
    if (!mongoose.isValidObjectId(activityId)) {
      throw new TaskMeasurementValidationError("Invalid CarbonActivity reference");
    }
  }

  if (hasBaseline && hasPostAction && String(baselineActivityId) === String(postActionActivityId)) {
    throw new TaskMeasurementValidationError("The same CarbonActivity cannot be both the baseline and the post-action measurement");
  }

  if (!activityIds.length) return;

  const activities = await CarbonActivity.find({
    _id: { $in: activityIds },
    userId,
    siteId: String(siteId),
  }).lean();

  if (activities.length !== activityIds.length) {
    throw new TaskMeasurementValidationError("Referenced CarbonActivity was not found for this user's project site");
  }

  for (const activity of activities) {
    if (hasMeasurementType && activity.type !== measurementActivityType) {
      throw new TaskMeasurementValidationError("CarbonActivity type does not match the task measurement activity type");
    }

    if (associationTaskId !== undefined && activity.taskId) {
      if (associationTaskId === null || String(activity.taskId) !== associationTaskId) {
        throw new TaskMeasurementValidationError("CarbonActivity is already associated with another task");
      }

      const expectedPhase = String(activity._id) === String(baselineActivityId) ? "baseline" : "post-action";
      if (activity.measurementPhase && activity.measurementPhase !== expectedPhase) {
        throw new TaskMeasurementValidationError("CarbonActivity measurement phase does not match its task role");
      }
    }
  }

  if (hasBaseline && hasPostAction) {
    const baseline = activities.find((activity) => String(activity._id) === String(baselineActivityId));
    const postAction = activities.find((activity) => String(activity._id) === String(postActionActivityId));

    if (!baseline || !postAction || baseline.type !== postAction.type) {
      throw new TaskMeasurementValidationError("Baseline and post-action activities must have the same activity type");
    }
  }

  return activities;
}

type TaskMeasurementCalculationInput = ValidateTaskMeasurementInput;

type DirectTaskCarbonReductionInput = {
  carbonReductionActivityType?: unknown;
  carbonReductionQuantity?: unknown;
  carbonReductionUnit?: unknown;
  carbonReductionFuelType?: unknown;
};

type TaskCarbonReductionCalculationInput = TaskMeasurementCalculationInput &
  DirectTaskCarbonReductionInput;

type TaskMeasurementCalculationResult = {
  value: number | null;
  reason?: string;
};

const DIRECT_EMISSION_ACTIVITY_TYPES = new Set<CarbonActivityType>([
  CarbonActivityType.ENERGY,
  CarbonActivityType.TRANSPORT,
  CarbonActivityType.MACHINERY,
  CarbonActivityType.WASTE,
  CarbonActivityType.WATER,
]);

const DIRECT_SAVING_ACTIVITY_TYPES = new Set<CarbonActivityType>([
  CarbonActivityType.RENEWABLE,
  CarbonActivityType.RECYCLING,
  CarbonActivityType.WATER_REUSE,
]);

export async function calculateDirectTaskCarbonReduction({
  carbonReductionActivityType,
  carbonReductionQuantity,
  carbonReductionUnit,
  carbonReductionFuelType,
}: DirectTaskCarbonReductionInput): Promise<TaskMeasurementCalculationResult> {
  if (!Object.values(CarbonActivityType).includes(carbonReductionActivityType as CarbonActivityType)) {
    return { value: null, reason: "missing or invalid carbon reduction definition" };
  }

  const activityType = carbonReductionActivityType as CarbonActivityType;

  if (typeof carbonReductionQuantity !== "number" || !Number.isFinite(carbonReductionQuantity) || carbonReductionQuantity <= 0) {
    return { value: null, reason: "missing or invalid carbon reduction definition" };
  }

  if (typeof carbonReductionUnit !== "string" || !carbonReductionUnit) {
    return { value: null, reason: "missing or invalid carbon reduction definition" };
  }

  if (
    activityType === CarbonActivityType.MATERIAL ||
    (!DIRECT_EMISSION_ACTIVITY_TYPES.has(activityType) &&
      !DIRECT_SAVING_ACTIVITY_TYPES.has(activityType))
  ) {
    return { value: null, reason: "insufficient data for direct carbon reduction calculation" };
  }

  const factors = await fetchEmissionFactors();
  const totals = calculateActivityTotals(
    [
      {
        id: "task-carbon-reduction",
        timestamp: new Date().toISOString(),
        description: "Task carbon reduction",
        type: activityType,
        value: carbonReductionQuantity,
        unit: carbonReductionUnit,
        fuelType: typeof carbonReductionFuelType === "string" ? carbonReductionFuelType : undefined,
      },
    ],
    factors
  );
  const reduction = DIRECT_EMISSION_ACTIVITY_TYPES.has(activityType)
    ? totals.emissions
    : totals.savings;

  if (!Number.isFinite(reduction) || reduction < 0) {
    return { value: null, reason: "insufficient data for direct carbon reduction calculation" };
  }

  return { value: reduction };
}

export async function calculateTaskActualCarbonReduction({
  siteId,
  userId,
  measurementActivityType,
  baselineActivityId,
  postActionActivityId,
  carbonReductionActivityType,
  carbonReductionQuantity,
  carbonReductionUnit,
  carbonReductionFuelType,
}: TaskCarbonReductionCalculationInput): Promise<TaskMeasurementCalculationResult> {
  const hasCompleteConfiguration =
    measurementActivityType !== undefined &&
    measurementActivityType !== null &&
    measurementActivityType !== "" &&
    baselineActivityId !== undefined &&
    baselineActivityId !== null &&
    baselineActivityId !== "" &&
    postActionActivityId !== undefined &&
    postActionActivityId !== null &&
    postActionActivityId !== "";

  if (!hasCompleteConfiguration) {
    return calculateDirectTaskCarbonReduction({
      carbonReductionActivityType,
      carbonReductionQuantity,
      carbonReductionUnit,
      carbonReductionFuelType,
    });
  }

  const activities = await validateTaskMeasurement({
    siteId,
    userId,
    measurementActivityType,
    baselineActivityId,
    postActionActivityId,
  });

  if (!activities || activities.length < 2) {
    return { value: null, reason: "missing baseline/post-action measurement" };
  }

  const baseline = activities.find((activity) => String(activity._id) === String(baselineActivityId));
  const postAction = activities.find((activity) => String(activity._id) === String(postActionActivityId));

  if (!baseline || !postAction) {
    return { value: null, reason: "missing baseline/post-action measurement" };
  }

  for (const activity of [baseline, postAction]) {
    if (typeof activity.value !== "number" || !Number.isFinite(activity.value)) {
      throw new TaskMeasurementValidationError("Referenced CarbonActivity has an invalid activity value");
    }

    if (
      activity.type === CarbonActivityType.MATERIAL &&
      (typeof activity.standardEF !== "number" || !Number.isFinite(activity.standardEF) ||
        typeof activity.sustainableEF !== "number" || !Number.isFinite(activity.sustainableEF))
    ) {
      throw new TaskMeasurementValidationError("Referenced material CarbonActivity has invalid emission factors");
    }
  }

  const factors = await fetchEmissionFactors();
  const toCalculationActivity = (activity: typeof baseline) => ({
    id: String(activity._id),
    timestamp: new Date(activity.createdAt).toISOString(),
    description: activity.description ?? "",
    type: activity.type,
    value: activity.value,
    sustainableEF: activity.sustainableEF,
    standardEF: activity.standardEF,
    fuelType: activity.fuelType,
  });
  const baselineTotals = calculateActivityTotals([toCalculationActivity(baseline)], factors);
  const postActionTotals = calculateActivityTotals([toCalculationActivity(postAction)], factors);
  const reduction =
    baselineTotals.emissions - baselineTotals.savings -
    (postActionTotals.emissions - postActionTotals.savings);

  if (!Number.isFinite(reduction)) {
    return { value: null, reason: "insufficient CarbonActivity data" };
  }

  return { value: reduction };
}