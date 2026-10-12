import { z } from "zod";
import { CarbonActivityType } from "@/types/CarbonActivity";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId");

export const evidenceSourceSchema = z.enum(["recorded_project_data", "deterministic_calculation", "external_estimate", "ai_reasoning"]);
export const evidenceSchema = z.object({ statement: z.string().min(1), source: evidenceSourceSchema, sourceReference: z.string().min(1).nullable().optional() });
export const decisionRoomMeasurementSchema = z.object({
  mode: z.enum(["none", "baseline-post-action"]),
  activityType: z.nativeEnum(CarbonActivityType).optional(),
});
export const decisionRoomTaskTypeSchema = z.enum(["standard", "inventory"]);
export const decisionRoomResponseSchema = z.object({
  recommendation: z.string().min(1), reasoning: z.string().min(1), evidence: z.array(evidenceSchema),
  tradeoffs: z.array(z.string().min(1)), constraintsConsidered: z.array(z.string().min(1)), uncertainties: z.array(z.string().min(1)),
  nextSteps: z.array(z.object({ title: z.string().min(1), description: z.string().min(1), priority: z.enum(["low", "medium", "high"]), impact: z.enum(["low", "medium", "high"]), estimatedCarbonReduction: z.number().finite().nonnegative().nullable().optional(), dueDate: z.string().min(1).nullable().optional(), taskType: decisionRoomTaskTypeSchema.optional(), measurement: decisionRoomMeasurementSchema.optional(), materialId: objectIdSchema.optional(), plannedMaterialQuantity: z.number().finite().positive().optional() })),
});
export type DecisionRoomResponse = z.infer<typeof decisionRoomResponseSchema>;