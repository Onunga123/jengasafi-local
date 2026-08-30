"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { requestJson } from "@/lib/client-errors";

interface Project {
  _id?: string;
  name: string;
  siteId: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
}

interface Site {
  _id: string;
  name: string;
}

interface ProjectListProps {
  projects: Project[];
  onAddProject: (project: Project) => void;
  onProjectSelect?: (projectId: string) => void;
}

export default function ProjectList({
  projects,
  onAddProject,
  onProjectSelect,
}: ProjectListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    siteId: "",
  });

  useEffect(() => {
    if (showAddForm) {
      fetch("/api/sites")
        .then((res) => res.json())
        .then((data) => setSites(data))
        .catch((err) => console.error("Failed to load sites", err));
    }
  }, [showAddForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const savedProject = await requestJson<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });

      onAddProject(savedProject);
      setShowAddForm(false);
      setNewProject({
        name: "",
        description: "",
        location: "",
        startDate: "",
        endDate: "",
        siteId: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create project.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-emerald-700">
          Projects
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Add New Project
        </button>
      </div>

      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200"
        >
          <h4 className="font-medium text-emerald-800 mb-4 text-lg">
            Add Project
          </h4>
          {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name*
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={newProject.name || ""}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  placeholder="e.g., Umoja Residential Complex"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location*
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={newProject.location || ""}
                  onChange={(e) =>
                    setNewProject({ ...newProject, location: e.target.value })
                  }
                  placeholder="e.g., Nairobi, Kenya"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date*
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={newProject.startDate || ""}
                  onChange={(e) =>
                    setNewProject({ ...newProject, startDate: e.target.value })
                  }
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date*
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={newProject.endDate || ""}
                  onChange={(e) =>
                    setNewProject({ ...newProject, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Site Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site*
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={newProject.siteId || ""}
                onChange={(e) =>
                  setNewProject({ ...newProject, siteId: e.target.value })
                }
              >
                <option value="">Select a site</option>
                {sites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                rows={3}
                value={newProject.description || ""}
                onChange={(e) =>
                  setNewProject({ ...newProject, description: e.target.value })
                }
                placeholder="Describe the project scope, goals, and key details..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-md hover:bg-emerald-700 transition-colors font-medium"
              >
                Create Project
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

      {/* Project portfolio */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <motion.div
            key={project._id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-white"
            onClick={() =>
              onProjectSelect && project._id && onProjectSelect(project._id)
            }
          >
            <h4 className="font-bold text-emerald-800 mb-2 text-lg">
              {project.name}
            </h4>
            <p className="text-sm text-gray-600 mb-3 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Project location: {project.location}
            </p>
            <p className="text-sm text-gray-700 mb-4 line-clamp-3">
              {project.description}
            </p>
            <div className="pt-3 border-t border-gray-100 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Start:</span>
                <span className="font-medium">
                  {new Date(project.startDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>End:</span>
                <span className="font-medium">
                  {new Date(project.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {projects.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mx-auto text-gray-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p>No projects yet.</p>
          <p className="mt-1">Create a project and connect it to one of your construction sites.</p>
        </div>
      )}
    </div>
  );
}
