import { CarbonActivityType } from "@/types/CarbonActivity";

type InsightActivity = {
  type: string;
  value: number;
};

type InsightFactors = {
  water: number;
};

export function buildCarbonInsights(
  activities: InsightActivity[],
  factors: InsightFactors
): string[] {
  if (!activities.length) return [];

  let totalEnergy = 0;
  let renewableEnergy = 0;
  let transportFuel = 0;
  let wasteGenerated = 0;
  let waterUse = 0;

  for (const activity of activities) {
    if (activity.type === CarbonActivityType.ENERGY) totalEnergy += activity.value;
    else if (activity.type === CarbonActivityType.RENEWABLE) renewableEnergy += activity.value;
    else if (activity.type === CarbonActivityType.TRANSPORT) transportFuel += activity.value;
    else if (activity.type === CarbonActivityType.WASTE) wasteGenerated += activity.value;
    else if (activity.type === CarbonActivityType.WATER) waterUse += activity.value;
  }

  const insights: string[] = [];
  const renewablePct = totalEnergy > 0 ? (renewableEnergy / totalEnergy) * 100 : 0;

  if (renewablePct < 20) {
    insights.push(`Only ${renewablePct.toFixed(1)}% of your energy comes from renewables. Consider solar or PPAs with Kenya Power’s green tariff.`);
  } else {
    insights.push(`Great work — ${renewablePct.toFixed(1)}% of your energy is renewable, above the local industry baseline.`);
  }
  if (transportFuel > 1000) insights.push("Transport fuel usage is high. Explore EV fleets or optimize logistics to cut emissions.");
  if (wasteGenerated > 500) insights.push("Waste generation is above average. Implement recycling or composting to offset landfill emissions.");
  if (waterUse > 200) insights.push(`Your water usage is significant. Water reuse/recycling could save ~${(waterUse * factors.water).toFixed(1)} kgCO₂.`);
  if (!insights.length) insights.push("Your site is performing well. Keep monitoring for improvements!");

  return insights;
}