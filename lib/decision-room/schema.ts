import { z } from "zod";

export const evidenceSourceSchema = z.enum(["recorded_project_data", "deterministic_calculation", "external_estimate", "ai_reasoning"]);
export const evidenceSchema = z.object({ statement: z.string().min(1), source: evidenceSourceSchema, sourceReference: z.string().min(1).nullable().optional() });
export const decisionRoomResponseSchema = z.object({
  recommendation: z.string().min(1), reasoning: z.string().min(1), evidence: z.array(evidenceSchema),
  tradeoffs: z.array(z.string().min(1)), constraintsConsidered: z.array(z.string().min(1)), uncertainties: z.array(z.string().min(1)),
  nextSteps: z.array(z.object({ title: z.string().min(1), description: z.string().min(1), priority: z.enum(["low", "medium", "high"]), impact: z.enum(["low", "medium", "high"]), estimatedCarbonReduction: z.number().finite().nonnegative().nullable().optional(), dueDate: z.string().min(1).nullable().optional() })),
});
export type DecisionRoomResponse = z.infer<typeof decisionRoomResponseSchema>;