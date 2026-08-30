import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CarbonData from "@/app/models/carbon-data";
import Site from "@/app/models/site";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;

    if (!body.siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }

    // Check existing carbon data
    const site = await Site.findOne({ _id: body.siteId, userId: user.email }).select("_id");
    if (!site) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existingData = await CarbonData.findOne({ siteId: body.siteId, userId: user.email });
    if (existingData) {
      return NextResponse.json(existingData);
    }

    const carbonData = await CarbonData.create({
      siteId: body.siteId,
      userId: user.email,
      reductionTarget: body.reductionTarget || 25,
      focusAreas: body.focusAreas || [],
      baselineEmissions: 0,
      currentEmissions: 0,
      targetEmissions: 0,
      reductionProgress: 0,
      progressPercentage: 0,
      emissionsByCategory: {
        materials: 0,
        energy: 0,
        transportation: 0,
        waste: 0,
        water: 0,
        other: 0,
      },
      monthlyData: [],
      status: "active",
    });

    return NextResponse.json(carbonData);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error initializing carbon data:", err);
    return NextResponse.json({ error: "Failed to initialize carbon data" }, { status: 500 });
  }
}
