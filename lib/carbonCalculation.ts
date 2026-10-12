// lib/carbon-calculations.ts

import { authoritativeEmissionFactors } from "@/lib/emissionFactors";
import {
  CarbonActivityContractError,
  validateCarbonActivityInput,
} from "@/lib/carbonActivityContract";

// Shared authoritative factors retained under this export for the existing
// client-side calculation helper API.
export const emissionFactors = authoritativeEmissionFactors;
  
  export interface CarbonActivity {
    id: string;
    timestamp: string;
    description: string;
    type: string;
    value: number;
    sustainableEF?: number;
    standardEF?: number;
    fuelType?: string;
    unit?: string;
  }
  
  export interface CarbonData {
    activities: CarbonActivity[];
    totalEmissions: number;
    activitySavings?: number;
    completedTaskSavings?: number;
    verifiedTaskSavings?: number;
    manualTaskSavings?: number;
    userReportedTaskSavings?: number;
    totalSavings: number;
    netEmissions: number;
    baselineEmissions?: number | null;
    reductionTarget?: number | null;
    baselineSetAt?: string | Date | null;
    requiredReduction?: number | null;
    progressPercentage?: number | null;
    remainingReduction?: number | null;
    trend: { time: string; emissions: number; savings: number; net: number }[];
    forecast?: { time: string; emissions: number; savings: number; net: number }[];
  }

  export type CarbonCalculationFactors = {
    energyGrid: number;
    energyDiesel: number;
    transport: number;
    fuelDiesel: number;
    wasteLandfill: number;
    water: number;
  };

  export const calculateActivityTotals = (
    activities: CarbonActivity[],
    factors: CarbonCalculationFactors
  ) => {
    for (const [name, factor] of Object.entries(factors)) {
      if (typeof factor !== "number" || !Number.isFinite(factor) || factor < 0) {
        throw new CarbonActivityContractError(`Emission factor ${name} is invalid`, name);
      }
    }

    return activities.reduce(
      (totals, activity) => {
        const validated = validateCarbonActivityInput(activity);
        const calculationActivity = {
          ...activity,
          type: validated.type,
          value: validated.value,
          standardEF: validated.standardEF,
          sustainableEF: validated.sustainableEF,
          fuelType: validated.fuelType,
        };
      let emissions = 0;
      let savings = 0;
      switch (calculationActivity.type) {
        case "energy": emissions = calculationActivity.value * (calculationActivity.fuelType === "diesel" ? factors.energyDiesel : factors.energyGrid); break;
        case "transport": emissions = calculationActivity.value * factors.transport; break;
        case "machinery": emissions = calculationActivity.value * factors.fuelDiesel; break;
        case "waste": emissions = calculationActivity.value * factors.wasteLandfill; break;
        case "water": emissions = calculationActivity.value * factors.water; break;
        case "renewable": savings = calculationActivity.value * factors.energyGrid; break;
        case "material": savings = calculationActivity.value * (calculationActivity.standardEF! - calculationActivity.sustainableEF!); break;
        case "recycling": savings = calculationActivity.value * factors.wasteLandfill; break;
        case "waterReuse": savings = calculationActivity.value * factors.water; break;
      }
      return { emissions: totals.emissions + emissions, savings: totals.savings + savings };
      },
      { emissions: 0, savings: 0 }
    );
  };

  export const emptyCarbonData: CarbonData = {
    activities: [],
    totalEmissions: 0,
    activitySavings: 0,
    completedTaskSavings: 0,
    totalSavings: 0,
    netEmissions: 0,
    trend: [],
    forecast: [],
  };
  
  // ---------- Carbon Calculation Functions ----------
  export const calculateEmissions = (activity: CarbonActivity): number => {
    validateCarbonActivityInput(activity);
    switch (activity.type) {
      case "energy":
        return activity.fuelType === "diesel"
          ? activity.value * emissionFactors.energyDiesel
          : activity.value * emissionFactors.energyGrid;
      case "transport":
        return activity.value * emissionFactors.transport;
      case "machinery":
        return activity.value * emissionFactors.fuelDiesel;
      case "waste":
        return activity.value * emissionFactors.wasteLandfill;
      case "water":
        return activity.value * emissionFactors.water;
      default:
        return 0;
    }
  };
  
  export const calculateSavings = (activity: CarbonActivity): number => {
    validateCarbonActivityInput(activity);
    switch (activity.type) {
      case "renewable":
        return activity.value * emissionFactors.energyGrid;
      case "material":
        return activity.value * (activity.standardEF! - activity.sustainableEF!);
      case "recycling":
        return activity.value * emissionFactors.wasteLandfill;
      case "waterReuse":
        return activity.value * emissionFactors.water;
      default:
        return 0;
    }
  };
  
  export const calculateEfficiencyScore = (data: CarbonData): string => {
    const emissions = data.totalEmissions ?? 0;
    const savings = data.totalSavings ?? 0;
  
    if (emissions === 0) return 'A+';
    const efficiency = (savings / emissions) * 100;
    if (efficiency >= 50) return 'A';
    if (efficiency >= 30) return 'B';
    if (efficiency >= 10) return 'C';
    return 'D';
  };
  