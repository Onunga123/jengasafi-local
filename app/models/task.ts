// models/Task.ts
import mongoose, { Schema, Document, models } from "mongoose";
import { CarbonActivityType } from "@/types/CarbonActivity";
import type { TaskWorkflowType } from "@/lib/taskWorkflow";

export interface ITask extends Document {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "done";
  taskType?: TaskWorkflowType;
  projectId: string;
  materialId?: mongoose.Types.ObjectId;
  plannedMaterialQuantity?: number;
  estimatedCarbonReduction?: number; // kg CO₂
  actualCarbonReduction?: number; // kg CO₂
  carbonReductionActivityType?: CarbonActivityType;
  carbonReductionQuantity?: number;
  carbonReductionUnit?: string;
  carbonReductionFuelType?: "grid" | "diesel" | "petrol" | "hybrid" | "electric";
  carbonImpactStatus?: "verified" | "not-verifiable";
  carbonImpactReason?: string;
  measurementActivityType?: CarbonActivityType;
  measurementMode?: "none" | "baseline-post-action";
  measurementStatus?:
    | "baseline-pending"
    | "post-action-pending"
    | "ready-to-calculate"
    | "verified"
    | "not-verifiable";
  baselineActivityId?: mongoose.Types.ObjectId;
  postActionActivityId?: mongoose.Types.ObjectId;
  carbonSavingsLinkedAt?: Date;
  manualCarbonReduction?: number;
  manualCarbonReductionUnit?: string;
  manualCarbonReductionDescription?: string;
  manualCarbonReductionProvenance?: "user-reported";
  manualCarbonReductionRecordedAt?: Date;
  dueDate?: Date;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    impact: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["todo", "in-progress", "done"],
      default: "todo",
    },
    taskType: {
      type: String,
      enum: ["standard", "inventory"],
      default: "standard",
    },
    projectId: { type: String, required: true },
    materialId: { type: Schema.Types.ObjectId, ref: "SustainableMaterial" },
    plannedMaterialQuantity: { type: Number, min: 0 },
    estimatedCarbonReduction: { type: Number },
    actualCarbonReduction: { type: Number },
    carbonReductionActivityType: {
      type: String,
      enum: Object.values(CarbonActivityType),
    },
    carbonReductionQuantity: { type: Number, min: 0 },
    carbonReductionUnit: { type: String },
    carbonReductionFuelType: {
      type: String,
      enum: ["grid", "diesel", "petrol", "hybrid", "electric"],
    },
    carbonImpactStatus: {
      type: String,
      enum: ["verified", "not-verifiable"],
    },
    carbonImpactReason: { type: String },
    measurementActivityType: {
      type: String,
      enum: Object.values(CarbonActivityType),
    },
    measurementMode: {
      type: String,
      enum: ["none", "baseline-post-action"],
    },
    measurementStatus: {
      type: String,
      enum: [
        "baseline-pending",
        "post-action-pending",
        "ready-to-calculate",
        "verified",
        "not-verifiable",
      ],
    },
    baselineActivityId: { type: Schema.Types.ObjectId, ref: "CarbonActivity" },
    postActionActivityId: { type: Schema.Types.ObjectId, ref: "CarbonActivity" },
    carbonSavingsLinkedAt: { type: Date },
    dueDate: { type: Date },
    assignedTo: { type: String },
  },
  { timestamps: true }
);

export default models.Task || mongoose.model<ITask>("Task", TaskSchema);