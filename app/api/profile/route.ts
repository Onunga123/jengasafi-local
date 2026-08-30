// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SustainabilityProfile from "@/app/models/profile";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();

    const profile = await SustainabilityProfile.findOne({
      email: user.email
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error fetching profile:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();
    const body = await req.json();

    // Extract only the fields we want to save
    const profileData = {
      userId: user.email,
      name: body.name || user.name,
      email: user.email,
      company: body.company || "",
      role: body.role || "",
      sustainabilityGoals: body.sustainabilityGoals || "",
      reductionTarget: body.reductionTarget || 25,
      focusAreas: body.focusAreas || [],
      setupCompleted: body.setupCompleted || false
    };

    // Update or create profile
    const profile = await SustainabilityProfile.findOneAndUpdate(
      { email: user.email },
      profileData,
      { new: true, upsert: true, runValidators: true }
    );

    return NextResponse.json(profile);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error saving profile:", err);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;

    const profile = await SustainabilityProfile.findOneAndUpdate(
      { email: user.email },
      {
        $set: {
          userId: user.email,
          name: body.name || user.name,
          email: user.email,
          company: body.company || "",
          role: body.role || "",
          sustainabilityGoals: body.sustainabilityGoals || "",
          reductionTarget: body.reductionTarget ?? 25,
          focusAreas: Array.isArray(body.focusAreas) ? body.focusAreas : [],
          ...(typeof body.setupCompleted === "boolean"
            ? { setupCompleted: body.setupCompleted }
            : {}),
        },
      },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error updating profile:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}