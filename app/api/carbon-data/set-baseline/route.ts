import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import CarbonData from "@/app/models/carbon-data";
import Site from "@/app/models/site";
import CarbonActivity from "@/app/models/CarbonActivity";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { fetchEmissionFactors } from "@/lib/emissions";
import { calculateActivityTotals } from "@/lib/carbonCalculation";

// POST /api/carbon-data/set-baseline
//
// Freezes the current site-scoped Carbon Intelligence emissions total as the
// CarbonData baseline for the site, exactly once. The emissions value is
// always calculated server-side using the same CarbonActivity + emission
// factor logic already used by /api/carbon-trends; a client-supplied value
// is never trusted. The write is performed with an atomic conditional
// update so that only one concurrent request can ever set the baseline.
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();

    const body = (await req.json()) as Record<string, unknown>;
    const siteId = typeof body.siteId === "string" ? body.siteId : null;

    if (!siteId || !mongoose.isValidObjectId(siteId)) {
      return NextResponse.json({ error: "A valid siteId is required" }, { status: 400 });
    }

    const site = await Site.findOne({ _id: siteId, userId: user.email }).select("_id");
    if (!site) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const carbonData = await CarbonData.findOne({ siteId, userId: user.email });
    if (!carbonData) {
      return NextResponse.json({ error: "CarbonData not found for this site" }, { status: 404 });
    }

    if (carbonData.baselineSetAt) {
      return NextResponse.json({ error: "Baseline has already been set for this site" }, { status: 409 });
    }

    // Calculate the current site-scoped emissions total using the same
    // CarbonActivity records and emission-factor logic as /api/carbon-trends.
    // Task savings are intentionally excluded: the baseline is the emissions
    // total only, not the combined Carbon Intelligence savings figure.
    const activities = await CarbonActivity.find({ userId: user.email, siteId }).lean();
    const factors = await fetchEmissionFactors();
    const calculationActivities = activities.map((activity) => ({
      id: String(activity._id),
      timestamp: new Date(activity.createdAt).toISOString(),
      description: activity.description ?? "",
      type: activity.type,
      value: activity.value,
      sustainableEF: activity.sustainableEF,
      standardEF: activity.standardEF,
      fuelType: activity.fuelType,
    }));
    const totals = calculateActivityTotals(calculationActivities, factors);
    const totalEmissions = totals.emissions;

    if (typeof totalEmissions !== "number" || !Number.isFinite(totalEmissions) || totalEmissions < 0) {
      console.error("❌ Invalid calculated emissions while setting baseline:", totalEmissions);
      return NextResponse.json({ error: "Failed to calculate a valid emissions baseline" }, { status: 500 });
    }

    // Atomic conditional update: only succeeds if the baseline is still
    // unset at the moment of the write. This guarantees that two
    // simultaneous requests cannot both set the baseline.
    const updated = await CarbonData.findOneAndUpdate(
      {
        siteId,
        userId: user.email,
        $or: [{ baselineSetAt: null }, { baselineSetAt: { $exists: false } }],
      },
      {
        $set: {
          baselineEmissions: totalEmissions,
          baselineSetAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Baseline has already been set for this site" }, { status: 409 });
    }

    return NextResponse.json({
      siteId: String(updated.siteId),
      baselineEmissions: updated.baselineEmissions,
      baselineSetAt: updated.baselineSetAt,
      reductionTarget: updated.reductionTarget,
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("❌ Error setting carbon data baseline:", err);
    return NextResponse.json({ error: "Failed to set baseline" }, { status: 500 });
  }
}
