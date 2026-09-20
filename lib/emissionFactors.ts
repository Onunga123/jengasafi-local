// Shared client/server-safe authoritative emission factors.
// The current application value for grid electricity is 0.43 kg CO₂/kWh.

export type AuthoritativeEmissionFactors = {
  energyGrid: number;
  energyDiesel: number;
  transport: number;
  fuelDiesel: number;
  wasteLandfill: number;
  water: number;
  materialStandard: number;
  materialSustainable: number;
};

export const authoritativeEmissionFactors: AuthoritativeEmissionFactors = {
  energyGrid: 0.43,
  energyDiesel: 2.68,
  transport: 0.12,
  fuelDiesel: 2.68,
  wasteLandfill: 1.90,
  water: 0.34,
  materialStandard: 800,
  materialSustainable: 350,
};