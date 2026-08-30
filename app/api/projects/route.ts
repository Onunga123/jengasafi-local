import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Project from "@/app/models/project";
import Site from "@/app/models/site";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

// GET all projects for user
export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();
    const projects = await Project.find({ userId: user.email });
    return NextResponse.json(projects);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST create new project
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();
    const data = (await req.json()) as Record<string, unknown>;

    if (!data.name || !data.siteId) {
      return NextResponse.json({ error: "Name and siteId are required" }, { status: 400 });
    }

    const site = await Site.findOne({ _id: data.siteId, userId: user.email }).select("_id");
    if (!site) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await Project.create({
      name: data.name,
      description: data.description,
      location: data.location,
      startDate: data.startDate ? new Date(String(data.startDate)) : undefined,
      endDate: data.endDate ? new Date(String(data.endDate)) : undefined,
      siteId: data.siteId,
      userId: user.email,
    });

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
