import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

const kpiSchema = new mongoose.Schema({
  title: String,
  value: Number,
  unit: String,
  status: String,
  trend: Number,
  icon: String,
  threshold: Number,
  lastUpdate: Date,
});

const KPI = mongoose.models.KPI || mongoose.model("KPI", kpiSchema);

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    await connectDB();
    const kpis = await KPI.find({});
    return NextResponse.json(kpis);
  } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch KPIs" }, { status: 500 });
  }
}
