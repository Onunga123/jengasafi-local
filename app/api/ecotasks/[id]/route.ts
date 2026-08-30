import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import EcoTask from "@/app/models/ecotask";
import Project from "@/app/models/project";
import mongoose from "mongoose";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

const allowedUpdateFields = [
  "title", "description", "site", "materials", "deadline", "priority",
  "ecoImpact", "status", "assignedTo", "estimatedCarbonSavings", "actualCarbonSavings",
] as const;

function allowedUpdates(body: Record<string, unknown>) {
  return Object.fromEntries(allowedUpdateFields.filter((field) => field in body).map((field) => [field, body[field]]));
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    await connectDB();
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const task = await EcoTask.findById(params.id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const owned = await Project.findOne({ _id: task.projectId, userId: user.email }).select("_id");
    if (!owned || (task.userId && task.userId !== user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = (await req.json()) as Record<string, unknown>;
    Object.assign(task, allowedUpdates(body));
    await task.save();
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error updating eco task:", error);
    return NextResponse.json({ error: "Failed to update eco task" }, { status: 500 });
  }
}
