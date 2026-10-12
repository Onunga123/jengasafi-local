"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { requestJson } from "@/lib/client-errors";
import { CarbonActivityType } from "@/types/CarbonActivity";
import { getCarbonActivityLabel, getCarbonReductionUnit } from "@/lib/taskCarbonReduction";
import { ActivityForm } from "@/components/activityForm";
import { isInventoryTaskText } from "@/lib/taskWorkflow";

interface Project {
  _id: string;
  name: string;
  siteId?: string;
}

interface CarbonActivity {
  _id: string;
  siteId?: string;
  taskId?: string;
  measurementPhase?: MeasurementPhase;
  type: CarbonActivityType;
  value: number;
  description?: string;
  fuelType?: string;
  createdAt?: string;
}

const inventoryFocusAreas = [
  { key: "energy", label: "Energy", types: [CarbonActivityType.ENERGY, CarbonActivityType.RENEWABLE] },
  { key: "materials", label: "Materials", types: [CarbonActivityType.MATERIAL] },
  { key: "waste", label: "Waste", types: [CarbonActivityType.WASTE, CarbonActivityType.RECYCLING] },
  { key: "transport", label: "Transport", types: [CarbonActivityType.TRANSPORT] },
  { key: "machinery", label: "Machinery", types: [CarbonActivityType.MACHINERY] },
] as const;

interface Task {
  _id?: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "done";
  projectId: string;
  taskType?: "standard" | "inventory";
  estimatedCarbonReduction?: number;
  actualCarbonReduction?: number;
  carbonReductionActivityType?: CarbonActivityType;
  carbonReductionQuantity?: number;
  carbonReductionUnit?: string;
  carbonReductionFuelType?: "grid" | "diesel" | "petrol" | "hybrid" | "electric";
  carbonImpactStatus?: "verified" | "not-verifiable";
  carbonImpactReason?: string;
  measurementActivityType?: CarbonActivityType;
  measurementMode?: "none" | "baseline-post-action";
  measurementStatus?: "baseline-pending" | "post-action-pending" | "ready-to-calculate" | "verified" | "not-verifiable";
  baselineActivityId?: string;
  postActionActivityId?: string;
  carbonSavingsLinkedAt?: string;
  manualCarbonReduction?: number;
  manualCarbonReductionUnit?: string;
  manualCarbonReductionDescription?: string;
  dueDate?: string;
  assignedTo?: string;
}

type MeasurementPhase = "baseline" | "post-action";

function getMeasurementStatusText(task: Task) {
  switch (task.measurementStatus) {
    case "baseline-pending":
      return "Baseline measurement pending. Record the current measurement before performing the action.";
    case "post-action-pending":
      return "Baseline recorded. Perform the action, then record the post-action measurement.";
    case "ready-to-calculate":
      return `Baseline and post-action measurements recorded. Actual carbon reduction is not yet verified${
        task.carbonImpactReason ? ` (${task.carbonImpactReason})` : ""
      }; the server retries the calculation when the task is marked Done.`;
    case "verified":
      return typeof task.actualCarbonReduction === "number"
        ? `Verified from recorded measurements: ${task.actualCarbonReduction.toFixed(2)} kg CO₂ actual reduction.`
        : "Verified from recorded measurements.";
    case "not-verifiable":
      return `Carbon impact not verifiable${task.carbonImpactReason ? `: ${task.carbonImpactReason}` : "."}`;
    default:
      return "Measurement status unavailable.";
  }
}

function isInventoryTask(task: Task) {
  return task.taskType === "inventory" || (!task.taskType && isInventoryTaskText(task.title, task.description));
}

function getInventoryCoverage(activities: CarbonActivity[]) {
  return inventoryFocusAreas.map((area) => ({
    ...area,
    recorded: activities.some((activity) => (area.types as readonly CarbonActivityType[]).includes(activity.type)),
  }));
}

interface EcoTaskManagerProps {
  tasks: Task[];
  projects: Project[];
  onUpdateTask: (task: Task) => void;
  onTaskCompleted?: (taskId: string) => void;
  recentlyCompletedTaskId?: string | null;
  onOpenCarbonIntelligence?: () => void;
  onDeleteTask: (taskId: string) => void;
}

export default function EcoTaskManager({
  tasks,
  projects,
  onUpdateTask,
  onTaskCompleted,
  recentlyCompletedTaskId,
  onOpenCarbonIntelligence,
  onDeleteTask,
}: EcoTaskManagerProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activities, setActivities] = useState<CarbonActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [measurementForm, setMeasurementForm] = useState<{ taskId: string; phase: MeasurementPhase } | null>(null);
  const [inventoryFormTaskId, setInventoryFormTaskId] = useState<string | null>(null);
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [measurementNotice, setMeasurementNotice] = useState<string | null>(null);
  const [addingCarbonTaskId, setAddingCarbonTaskId] = useState<string | null>(null);
  const [manualReductionTask, setManualReductionTask] = useState<Task | null>(null);
  const [manualReductionAmount, setManualReductionAmount] = useState("");
  const [manualReductionDescription, setManualReductionDescription] = useState("");
  const [manualReductionError, setManualReductionError] = useState<string | null>(null);
  const [manualReductionNotice, setManualReductionNotice] = useState<string | null>(null);
  const [isSavingManualReduction, setIsSavingManualReduction] = useState(false);
  useEffect(() => {
    const siteIds = Array.from(new Set(projects.map((project) => project.siteId).filter(Boolean))) as string[];
    if (siteIds.length === 0) {
      setActivities([]);
      return;
    }

    const loadActivities = async () => {
      setIsLoadingActivities(true);
      try {
        const responses = await Promise.all(
          siteIds.map((siteId) => fetch(`/api/carbon-trends?siteId=${encodeURIComponent(siteId)}`))
        );
        if (responses.some((response) => !response.ok)) throw new Error("Unable to load CarbonActivity records.");
        const payloads = await Promise.all(
          responses.map((response) => response.json() as Promise<{ activities?: CarbonActivity[] }>)
        );
        setActivities(payloads.flatMap((data) => Array.isArray(data.activities) ? data.activities : []));
      } catch {
        setActivities([]);
      } finally {
        setIsLoadingActivities(false);
      }
    };

    void loadActivities();
  }, [projects]);

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    setError(null);
    setIsSaving(true);
    try {
      const updatedTask = await requestJson<Task>(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      onUpdateTask(updatedTask);
      setEditingTask(null);
      return updatedTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setError(null);
    try {
      await requestJson<{ message: string }>(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      onDeleteTask(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete task.");
    }
  };

  const openMeasurementForm = (taskId: string, phase: MeasurementPhase) => {
    setMeasurementError(null);
    setMeasurementNotice(null);
    setMeasurementForm({ taskId, phase });
  };

  const refreshTask = async (taskId: string) => {
    try {
      const refreshedTask = await requestJson<Task>(`/api/tasks/${taskId}`);
      onUpdateTask(refreshedTask);
    } catch (err) {
      setMeasurementError(err instanceof Error ? err.message : "Measurement recorded, but the task could not be refreshed.");
    }
  };

  const measurementTask = measurementForm
    ? tasks.find((task) => task._id === measurementForm.taskId)
    : undefined;
  const measurementSiteId = measurementTask
    ? projects.find((project) => project._id === measurementTask.projectId)?.siteId
    : undefined;
  const inventoryFormTask = inventoryFormTaskId
    ? tasks.find((task) => task._id === inventoryFormTaskId)
    : undefined;
  const inventoryFormSiteId = inventoryFormTask
    ? projects.find((project) => project._id === inventoryFormTask.projectId)?.siteId
    : undefined;

  const getTaskInventoryCoverage = (task: Task) => {
    const siteId = projects.find((project) => project._id === task.projectId)?.siteId;
    return getInventoryCoverage(activities.filter((activity) => activity.siteId === siteId));
  };

  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    const currentTask = tasks.find((task) => task._id === taskId);
    if (newStatus === "done" && currentTask?.status !== "done") {
      setManualReductionError(null);
      setManualReductionNotice(null);
      setManualReductionTask(currentTask ?? null);
      setManualReductionAmount(typeof currentTask?.manualCarbonReduction === "number" ? String(currentTask.manualCarbonReduction) : "");
      setManualReductionDescription(currentTask?.manualCarbonReductionDescription ?? "");
      return;
    }
    const updatedTask = await handleUpdateTask(taskId, { status: newStatus });
    if (newStatus === "done" && currentTask?.status !== "done" && updatedTask?._id) {
      onTaskCompleted?.(updatedTask._id);
    }
  };

  const handleSaveManualReduction = async () => {
    if (!manualReductionTask?._id || isSavingManualReduction) return;
    setManualReductionError(null);
    setManualReductionNotice(null);
    const amount = Number(manualReductionAmount);
    if (manualReductionAmount.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setManualReductionError("Enter a finite, non-negative carbon reduction amount.");
      return;
    }
    setIsSavingManualReduction(true);
    try {
      const response = await requestJson<{ task: Task; manualReduction: { amount: number; unit: string; description?: string } }>(
        `/api/tasks/${manualReductionTask._id}/carbon`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            unit: "kg CO₂e",
            description: manualReductionDescription,
          }),
        }
      );
      if (
        response.task._id !== manualReductionTask._id ||
        response.task.status !== "done" ||
        response.manualReduction.amount !== amount ||
        response.manualReduction.unit !== "kg CO₂e"
      ) {
        throw new Error("The reduction was saved, but the selected task was not completed. Please retry.");
      }
      onUpdateTask({
        ...response.task,
        manualCarbonReduction: response.manualReduction.amount,
        manualCarbonReductionUnit: response.manualReduction.unit,
        manualCarbonReductionDescription: response.manualReduction.description,
      });
      setManualReductionTask(null);
      setManualReductionError(null);
      setManualReductionNotice("Task saved and completed successfully. Carbon savings updated.");
      onTaskCompleted?.(response.task._id!);
    } catch (err) {
      setManualReductionError(err instanceof Error ? err.message : "Unable to save the carbon reduction.");
    } finally {
      setIsSavingManualReduction(false);
    }
  };

  const handleAddCarbon = async (task: Task) => {
    if (!task._id || addingCarbonTaskId) return;
    setError(null);
    setAddingCarbonTaskId(task._id);
    try {
      const response = await requestJson<{
        carbonActivity: CarbonActivity;
        actualCarbonReduction: number;
      }>(`/api/tasks/${task._id}/carbon`, { method: "POST" });
      setActivities((current) => [
        ...current.filter((activity) => activity._id !== response.carbonActivity._id),
        response.carbonActivity,
      ]);
      onUpdateTask({ ...task, carbonSavingsLinkedAt: new Date().toISOString() });
      setMeasurementNotice("Verified carbon savings are linked to Carbon Data. The project total already includes this task once.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add carbon savings.");
    } finally {
      setAddingCarbonTaskId(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-emerald-700">EcoTasks</h3>
          <p className="text-sm text-gray-600">Sustainability-focused actions with measurable environmental impact</p>
        </div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {measurementNotice && (
        <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{measurementNotice}</p>
      )}
      {measurementError && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{measurementError}</p>
      )}
      {manualReductionNotice && (
        <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{manualReductionNotice}</p>
      )}

      {/* Task measurement recording */}
      {measurementForm && measurementTask?.measurementActivityType && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              Recording for EcoTask: <span className="font-semibold text-emerald-800">{measurementTask.title}</span>
            </p>
            <button
              type="button"
              onClick={() => setMeasurementForm(null)}
              className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
          {measurementSiteId ? (
            <ActivityForm
              key={`${measurementForm.taskId}-${measurementForm.phase}`}
              siteId={measurementSiteId}
              taskId={measurementForm.taskId}
              measurementPhase={measurementForm.phase}
              measurementActivityType={measurementTask.measurementActivityType}
              onActivityAdded={() => {
                const { taskId, phase } = measurementForm;
                setMeasurementForm(null);
                setMeasurementError(null);
                setMeasurementNotice(`${phase === "baseline" ? "Baseline" : "Post-action"} measurement recorded.`);
                void refreshTask(taskId);
              }}
              onActivityError={(message) => {
                setMeasurementError(message || "Failed to record the measurement. Please try again.");
              }}
            />
          ) : (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              The project site for this task could not be determined, so a measurement cannot be recorded.
            </p>
          )}
        </div>
      )}

      {inventoryFormTask && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">Record carbon activity for {inventoryFormTask.title}</p>
              <p className="mt-1 text-xs text-blue-800">Add one actual activity record at a time. These records remain ordinary site activity data and feed Carbon Intelligence.</p>
            </div>
            <button
              type="button"
              onClick={() => setInventoryFormTaskId(null)}
              className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Close
            </button>
          </div>
          {inventoryFormSiteId ? (
            <ActivityForm
              key={`inventory-${inventoryFormTask._id}`}
              siteId={inventoryFormSiteId}
              isInventoryMeasurement
              onActivityAdded={() => {
                setInventoryFormTaskId(null);
                setMeasurementError(null);
                setMeasurementNotice("Carbon activity recorded. Inventory coverage refreshed.");
                const siteId = inventoryFormSiteId;
                void fetch(`/api/carbon-trends?siteId=${encodeURIComponent(siteId)}`)
                  .then((response) => response.json() as Promise<{ activities?: CarbonActivity[] }>)
                  .then((data) => {
                    if (Array.isArray(data.activities)) {
                      setActivities((current) => [
                        ...current.filter((activity) => activity.siteId !== siteId),
                        ...data.activities!,
                      ]);
                    }
                  })
                  .catch(() => setMeasurementError("Activity recorded, but inventory coverage could not be refreshed."));
              }}
              onActivityError={(message) => setMeasurementError(message || "Failed to record the carbon activity.")}
            />
          ) : (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">The project site for this inventory task could not be determined.</p>
          )}
        </div>
      )}

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map((task) => (
          <div key={task._id} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            role="button"
            tabIndex={0}
            aria-label={`Open task details for ${task.title}`}
            onClick={() => setEditingTask(task)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEditingTask(task);
              }
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-emerald-800 text-lg flex-1">
                {task.title}
              </h4>
              <button
                type="button"
                aria-label={`Delete task ${task.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete task "${task.title}"?`)) {
                    void handleDeleteTask(task._id!);
                  }
                }}
                className="ml-2 rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
              >
                Delete task
              </button>
            </div>
            
            <p className="text-sm text-gray-700 mb-3 line-clamp-3">
              {task.description}
            </p>
            
            {task.estimatedCarbonReduction && (
              <div className="mb-3 p-2 bg-blue-50 rounded-md">
                <p className="text-xs text-blue-700 font-medium">
                  Estimated Reduction: {task.estimatedCarbonReduction} kg CO₂
                </p>
              </div>
            )}

            {task.measurementMode === "baseline-post-action" && task.measurementActivityType && (
              <div
                className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-semibold text-emerald-900">
                  Measurement: {getCarbonActivityLabel(task.measurementActivityType)} ({getCarbonReductionUnit(task.measurementActivityType)})
                </p>
                <p className="mt-1 text-xs text-emerald-800">{getMeasurementStatusText(task)}</p>
                {task._id && task.measurementStatus === "baseline-pending" && (
                  <button
                    type="button"
                    onClick={() => openMeasurementForm(task._id!, "baseline")}
                    className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    Record baseline measurement
                  </button>
                )}
                {task._id && task.measurementStatus === "post-action-pending" && (
                  <button
                    type="button"
                    onClick={() => openMeasurementForm(task._id!, "post-action")}
                    className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    Record post-action measurement
                  </button>
                )}
              </div>
            )}

            {isInventoryTask(task) && (
              <div
                className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {(() => {
                  const coverage = getTaskInventoryCoverage(task);
                  const recordedCount = coverage.filter((area) => area.recorded).length;
                  const status = recordedCount === 0
                    ? "Inventory not started"
                    : recordedCount === coverage.length
                      ? "Baseline coverage complete"
                      : "Baseline partially recorded";
                  return (
                    <>
                      <p className="text-xs font-semibold text-blue-900">{status}</p>
                      <p className="mt-1 text-xs text-blue-800">Coverage is based on recorded activity types, not a carbon-reduction result.</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {coverage.map((area) => (
                          <span
                            key={area.key}
                            className={`rounded-full px-2 py-1 text-xs font-medium ${area.recorded ? "bg-blue-200 text-blue-900" : "bg-white text-blue-700"}`}
                          >
                            {area.recorded ? "✓" : "○"} {area.label}
                          </span>
                        ))}
                      </div>
                      {task._id && (
                        <button
                          type="button"
                          onClick={() => setInventoryFormTaskId(task._id!)}
                          className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                        >
                          Record carbon activity
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {projects.find((p) => p._id === task.projectId)?.name || "Unassigned"}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  task.priority === "high"
                    ? "bg-red-100 text-red-700"
                    : task.priority === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {task.priority} priority
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  task.impact === "high"
                    ? "bg-purple-100 text-purple-700"
                    : task.impact === "medium"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {task.impact} impact
              </span>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task._id!, e.target.value as Task["status"])}
                onClick={(e) => e.stopPropagation()}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-emerald-500 ${
                  task.status === "done"
                    ? "bg-emerald-100 text-emerald-700"
                    : task.status === "in-progress"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            {task.status === "done" && !isInventoryTask(task) && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3" onClick={(e) => e.stopPropagation()}>
                {task.carbonImpactStatus === "verified" && typeof task.actualCarbonReduction === "number" ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-900">
                      Carbon Savings: {task.actualCarbonReduction.toFixed(2)} kg CO₂
                    </p>
                    {task.carbonSavingsLinkedAt ? (
                      <p className="mt-1 text-xs font-medium text-emerald-800" role="status">
                        Added to Carbon Data. This verified task result is counted once in project totals.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleAddCarbon(task)}
                        disabled={addingCarbonTaskId === task._id}
                        className="mt-2 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
                      >
                        {addingCarbonTaskId === task._id ? "Adding..." : "Add Carbon"}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-emerald-900">
                    Carbon impact not yet verifiable — additional project activity data is required.
                  </p>
                )}
                {onOpenCarbonIntelligence && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCarbonIntelligence();
                    }}
                    className="mt-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                  >
                    Open Carbon Intelligence
                  </button>
                )}
              </div>
            )}
          </motion.div>
          {manualReductionTask?._id === task._id && (
            <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5" role="dialog" aria-labelledby={`record-carbon-reduction-title-${task._id}`}>
              <h4 id={`record-carbon-reduction-title-${task._id}`} className="text-lg font-bold text-emerald-900">Record Carbon Reduction</h4>
              <p className="mt-1 text-sm text-emerald-900">{task.title}</p>
              {projects.find((project) => project._id === task.projectId)?.name && (
                <p className="text-xs text-emerald-800">Project: {projects.find((project) => project._id === task.projectId)?.name}</p>
              )}
              <div className="mt-4 grid gap-3">
                <label className="text-sm font-semibold text-gray-800">
                  Carbon reduced <span className="font-normal">(kg CO₂e)</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={manualReductionAmount}
                    onChange={(event) => setManualReductionAmount(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                    disabled={isSavingManualReduction}
                  />
                </label>
                <label className="text-sm font-semibold text-gray-800">
                  Description or notes <span className="font-normal">(optional)</span>
                  <textarea
                    value={manualReductionDescription}
                    onChange={(event) => setManualReductionDescription(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                    rows={3}
                    disabled={isSavingManualReduction}
                  />
                </label>
                {manualReductionError && <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{manualReductionError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setManualReductionTask(null)} disabled={isSavingManualReduction} className="rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60">Cancel</button>
                  <button type="button" onClick={() => void handleSaveManualReduction()} disabled={isSavingManualReduction} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {isSavingManualReduction ? "Saving..." : "Save and Complete"}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No EcoTasks yet. Add a sustainability action to get started.</p>
        </div>
      )}
    </div>
  );
}
