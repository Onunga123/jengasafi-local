import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CarbonActivity from "@/app/models/CarbonActivity";
import {
  AuthorizationError,
  requireAuth,
} from "@/lib/authorization";

export async function GET() {
  try {
    const user = await requireAuth();

    await connectDB();

    // Fetch all activities for this logged-in user
    const activities = await CarbonActivity.find({
      userId: user.email,
    }).sort({ createdAt: -1 }); // newest first

    return NextResponse.json(activities);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("❌ Error fetching activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}
