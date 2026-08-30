import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CarbonActivity from "@/app/models/CarbonActivity";
import Site from "@/app/models/site";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { CarbonActivityType } from "@/types/CarbonActivity";

export async function POST(req: Request) {
  try {

    const user = await requireAuth();
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;

    const allowedTypes = Object.values(CarbonActivityType) as string[];
    if (!allowedTypes.includes(String(body.type)) || typeof body.value !== "number") {
      return NextResponse.json({ error: "Invalid activity data" }, { status: 400 });
    }

    if (!body.siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }

    const site = await Site.findOne({ _id: body.siteId, userId: user.email }).select("_id");
    if (!site) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activity = await CarbonActivity.create({
      type: body.type,
      value: body.value,
      description: body.description,
      sustainableEF: body.sustainableEF,
      standardEF: body.standardEF,
      fuelType: body.fuelType,
      siteId: body.siteId,
      userId: user.email,
      createdAt: new Date(),
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("❌ Error adding activity:", err);
    return NextResponse.json({ error: "Failed to add activity" }, { status: 500 });
  }
}
