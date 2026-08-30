import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

const carbonTrendSchema = new mongoose.Schema({
  time: Date,
  emissions: Number,
});

const carbonSchema = new mongoose.Schema({
  carbonEmitted: Number,
  carbonSaved: Number,
  trend: [carbonTrendSchema],
});

const Carbon = mongoose.models.Carbon || mongoose.model("Carbon", carbonSchema);

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    await connectDB();
    const carbon = await Carbon.findOne({}).sort({ _id: -1 });
    return NextResponse.json(carbon || { carbonEmitted: 0, carbonSaved: 0, trend: [] });
  } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch carbon data" }, { status: 500 });
  }
}
