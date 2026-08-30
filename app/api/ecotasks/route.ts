import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import EcoTask from "@/app/models/ecotask";
import Project from "@/app/models/project";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();
    const ownedProjects = await Project.find({ userId: user.email }).select("_id").lean();
    const ownedProjectIds = ownedProjects.map((project) => String(project._id));
    const tasks = await EcoTask.find({
      $or: [
        { userId: user.email },
        { projectId: { $in: ownedProjectIds } },
      ],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error fetching eco tasks:", error);
    return NextResponse.json({ error: "Failed to fetch eco tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();
    const data = (await req.json()) as Record<string, unknown>;
    if (!data.title || !data.projectId) return NextResponse.json({ error: "Title and projectId are required" }, { status: 400 });
    const project = await Project.findOne({ _id: data.projectId, userId: user.email }).select("_id");
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const task = await EcoTask.create({
      title: data.title,
      description: data.description,
      site: data.site,
      materials: data.materials,
      deadline: data.deadline,
      priority: data.priority,
      ecoImpact: data.ecoImpact,
      status: data.status,
      assignedTo: data.assignedTo,
      estimatedCarbonSavings: data.estimatedCarbonSavings,
      actualCarbonSavings: data.actualCarbonSavings,
      projectId: data.projectId,
      userId: user.email,
    });
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error creating eco task:", error);
    return NextResponse.json({ error: "Failed to create eco task" }, { status: 500 });
  }
}
