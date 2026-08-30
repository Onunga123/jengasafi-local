// app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Task from "@/app/models/task";
import Project from "@/app/models/project";
import {
  AuthorizationError,
  requireAuth,
} from "@/lib/authorization";

// GET - Fetch all tasks with optional filtering
export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    const ownedProjects = await Project.find({ userId: user.email }).select("_id").lean();
    const ownedProjectIds = ownedProjects.map((project) => String(project._id));
    const query: Record<string, unknown> = { projectId: { $in: ownedProjectIds } };
    
    if (projectId) query.projectId = projectId;
    if (projectId && !ownedProjectIds.includes(projectId)) {
      query.projectId = { $in: [] };
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query).sort({ createdAt: -1 });

    return NextResponse.json(tasks);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST - Create a new task
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    await connectDB();

    const body = (await req.json()) as Record<string, unknown>;
    
    // Validate required fields
    if (!body.title || !body.projectId) {
      return NextResponse.json(
        { error: "Title and projectId are required" },
        { status: 400 }
      );
    }

    const project = await Project.findOne({
      _id: body.projectId,
      userId: user.email,
    }).select("_id");

    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await Task.create({
      title: body.title,
      description: body.description || "",
      priority: body.priority || "medium",
      impact: body.impact || "medium",
      status: body.status || "todo",
      projectId: body.projectId,
      estimatedCarbonReduction: body.estimatedCarbonReduction,
      dueDate: body.dueDate,
      assignedTo: body.assignedTo,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}