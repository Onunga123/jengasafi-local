import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CarbonActivity from "@/app/models/CarbonActivity";
import Site from "@/app/models/site";
import Project from "@/app/models/project";
import Task from "@/app/models/task";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { CarbonActivityType } from "@/types/CarbonActivity";
import mongoose from "mongoose";
import {
  CarbonActivityContractError,
  normalizeCarbonActivityInput,
} from "@/lib/carbonActivityContract";

export async function POST(req: Request) {
  try {

    const user = await requireAuth();
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;

    const normalizedActivity = normalizeCarbonActivityInput(body);

    if (!body.siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }

    const site = await Site.findOne({ _id: body.siteId, userId: user.email }).select("_id");
    if (!site) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const hasTaskId = body.taskId !== undefined && body.taskId !== null && body.taskId !== "";
    const hasMeasurementPhase =
      body.measurementPhase !== undefined && body.measurementPhase !== null && body.measurementPhase !== "";
    let task = null;

    if (hasTaskId || hasMeasurementPhase) {
      if (!hasTaskId || !hasMeasurementPhase) {
        return NextResponse.json(
          { error: "taskId and measurementPhase must be supplied together" },
          { status: 400 }
        );
      }

      if (!mongoose.isValidObjectId(body.taskId)) {
        return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
      }

      if (body.measurementPhase !== "baseline" && body.measurementPhase !== "post-action") {
        return NextResponse.json({ error: "Invalid measurement phase" }, { status: 400 });
      }

      task = await Task.findById(body.taskId);
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const project = await Project.findOne({
        _id: task.projectId,
        userId: user.email,
        siteId: body.siteId,
      }).select("_id siteId");
      if (!project) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (task.measurementMode !== "baseline-post-action" || !task.measurementActivityType) {
        return NextResponse.json(
          { error: "This task is not configured for baseline/post-action measurement" },
          { status: 400 }
        );
      }

      if (task.measurementActivityType !== body.type) {
        return NextResponse.json(
          { error: "Activity type does not match the task measurement configuration" },
          { status: 400 }
        );
      }

      if (task.measurementStatus === "verified" || task.carbonImpactStatus === "verified") {
        return NextResponse.json({ error: "Verified tasks cannot receive new measurements" }, { status: 409 });
      }

      if (body.measurementPhase === "post-action" && !task.baselineActivityId) {
        return NextResponse.json(
          { error: "Record the baseline measurement before the post-action measurement" },
          { status: 409 }
        );
      }

      const duplicate = await CarbonActivity.findOne({
        taskId: task._id,
        measurementPhase: body.measurementPhase,
      }).select("_id");
      if (duplicate) {
        return NextResponse.json({ error: `A ${body.measurementPhase} measurement already exists for this task` }, { status: 409 });
      }
    }

    const activity = await CarbonActivity.create({
      type: normalizedActivity.type,
      value: normalizedActivity.value,
      description: body.description,
      sustainableEF: normalizedActivity.sustainableEF,
      standardEF: normalizedActivity.standardEF,
      fuelType: normalizedActivity.fuelType,
      siteId: body.siteId,
      userId: user.email,
      taskId: hasTaskId ? body.taskId : undefined,
      measurementPhase: hasMeasurementPhase ? body.measurementPhase : undefined,
      createdAt: new Date(),
    });

    if (task) {
      const phase = body.measurementPhase;
      const updateFilter = {
        _id: task._id,
        measurementMode: "baseline-post-action",
        measurementStatus: { $ne: "verified" },
        carbonImpactStatus: { $ne: "verified" },
        actualCarbonReduction: { $exists: false },
        ...(phase === "baseline"
          ? { baselineActivityId: { $exists: false } }
          : { baselineActivityId: { $exists: true, $ne: null }, postActionActivityId: { $exists: false } }),
      };
      const update = phase === "baseline"
        ? {
            $set: {
              baselineActivityId: activity._id,
              measurementStatus: "post-action-pending",
            },
          }
        : {
            $set: {
              postActionActivityId: activity._id,
              measurementStatus: "ready-to-calculate",
            },
          };
      const result = await Task.updateOne(updateFilter, update);
      if (result.modifiedCount !== 1) {
        await activity.deleteOne();
        return NextResponse.json({ error: "Task measurement state changed; please retry" }, { status: 409 });
      }

      task.set(phase === "baseline"
        ? { baselineActivityId: activity._id, measurementStatus: "post-action-pending" }
        : { postActionActivityId: activity._id, measurementStatus: "ready-to-calculate" });

    }

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    if (err instanceof CarbonActivityContractError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("❌ Error adding activity:", err);
    return NextResponse.json({ error: "Failed to add activity" }, { status: 500 });
  }
}
