// app/api/tasks/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Task from "@/app/models/task";
import Project from "@/app/models/project";
import Site from "@/app/models/site";
import ManualCarbonReduction, { IManualCarbonReduction } from "@/app/models/ManualCarbonReduction";
import {
  calculateTaskActualCarbonReduction,
  getTaskCarbonReductionStatus,
  getTaskMeasurementStatus,
  isNegativeTaskCarbonReduction,
  isVerifiedTaskCarbonReduction,
  validateTaskMeasurement,
  TaskMeasurementValidationError,
} from "@/lib/taskMeasurement";
import mongoose from "mongoose";
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

const taskUpdateFields = [
  "title",
  "description",
  "priority",
  "impact",
  "status",
  "taskType",
  "materialId",
  "plannedMaterialQuantity",
  "estimatedCarbonReduction",
  "carbonReductionActivityType",
  "carbonReductionQuantity",
  "carbonReductionUnit",
  "carbonReductionFuelType",
  "measurementActivityType",
  "baselineActivityId",
  "postActionActivityId",
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    await connectDB();
    const { id } = await params;
    const task = await getAuthorizedTask(id, user.email);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const manualReduction = await ManualCarbonReduction.findOne({ taskId: task._id }).lean<IManualCarbonReduction>();
    return NextResponse.json({
      ...task.toObject(),
      ...(manualReduction
        ? {
            manualCarbonReduction: manualReduction.amount,
            manualCarbonReductionUnit: manualReduction.unit,
            manualCarbonReductionDescription: manualReduction.description,
            manualCarbonReductionProvenance: manualReduction.provenance,
            manualCarbonReductionRecordedAt: manualReduction.updatedAt,
          }
        : {}),
    });
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    rejectClientCalculatedCarbonFields(body);
    const task = await getAuthorizedTask(id, user.email);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const project = await Project.findOne({ _id: task.projectId, userId: user.email }).select("_id siteId");
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const site = await Site.findOne({ _id: project.siteId, userId: user.email }).select("_id");
    if (!site) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates = getAllowedTaskUpdates(body);
    await validateTaskMaterialFields({
      materialId: "materialId" in updates ? updates.materialId : undefined,
      plannedMaterialQuantity: "plannedMaterialQuantity" in updates ? updates.plannedMaterialQuantity : undefined,
    });
    const taskType = resolveTaskWorkflowType({
      taskType: "taskType" in updates ? updates.taskType : task.taskType,
      title: "title" in updates ? updates.title : task.title,
      description: "description" in updates ? updates.description : task.description,
    });

    if (
      taskType === "inventory" &&
      [
        updates.measurementActivityType,
        updates.baselineActivityId,
        updates.postActionActivityId,
        updates.carbonReductionActivityType,
        updates.carbonReductionQuantity,
        updates.carbonReductionUnit,
        updates.carbonReductionFuelType,
      ].some((value) => value !== undefined && value !== null && value !== "")
    ) {
      return NextResponse.json(
        { error: "Inventory tasks cannot use intervention measurement or direct carbon-reduction fields" },
        { status: 400 }
      );
    }
    validateTaskCarbonReductionDefinition({
      carbonReductionActivityType: "carbonReductionActivityType" in updates
        ? updates.carbonReductionActivityType
        : task.carbonReductionActivityType,
      carbonReductionQuantity: "carbonReductionQuantity" in updates
        ? updates.carbonReductionQuantity
        : task.carbonReductionQuantity,
      carbonReductionUnit: "carbonReductionUnit" in updates
        ? updates.carbonReductionUnit
        : task.carbonReductionUnit,
      carbonReductionFuelType: "carbonReductionFuelType" in updates
        ? updates.carbonReductionFuelType
        : task.carbonReductionFuelType,
    });
    const isCompletingTask = task.status !== "done" && updates.status === "done";
    const isReopeningVerifiedTask =
      task.status === "done" &&
      updates.status !== undefined &&
      updates.status !== "done" &&
      (task.measurementStatus === "verified" || task.carbonImpactStatus === "verified");
    const hasMeasurementUpdates =
      "measurementActivityType" in updates ||
      "baselineActivityId" in updates ||
      "postActionActivityId" in updates;
    const changesMeasurementReference = (field: "measurementActivityType" | "baselineActivityId" | "postActionActivityId") =>
      field in updates && String(updates[field] ?? "") !== String(task[field] ?? "");
    const changedMeasurementFields = (["measurementActivityType", "baselineActivityId", "postActionActivityId"] as const)
      .filter(changesMeasurementReference);

    if (changedMeasurementFields.length && task.measurementMode === "baseline-post-action") {
      return NextResponse.json(
        { error: "Baseline/post-action measurements are recorded through the measurement workflow and cannot be edited directly" },
        { status: 400 }
      );
    }

    if (
      changedMeasurementFields.length &&
      (task.measurementStatus === "verified" || task.carbonImpactStatus === "verified")
    ) {
      return NextResponse.json(
        { error: "Measurement references of a verified task cannot be changed" },
        { status: 409 }
      );
    }
    let measurementValidationAvailable = true;
    let measurementValidationReason: string | undefined;

    try {
      await validateTaskMeasurement({
        siteId: project.siteId,
        userId: user.email,
        measurementActivityType: "measurementActivityType" in updates
          ? updates.measurementActivityType
          : task.measurementActivityType,
        baselineActivityId: "baselineActivityId" in updates
          ? updates.baselineActivityId
          : task.baselineActivityId,
        postActionActivityId: "postActionActivityId" in updates
          ? updates.postActionActivityId
          : task.postActionActivityId,
        associationTaskId: String(task._id),
      });
    } catch (error) {
      if (!isCompletingTask || hasMeasurementUpdates) {
        throw error;
      }

      measurementValidationAvailable = false;
      measurementValidationReason = error instanceof Error ? error.message : "invalid measurement data";
      console.warn(`Task automatic carbon measurement unavailable: ${measurementValidationReason}`);
    }

    Object.assign(task, updates);

    if (taskType === "inventory") {
      task.taskType = "inventory";
      task.measurementMode = undefined;
      task.measurementActivityType = undefined;
      task.measurementStatus = undefined;
      task.baselineActivityId = undefined;
      task.postActionActivityId = undefined;
      task.actualCarbonReduction = undefined;
      task.carbonImpactStatus = undefined;
      task.carbonImpactReason = undefined;
    }

    if (task.measurementMode === "baseline-post-action") {
      task.measurementStatus = getTaskMeasurementStatus(task);
    }

    if (isReopeningVerifiedTask) {
      task.actualCarbonReduction = undefined;
      task.carbonImpactStatus = "not-verifiable";
      task.carbonImpactReason = "task reopened after verification; new completion requires valid measurement evidence";
      if (task.measurementMode === "baseline-post-action") {
        task.measurementStatus = getTaskMeasurementStatus(task);
      }
    }

    if (
      taskType !== "inventory" &&
      isCompletingTask &&
      measurementValidationAvailable &&
      typeof task.actualCarbonReduction !== "number" &&
      task.measurementActivityType &&
      task.baselineActivityId &&
      task.postActionActivityId
    ) {
      const calculation = await calculateTaskActualCarbonReduction({
        siteId: project.siteId,
        userId: user.email,
        measurementActivityType: task.measurementActivityType,
        baselineActivityId: task.baselineActivityId,
        postActionActivityId: task.postActionActivityId,
      });

      if (getTaskCarbonReductionStatus(calculation.value) === "verified") {
        task.actualCarbonReduction = calculation.value;
        task.carbonImpactStatus = "verified";
        if (task.measurementMode === "baseline-post-action") task.measurementStatus = "verified";
        task.carbonImpactReason = undefined;
      } else if (calculation.value !== null) {
        task.actualCarbonReduction = calculation.value;
        task.carbonImpactStatus = "not-verifiable";
        if (task.measurementMode === "baseline-post-action") task.measurementStatus = "not-verifiable";
        task.carbonImpactReason = "Measured task outcome indicates an emissions increase";
      } else {
        if (task.measurementMode === "baseline-post-action") task.measurementStatus = "not-verifiable";
        task.carbonImpactStatus = "not-verifiable";
        task.carbonImpactReason = calculation.reason;
        console.warn(`Task automatic carbon measurement unavailable: ${calculation.reason}`);
      }
    } else if (
      taskType !== "inventory" &&
      isCompletingTask &&
      typeof task.actualCarbonReduction !== "number" &&
      !task.measurementActivityType &&
      !task.baselineActivityId &&
      !task.postActionActivityId
    ) {
      const calculation = await calculateTaskActualCarbonReduction({
        siteId: project.siteId,
        userId: user.email,
        carbonReductionActivityType: task.carbonReductionActivityType,
        carbonReductionQuantity: task.carbonReductionQuantity,
        carbonReductionUnit: task.carbonReductionUnit,
        carbonReductionFuelType: task.carbonReductionFuelType,
      });

      if (getTaskCarbonReductionStatus(calculation.value) === "verified") {
        task.actualCarbonReduction = calculation.value;
        task.carbonImpactStatus = "verified";
        task.carbonImpactReason = undefined;
      } else if (calculation.value !== null) {
        task.actualCarbonReduction = calculation.value;
        task.carbonImpactStatus = "not-verifiable";
        task.carbonImpactReason = "Measured task outcome indicates an emissions increase";
      } else {
        task.carbonImpactStatus = "not-verifiable";
        task.carbonImpactReason = calculation.reason;
        console.warn(`Task automatic carbon measurement unavailable: ${calculation.reason}`);
      }
    } else if (isCompletingTask && typeof task.actualCarbonReduction !== "number") {
      if (taskType !== "inventory" && task.measurementMode === "baseline-post-action" && !measurementValidationAvailable) {
        task.measurementStatus = "not-verifiable";
        task.carbonImpactStatus = "not-verifiable";
        task.carbonImpactReason = measurementValidationReason || "stored measurement data is no longer available or authorized";
        console.warn(`Task automatic carbon measurement unavailable: ${task.carbonImpactReason}`);
      } else if (taskType !== "inventory" && task.measurementMode !== "baseline-post-action") {
        task.carbonImpactStatus = "not-verifiable";
        task.carbonImpactReason = measurementValidationAvailable
          ? "missing baseline/post-action measurement configuration"
          : measurementValidationReason || "stored measurement data is no longer available or authorized";
        console.warn(`Task automatic carbon measurement unavailable: ${task.carbonImpactReason}`);
      }
    }

    const hasDirectCarbonReductionDefinition = [
      task.carbonReductionActivityType,
      task.carbonReductionQuantity,
      task.carbonReductionUnit,
      task.carbonReductionFuelType,
    ].some((value) => value !== undefined && value !== null && value !== "");
    await task.save();

    return NextResponse.json(task);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { id } = await params;
    const task = await getAuthorizedTask(id, user.email);

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