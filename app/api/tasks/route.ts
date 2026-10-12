// app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Task from "@/app/models/task";
import Project from "@/app/models/project";
import Site from "@/app/models/site";
import ManualCarbonReduction from "@/app/models/ManualCarbonReduction";
import { CarbonActivityType } from "@/types/CarbonActivity";
import { validateTaskMeasurement, TaskMeasurementValidationError } from "@/lib/taskMeasurement";
import {
  rejectClientCalculatedCarbonFields,
  TaskCarbonReductionValidationError,
  validateTaskCarbonReductionDefinition,
} from "@/lib/taskCarbonReduction";
import {
  AuthorizationError,
  requireAuth,
} from "@/lib/authorization";
import { resolveTaskWorkflowType } from "@/lib/taskWorkflow";
import { TaskMaterialValidationError, validateTaskMaterialFields } from "@/lib/taskMaterial";

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

    const tasks = await Task.find(query).sort({ createdAt: -1 }).lean();
    const taskIds = tasks.map((task) => task._id);
    const manualReductions = await ManualCarbonReduction.find({ taskId: { $in: taskIds } }).lean();
    const reductionsByTaskId = new Map(manualReductions.map((reduction) => [String(reduction.taskId), reduction]));
    const tasksWithManualReductions = tasks.map((task) => {
      const reduction = reductionsByTaskId.get(String(task._id));
      return reduction
        ? {
            ...task,
            _id: String(task._id),
            manualCarbonReduction: reduction.amount,
            manualCarbonReductionUnit: reduction.unit,
            manualCarbonReductionDescription: reduction.description,
            manualCarbonReductionProvenance: reduction.provenance,
            manualCarbonReductionRecordedAt: reduction.updatedAt,
          }
        : { ...task, _id: String(task._id) };
    });

    return NextResponse.json(tasksWithManualReductions);
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

    rejectClientCalculatedCarbonFields(body);
    await validateTaskMaterialFields({
      materialId: body.materialId,
      plannedMaterialQuantity: body.plannedMaterialQuantity,
    });
    
    // Validate required fields
    if (!body.title || !body.projectId) {
      return NextResponse.json(
        { error: "Title and projectId are required" },
        { status: 400 }
      );
    }

    const taskType = resolveTaskWorkflowType(body);

    if (taskType === "inventory" && body.measurementMode === "baseline-post-action") {
      return NextResponse.json(
        { error: "Inventory tasks use ordinary CarbonActivity records, not baseline/post-action intervention measurements" },
        { status: 400 }
      );
    }

    if (
      taskType === "inventory" &&
      [body.carbonReductionActivityType, body.carbonReductionQuantity, body.carbonReductionUnit, body.carbonReductionFuelType]
        .some((value) => value !== undefined && value !== null && value !== "")
    ) {
      return NextResponse.json(
        { error: "Inventory tasks cannot include a direct carbon-reduction definition" },
        { status: 400 }
      );
    }

    if (
      body.measurementMode !== undefined &&
      body.measurementMode !== "none" &&
      body.measurementMode !== "baseline-post-action"
    ) {
      return NextResponse.json({ error: "Invalid measurement mode" }, { status: 400 });
    }

    if (
      body.measurementMode === "baseline-post-action" &&
      !Object.values(CarbonActivityType).includes(body.measurementActivityType as CarbonActivityType)
    ) {
      return NextResponse.json(
        { error: "A supported measurement activity type is required for baseline-post-action tasks" },
        { status: 400 }
      );
    }

    if (body.measurementMode === "baseline-post-action") {
      const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "";
      if (hasValue(body.baselineActivityId) || hasValue(body.postActionActivityId)) {
        return NextResponse.json(
          { error: "Baseline and post-action measurements are recorded after task creation" },
          { status: 400 }
        );
      }
      if (
        [body.carbonReductionActivityType, body.carbonReductionQuantity, body.carbonReductionUnit, body.carbonReductionFuelType]
          .some(hasValue)
      ) {
        return NextResponse.json(
          { error: "Measurement-enabled tasks cannot include a direct carbon reduction definition" },
          { status: 400 }
        );
      }
    }

    const project = await Project.findOne({
      _id: body.projectId,
      userId: user.email,
  }).select("_id siteId");

    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const site = await Site.findOne({ _id: project.siteId, userId: user.email }).select("_id");
    if (!site) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await validateTaskMeasurement({
      siteId: project.siteId,
      userId: user.email,
      measurementActivityType: body.measurementActivityType,
      baselineActivityId: body.baselineActivityId,
      postActionActivityId: body.postActionActivityId,
      associationTaskId: null,
    });

    validateTaskCarbonReductionDefinition(body);

    const task = await Task.create({
      title: body.title,
      description: body.description || "",
      priority: body.priority || "medium",
      impact: body.impact || "medium",
      status: body.status || "todo",
      taskType,
      projectId: body.projectId,
      materialId: body.materialId,
      plannedMaterialQuantity: body.plannedMaterialQuantity,
      estimatedCarbonReduction: body.estimatedCarbonReduction,
      carbonReductionActivityType: body.carbonReductionActivityType,
      carbonReductionQuantity: body.carbonReductionQuantity,
      carbonReductionUnit: body.carbonReductionUnit,
      carbonReductionFuelType: body.carbonReductionFuelType,
      measurementActivityType: taskType === "inventory" ? undefined : body.measurementActivityType,
      measurementMode: taskType === "inventory" ? undefined : body.measurementMode,
      measurementStatus: taskType !== "inventory" && body.measurementMode === "baseline-post-action"
        ? "baseline-pending"
        : undefined,
      baselineActivityId: body.baselineActivityId,
      postActionActivityId: body.postActionActivityId,
      dueDate: body.dueDate,
      assignedTo: body.assignedTo,
    });

    return NextResponse.json(
      { ...task.toObject(), _id: String(task._id) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TaskMeasurementValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TaskCarbonReductionValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TaskMaterialValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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