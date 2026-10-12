import mongoose from "mongoose";
import SustainableMaterial from "@/app/models/sustainableMaterial";

export class TaskMaterialValidationError extends Error {
  status = 400;
}

export async function validateTaskMaterialFields(fields: {
  materialId?: unknown;
  plannedMaterialQuantity?: unknown;
}) {
  const hasMaterialId = fields.materialId !== undefined;
  const hasPlannedQuantity = fields.plannedMaterialQuantity !== undefined;

  if (hasMaterialId) {
    if (typeof fields.materialId !== "string" || !mongoose.isValidObjectId(fields.materialId)) {
      throw new TaskMaterialValidationError("materialId must be a valid Material identifier");
    }

    const material = await SustainableMaterial.findById(fields.materialId).select("_id").lean();
    if (!material) {
      throw new TaskMaterialValidationError("The referenced Material does not exist in the global Materials catalog");
    }
  }

  if (hasPlannedQuantity &&
    (typeof fields.plannedMaterialQuantity !== "number" ||
      !Number.isFinite(fields.plannedMaterialQuantity) ||
      fields.plannedMaterialQuantity <= 0)
  ) {
    throw new TaskMaterialValidationError("plannedMaterialQuantity must be a finite number greater than zero");
  }
}