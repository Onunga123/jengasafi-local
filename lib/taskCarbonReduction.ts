import { CarbonActivityType } from "@/types/CarbonActivity";

export type CarbonReductionFuelType = "grid" | "diesel" | "petrol" | "hybrid" | "electric";

const ACTIVITY_UNITS: Record<CarbonActivityType, string> = {
  [CarbonActivityType.ENERGY]: "kWh",
  [CarbonActivityType.RENEWABLE]: "kWh",
  [CarbonActivityType.TRANSPORT]: "km",
  [CarbonActivityType.MACHINERY]: "litres",
  [CarbonActivityType.WASTE]: "kg",
  [CarbonActivityType.RECYCLING]: "kg",
  [CarbonActivityType.WATER]: "m³",
  [CarbonActivityType.WATER_REUSE]: "m³",
  [CarbonActivityType.MATERIAL]: "tons",
};

const FUEL_TYPES: CarbonReductionFuelType[] = ["grid", "diesel", "petrol", "hybrid", "electric"];

export class TaskCarbonReductionValidationError extends Error {
  status = 400;
}

type TaskCarbonReductionDefinition = {
  carbonReductionActivityType?: unknown;
  carbonReductionQuantity?: unknown;
  carbonReductionUnit?: unknown;
  carbonReductionFuelType?: unknown;
};

const ACTIVITY_LABELS: Record<CarbonActivityType, string> = {
  [CarbonActivityType.ENERGY]: "Energy Consumption",
  [CarbonActivityType.RENEWABLE]: "Renewable Energy",
  [CarbonActivityType.TRANSPORT]: "Material Transport",
  [CarbonActivityType.MACHINERY]: "Machinery Fuel",
  [CarbonActivityType.WASTE]: "Waste to Landfill",
  [CarbonActivityType.RECYCLING]: "Waste Recycled",
  [CarbonActivityType.WATER]: "Water Consumption",
  [CarbonActivityType.WATER_REUSE]: "Water Reused",
  [CarbonActivityType.MATERIAL]: "Sustainable Material",
};

export function getCarbonReductionUnit(activityType: CarbonActivityType) {
  return ACTIVITY_UNITS[activityType];
}

export function getCarbonActivityLabel(activityType: CarbonActivityType) {
  return ACTIVITY_LABELS[activityType] ?? activityType;
}

export function validateTaskCarbonReductionDefinition({
  carbonReductionActivityType,
  carbonReductionQuantity,
  carbonReductionUnit,
  carbonReductionFuelType,
}: TaskCarbonReductionDefinition) {
  const values = [
    carbonReductionActivityType,
    carbonReductionQuantity,
    carbonReductionUnit,
    carbonReductionFuelType,
  ];
  const hasDefinition = values.some((value) => value !== undefined && value !== null && value !== "");

  if (!hasDefinition) return;

  if (!Object.values(CarbonActivityType).includes(carbonReductionActivityType as CarbonActivityType)) {
    throw new TaskCarbonReductionValidationError("Invalid carbon reduction activity type");
  }

  if (typeof carbonReductionQuantity !== "number" || !Number.isFinite(carbonReductionQuantity)) {
    throw new TaskCarbonReductionValidationError("Carbon reduction quantity must be numeric");
  }

  if (carbonReductionQuantity <= 0) {
    throw new TaskCarbonReductionValidationError("Carbon reduction quantity must be greater than zero");
  }

  const expectedUnit = getCarbonReductionUnit(carbonReductionActivityType as CarbonActivityType);
  if (carbonReductionUnit !== expectedUnit) {
    throw new TaskCarbonReductionValidationError(
      `Carbon reduction unit must be ${expectedUnit} for ${carbonReductionActivityType}`
    );
  }

  const isEnergy = carbonReductionActivityType === CarbonActivityType.ENERGY;
  if (isEnergy) {
    if (!FUEL_TYPES.includes(carbonReductionFuelType as CarbonReductionFuelType)) {
      throw new TaskCarbonReductionValidationError("A valid fuel/source is required for energy carbon reductions");
    }
  } else if (carbonReductionFuelType !== undefined && carbonReductionFuelType !== null && carbonReductionFuelType !== "") {
    throw new TaskCarbonReductionValidationError("Fuel/source metadata is only supported for energy carbon reductions");
  }
}

export function rejectClientCalculatedCarbonFields(body: Record<string, unknown>) {
  if ("actualCarbonReduction" in body) {
    throw new TaskCarbonReductionValidationError("actualCarbonReduction is calculated by the server");
  }

  if (["standardEF", "sustainableEF", "emissionFactor"].some((field) => field in body)) {
    throw new TaskCarbonReductionValidationError("Emission factors are managed by the server");
  }
}