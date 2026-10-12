import mongoose, { Document, Schema, models } from "mongoose";

export const MANUAL_CARBON_REDUCTION_UNIT = "kg CO₂e" as const;

export interface IManualCarbonReduction extends Document {
  taskId: mongoose.Types.ObjectId;
  projectId: string;
  siteId: string;
  userId: string;
  amount: number;
  unit: typeof MANUAL_CARBON_REDUCTION_UNIT;
  description?: string;
  provenance: "user-reported";
  verificationMethod: "user-confirmed";
  createdAt: Date;
  updatedAt: Date;
}

const ManualCarbonReductionSchema = new Schema<IManualCarbonReduction>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, unique: true },
    projectId: { type: String, required: true },
    siteId: { type: String, required: true },
    userId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: [MANUAL_CARBON_REDUCTION_UNIT], required: true },
    description: { type: String, default: "" },
    provenance: { type: String, enum: ["user-reported"], required: true, default: "user-reported" },
    verificationMethod: { type: String, enum: ["user-confirmed"], required: true, default: "user-confirmed" },
  },
  { timestamps: true }
);

export default models.ManualCarbonReduction ||
  mongoose.model<IManualCarbonReduction>("ManualCarbonReduction", ManualCarbonReductionSchema);