// lib/emissions.ts
// Server-facing access to the application's centralized emission factors.

import {
  authoritativeEmissionFactors,
  AuthoritativeEmissionFactors,
} from "@/lib/emissionFactors";

export type EmissionFactors = AuthoritativeEmissionFactors;

export async function fetchEmissionFactors(): Promise<EmissionFactors> {
  return authoritativeEmissionFactors;
}