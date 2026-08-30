"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { requestJson } from "@/lib/client-errors";

interface Project {
  _id: string;
  name: string;
}

interface Task {
  _id?: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "done";
  projectId: string;
  estimatedCarbonReduction?: number;
  dueDate?: string;
  assignedTo?: string;
}

interface EcoTaskManagerProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
onDeleteTask: (taskId: string) => void;
}

export default function EcoTaskManager({
  tasks,
  projects,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: EcoTaskManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: "",
    description: "",
    priority: "medium",
    impact: "medium",
    status: "todo",
    projectId: projects.length > 0 ? projects[0]._id : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const savedTask = await requestJson<Task>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      onAddTask(savedTask);
      setShowAddForm(false);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        impact: "medium",
        status: "todo",
        projectId: projects.length > 0 ? projects[0]._id : "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setIsSaving(false);
    }
  };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
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

  const handleStatusChange = (taskId: string, newStatus: Task["status"]) => {
    handleUpdateTask(taskId, { status: newStatus });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-emerald-700">EcoTasks</h3>
          <p className="text-sm text-gray-600">Sustainability-focused actions with measurable environmental impact</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
            + New EcoTask
        </button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Add Task Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200"
        >
          <h4 className="font-medium text-emerald-800 mb-4 text-lg">
            Add a Sustainability EcoTask
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title*
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={newTask.title || ""}
                onChange={(e) =>
                  setNewTask({ ...newTask, title: e.target.value })
                }
                placeholder="e.g., Install solar panels, Implement waste sorting"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                rows={3}
                value={newTask.description || ""}
                onChange={(e) =>
                  setNewTask({ ...newTask, description: e.target.value })
                }
                placeholder="Describe the task and its environmental impact..."
              />
            </div>

            {/* Project select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project (the work this EcoTask supports)
              </label>
              <select
                value={newTask.projectId}
                onChange={(e) =>
                  setNewTask({ ...newTask, projectId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              >
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority / Impact / Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      priority: e.target.value as Task["priority"],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Environmental Impact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Environmental Impact
                </label>
                <select
                  value={newTask.impact}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      impact: e.target.value as Task["impact"],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="low">Low Impact</option>
                  <option value="medium">Medium Impact</option>
                  <option value="high">High Impact</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={newTask.status}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      status: e.target.value as Task["status"],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {/* Estimated Carbon Reduction */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Carbon Reduction (kg CO₂)
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={newTask.estimatedCarbonReduction || ""}
                onChange={(e) =>
                  setNewTask({ 
                    ...newTask, 
                    estimatedCarbonReduction: e.target.value ? Number(e.target.value) : undefined 
                  })
                }
                placeholder="e.g., 150.5"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-md hover:bg-emerald-700 transition-colors font-medium"
              >
                {isSaving ? "Saving..." : "Create EcoTask"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-200 text-gray-700 px-5 py-2.5 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map((task) => (
          <motion.div
            key={task._id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-white"
            onClick={() => setEditingTask(task)}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-emerald-800 text-lg flex-1">
                {task.title}
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTask(task._id!);
                }}
                className="text-gray-400 hover:text-red-500 ml-2"
              >
                ×
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
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {tasks.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-gray-500">
          <p>No EcoTasks yet. Add a sustainability action to get started.</p>
        </div>
      )}
    </div>
  );
}