import { CarbonActivityType } from "@/types/CarbonActivity";

export const CARBON_ACTIVITY_UNITS: Record<CarbonActivityType, string> = {
  [CarbonActivityType.ENERGY]: "kWh",
  [CarbonActivityType.RENEWABLE]: "kWh",
  [CarbonActivityType.TRANSPORT]: "km",
  [CarbonActivityType.MACHINERY]: "litres",
  [CarbonActivityType.MATERIAL]: "tons",
  [CarbonActivityType.WASTE]: "kg",
  [CarbonActivityType.RECYCLING]: "kg",
  [CarbonActivityType.WATER]: "m³",
  [CarbonActivityType.WATER_REUSE]: "m³",
};

const CARBON_ACTIVITY_TYPES = new Set<string>(Object.values(CarbonActivityType));
const FUEL_TYPES = new Set(["diesel", "grid", "petrol", "hybrid", "electric"]);
const LEGACY_ACTIVITY_TYPE_ALIASES: Record<string, CarbonActivityType> = {
  material_savings: CarbonActivityType.MATERIAL,
};

export class CarbonActivityContractError extends Error {
  readonly status = 400;
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "CarbonActivityContractError";
    this.field = field;
  }
}

export type CarbonActivityContractInput = {
  type?: unknown;
  value?: unknown;
  standardEF?: unknown;
  sustainableEF?: unknown;
  fuelType?: unknown;
};

export type NormalizedCarbonActivity = {
  id: string;
  timestamp: string;
  description: string;
  type: CarbonActivityType;
  value: number;
  sustainableEF?: number;
  standardEF?: number;
  fuelType?: string;
  unit: string;
};

function requireFiniteNonNegative(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CarbonActivityContractError(`${field} must be a finite, non-negative number`, field);
  }
  return value;
}

function requireNonNegativeFactor(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CarbonActivityContractError(`${field} must be a finite, non-negative number`, field);
  }
  return value;
}

export function normalizeCarbonActivityInput(input: CarbonActivityContractInput) {
  const normalizedType = typeof input.type === "string"
    ? LEGACY_ACTIVITY_TYPE_ALIASES[input.type] ?? input.type
    : input.type;

  if (typeof normalizedType !== "string" || !CARBON_ACTIVITY_TYPES.has(normalizedType)) {
    throw new CarbonActivityContractError("A valid carbon activity type is required", "type");
  }

  const type = normalizedType as CarbonActivityType;
  const value = requireFiniteNonNegative(input.value, "Activity value");

  if (
    input.fuelType !== undefined &&
    input.fuelType !== null &&
    input.fuelType !== "" &&
    (typeof input.fuelType !== "string" || !FUEL_TYPES.has(input.fuelType))
  ) {
    throw new CarbonActivityContractError("Fuel type is invalid", "fuelType");
  }

  const hasStandardEF = input.standardEF !== undefined && input.standardEF !== null && input.standardEF !== "";
  const hasSustainableEF = input.sustainableEF !== undefined && input.sustainableEF !== null && input.sustainableEF !== "";

  if (type === CarbonActivityType.MATERIAL) {
    if (!hasStandardEF || !hasSustainableEF) {
      throw new CarbonActivityContractError(
        "Material activities require standardEF and sustainableEF",
        "standardEF"
      );
    }
    requireNonNegativeFactor(input.standardEF, "standardEF");
    requireNonNegativeFactor(input.sustainableEF, "sustainableEF");
  }

  return {
    type,
    value,
    standardEF: type === CarbonActivityType.MATERIAL ? input.standardEF as number : undefined,
    sustainableEF: type === CarbonActivityType.MATERIAL ? input.sustainableEF as number : undefined,
    fuelType: typeof input.fuelType === "string" && input.fuelType ? input.fuelType : undefined,
  };
}

export function validateCarbonActivityInput(input: CarbonActivityContractInput) {
  return normalizeCarbonActivityInput(input);
}

export function normalizeCarbonActivityRecord(activity: {
  _id?: unknown;
  createdAt?: unknown;
  description?: unknown;
  type?: unknown;
  value?: unknown;
  standardEF?: unknown;
  sustainableEF?: unknown;
  fuelType?: unknown;
}): NormalizedCarbonActivity {
  const validated = validateCarbonActivityInput(activity);
  const date = activity.createdAt instanceof Date ? activity.createdAt : new Date(String(activity.createdAt));

  if (!Number.isFinite(date.getTime())) {
    throw new CarbonActivityContractError("Activity timestamp is invalid", "createdAt");
  }

  return {
    id: String(activity._id ?? "unknown"),
    timestamp: date.toISOString(),
    description: typeof activity.description === "string" ? activity.description : "",
    ...validated,
    unit: CARBON_ACTIVITY_UNITS[validated.type],
  };
}