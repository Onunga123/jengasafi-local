// app/api/tasks/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Task from "@/app/models/task";
import Project from "@/app/models/project";
import mongoose from "mongoose";
import {
  AuthorizationError,
  requireAuth,
} from "@/lib/authorization";

const taskUpdateFields = [
  "title",
  "description",
  "priority",
  "impact",
  "status",
  "estimatedCarbonReduction",
  "actualCarbonReduction",
  "dueDate",
  "assignedTo",
] as const;

function getAllowedTaskUpdates(body: Record<string, unknown>) {
  return Object.fromEntries(
    taskUpdateFields
      .filter((field) => field in body)
      .map((field) => [field, body[field]])
  );
}

async function getAuthorizedTask(taskId: string, userEmail: string) {
  if (!mongoose.isValidObjectId(taskId)) {
    return null;
  }

  const task = await Task.findById(taskId);
  if (!task) {
    return null;
  }

  const project = await Project.findOne({
    _id: task.projectId,
    userId: userEmail,
  }).select("_id");

  if (!project) {
    throw new AuthorizationError("Forbidden", 403);
  }

  return task;
}

// GET - Fetch single task
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();
    const task = await getAuthorizedTask(params.id, user.email);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PUT - Update a task
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    const body = (await req.json()) as Record<string, unknown>;
    const task = await getAuthorizedTask(params.id, user.email);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    Object.assign(task, getAllowedTaskUpdates(body));
    await task.save();

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a task
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    const task = await getAuthorizedTask(params.id, user.email);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await task.deleteOne();

    return NextResponse.json({ message: "Task deleted successfully" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}