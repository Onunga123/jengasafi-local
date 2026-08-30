// app/api/sites/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Site from "@/app/models/site";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

export async function GET() {
  await connectDB();

  try {
    const user = await requireAuth();

    const sites = await Site.find({ userId: user.email }).sort({
      createdAt: -1,
    });

    return NextResponse.json(sites);
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error fetching sites:", err);
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await connectDB();

  try {
    const user = await requireAuth();
    const body = (await req.json()) as Record<string, unknown>;

    // Validate required fields
    if (!body.name || !body.location) {
      return NextResponse.json(
        { error: "Site name and location are required" },
        { status: 400 }
      );
    }

    const siteData = {
      userId: user.email,
      profileId: body.profileId || undefined,
      name: body.name,
      location: body.location,
      projectType: body.projectType || "residential",
      size: body.size || "",
      startDate: new Date(String(body.startDate)),
      endDate: body.endDate ? new Date(String(body.endDate)) : undefined,
      budget: body.budget || "",
      status: "planned",
    };

    const site = await Site.create(siteData);

    return NextResponse.json({
      _id: site._id.toString(),
      name: site.name,
      location: site.location,
      projectType: site.projectType,
      size: site.size,
      startDate: site.startDate,
      endDate: site.endDate,
      budget: site.budget,
      status: site.status,
      userId: site.userId,
      profileId: site.profileId,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error saving site:", err);
    return NextResponse.json({ error: "Failed to save site" }, { status: 500 });
  }
}
