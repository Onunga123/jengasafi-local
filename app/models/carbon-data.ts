import mongoose, { Schema, Document } from "mongoose";

export interface ICarbonData extends Document {
  siteId: mongoose.Types.ObjectId;
  userId: string;
  reductionTarget: number;
  focusAreas: string[];
  baselineEmissions: number;
  currentEmissions: number;
  targetEmissions: number;
  reductionProgress: number;
  progressPercentage: number;
  baselineSetAt: Date | null;
  emissionsByCategory: {
    materials: number;
    energy: number;
    transportation: number;
    waste: number;
    water: number;
    other: number;
  };
  monthlyData: Array<{
    month: Date;
    emissions: number;
    materials: number;
    energy: number;
    transportation: number;
    waste: number;
    water: number;
    other: number;
  }>;
  status: "active" | "completed" | "archived";
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CarbonDataSchema = new Schema<ICarbonData>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    userId: { type: String, required: true },
    reductionTarget: { type: Number, default: 25, min: 0, max: 100 },
    focusAreas: [
      {
        type: String,
        enum: ["energy", "materials", "waste", "water", "transport", "biodiversity"],
      },
    ],
    baselineEmissions: { type: Number, default: 0, min: 0 },
    currentEmissions: { type: Number, default: 0, min: 0 },
    targetEmissions: { type: Number, default: 0, min: 0 },
    reductionProgress: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    baselineSetAt: { type: Date, default: null },
    emissionsByCategory: {
      materials: { type: Number, default: 0 },
      energy: { type: Number, default: 0 },
      transportation: { type: Number, default: 0 },
      waste: { type: Number, default: 0 },
      water: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    monthlyData: [
      {
        month: { type: Date, required: true },
        emissions: { type: Number, default: 0 },
        materials: { type: Number, default: 0 },
        energy: { type: Number, default: 0 },
        transportation: { type: Number, default: 0 },
        waste: { type: Number, default: 0 },
        water: { type: Number, default: 0 },
        other: { type: Number, default: 0 },
      },
    ],
    status: { type: String, enum: ["active", "completed", "archived"], default: "active" },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Auto-calc target + progress
CarbonDataSchema.pre("save", function (next) {
  if (this.baselineEmissions > 0) {
    this.targetEmissions = this.baselineEmissions * (1 - this.reductionTarget / 100);
    const reduction = this.baselineEmissions - this.currentEmissions;
    this.reductionProgress = Math.max(0, reduction);
    this.progressPercentage = Math.min(
      100,
      (reduction / (this.baselineEmissions - this.targetEmissions)) * 100
    );
  }
  this.lastUpdated = new Date();
  next();
});

export default mongoose.models.CarbonData ||
  mongoose.model<ICarbonData>("CarbonData", CarbonDataSchema);
