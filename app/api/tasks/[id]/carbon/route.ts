import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Task from "@/app/models/task";
import Project from "@/app/models/project";
import Site from "@/app/models/site";
import CarbonActivity from "@/app/models/CarbonActivity";
import ManualCarbonReduction, { MANUAL_CARBON_REDUCTION_UNIT } from "@/app/models/ManualCarbonReduction";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { canLinkVerifiedTaskCarbonSavings } from "@/lib/taskCarbonSavings";

// POST /api/tasks/[id]/carbon
// The task's post-action measurement is already the CarbonActivity record used
// by Carbon Intelligence. This endpoint provides an explicit, idempotent Add
// Carbon action without creating a second record or accepting a client amount.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    await connectDB();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const project = await Project.findOne({
      _id: task.projectId,
      userId: user.email,
    }).select("_id siteId");
    if (!project) {
      throw new AuthorizationError("Forbidden", 403);
    }

    const site = await Site.findOne({
      _id: project.siteId,
      userId: user.email,
    }).select("_id");
    if (!site) {
      throw new AuthorizationError("Forbidden", 403);
    }

    const hasManualAmount = Object.prototype.hasOwnProperty.call(body, "amount");
    if (hasManualAmount) {
      const amount = body.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        return NextResponse.json(
          { error: "Carbon reduced must be a finite, non-negative number" },
          { status: 400 }
        );
      }

      if (body.unit !== MANUAL_CARBON_REDUCTION_UNIT) {
        return NextResponse.json(
          { error: `Carbon reduction unit must be ${MANUAL_CARBON_REDUCTION_UNIT}` },
          { status: 400 }
        );
      }

      if (body.description !== undefined && typeof body.description !== "string") {
        return NextResponse.json({ error: "Description must be text" }, { status: 400 });
      }

      const manualReduction = await ManualCarbonReduction.findOneAndUpdate(
        { taskId: task._id },
        {
          $set: {
            projectId: String(task.projectId),
            siteId: String(project.siteId),
            userId: user.email,
            amount,
            unit: MANUAL_CARBON_REDUCTION_UNIT,
            description: typeof body.description === "string" ? body.description.trim() : "",
            verificationMethod: "user-confirmed",
          },
          $setOnInsert: { taskId: task._id },
        },
        { new: true, upsert: true, runValidators: true }
      );

      task.status = "done";
      await task.save();

      return NextResponse.json({
        task,
        manualReduction,
        userReportedCarbonReduction: manualReduction.amount,
      });
    }

    if (!canLinkVerifiedTaskCarbonSavings(task)) {
      return NextResponse.json(
        { error: "Only a completed task with a verified carbon reduction can be added to Carbon Data" },
        { status: 409 }
      );
    }

    if (!task.postActionActivityId) {
      return NextResponse.json(
        { error: "The verified task has no linked post-action CarbonActivity" },
        { status: 409 }
      );
    }

    const activity = await CarbonActivity.findOne({
      _id: task.postActionActivityId,
      taskId: task._id,
      measurementPhase: "post-action",
      siteId: project.siteId,
      userId: user.email,
    });
    if (!activity) {
      return NextResponse.json(
        { error: "The task's post-action CarbonActivity could not be found or is not authorized" },
        { status: 409 }
      );
    }

    let carbonSavingsLinkedAt = task.carbonSavingsLinkedAt;
    if (!carbonSavingsLinkedAt) {
      const linkedTask = await Task.findOneAndUpdate(
        {
          _id: task._id,
          status: "done",
          carbonImpactStatus: "verified",
          actualCarbonReduction: { $gte: 0 },
          carbonSavingsLinkedAt: { $exists: false },
        },
        { $set: { carbonSavingsLinkedAt: new Date() } },
        { new: true }
      ).select("carbonSavingsLinkedAt");

      if (!linkedTask) {
        const currentTask = await Task.findById(task._id).select("carbonSavingsLinkedAt");
        if (!currentTask?.carbonSavingsLinkedAt) {
          return NextResponse.json({ error: "Task carbon savings changed; please retry" }, { status: 409 });
        }
        carbonSavingsLinkedAt = currentTask.carbonSavingsLinkedAt;
      } else {
        carbonSavingsLinkedAt = linkedTask.carbonSavingsLinkedAt;
      }
    }

    return NextResponse.json({
      taskId: String(task._id),
      carbonActivity: activity,
      actualCarbonReduction: task.actualCarbonReduction,
      alreadyLinked: Boolean(carbonSavingsLinkedAt),
      carbonSavingsLinkedAt,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error linking task carbon savings:", error);
    return NextResponse.json({ error: "Failed to add task carbon savings" }, { status: 500 });
  }
}