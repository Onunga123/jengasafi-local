import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CarbonActivity from "@/app/models/CarbonActivity";
import { fetchEmissionFactors } from "@/lib/emissions";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { buildCarbonInsights } from "@/lib/carbonInsights";
/**
 * /api/insights
 * Returns AI-style insights & recommendations from carbon activity data.
 */
export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId") || "default";

    // Fetch all activities for this site
    const activities = await CarbonActivity.find({ 
      userId: user.email,
      siteId 
    }).sort({
      createdAt: -1,
    });

    if (!activities.length) {
      return NextResponse.json({
        insights: ["No activity data found yet. Start logging emissions/savings!"],
      });
    }

    const factors = await fetchEmissionFactors();

    return NextResponse.json({ insights: buildCarbonInsights(activities, factors) });
  } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("❌ Error in /api/insights:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
