"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ClientInfoModal from "./components/clientInfoModal";
import ProjectList from "./components/projectList";
import EcoTaskManager from "./components/ecotaskManager";
import DecisionRoom from "./components/decisionRoom";
import CarbonData from "./components/carbonData";
import CarbonVisualization from "@/components/environment/carbonnew";
import { isInventoryTaskText } from "@/lib/taskWorkflow";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 👇 REMOVE localStorage initialization - start with null
  const [clientData, setClientData] = useState<any | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [ecoTasks, setEcoTasks] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [carbonRefreshSignal, setCarbonRefreshSignal] = useState(0);
  const [recentlyCompletedTaskId, setRecentlyCompletedTaskId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    router.replace(tab === "overview" ? "/dashboard" : `/dashboard?tab=${tab}`);
  };


  // 👇 Create user-specific localStorage key
  const getStorageKey = useCallback(() => {
    return session?.user?.email
      ? `jengasafi-clientProfile-${session.user.email}`
      : "jengasafi-clientProfile-anonymous";
  }, [session?.user?.email]);

  const fetchData = useCallback(async () => {
    if (status !== "authenticated") return;

    setLoadingProfile(true);
    try {
      // Fetch independent dashboard resources in parallel.
      const [profileRes, projectsRes, sitesRes, tasksRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/projects"),
        fetch("/api/sites"),
        fetch("/api/tasks"),
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile && Object.keys(profile).length > 0) {
          setClientData(profile);
          // 👇 Store with user-specific key
          sessionStorage.setItem(getStorageKey(), JSON.stringify(profile));
        } else {
          setClientData(null);
          sessionStorage.removeItem(getStorageKey());
        }
      } else {
        console.error("Failed to fetch profile, status:", profileRes.status);
        // On error, try to load from cache as fallback
        const cached = sessionStorage.getItem(getStorageKey());
        if (cached) {
          setClientData(JSON.parse(cached));
        }
      }

      if (projectsRes.ok) setProjects(await projectsRes.json());

      if (sitesRes.ok) setSites(await sitesRes.json());

      if (tasksRes.ok) setEcoTasks(await tasksRes.json());
    } catch (err) {
      console.error("❌ Network error fetching dashboard data:", err);
      // On network error, try cached data
      const cached = sessionStorage.getItem(getStorageKey());
      if (cached) {
        setClientData(JSON.parse(cached));
      }
    } finally {
      setHasFetched(true);
      setLoadingProfile(false);
    }
  }, [status, getStorageKey]);

  useEffect(() => {
    if (status === "authenticated" && !hasFetched) {
      fetchData();
    }
  }, [status, hasFetched, fetchData]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "projects" || tab === "eco-tasks" || tab === "decision-room" || tab === "carbon-intelligence" || tab === "carbon-data") setActiveTab(tab);
    else setActiveTab("overview");
  }, [searchParams]);

  useEffect(() => {
    setCurrentTime(new Date());
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timeInterval);
  }, []);



  // 👇 Clear data when user logs out
  useEffect(() => {
    if (status === "unauthenticated") {
      setClientData(null);
      setProjects([]);
      setEcoTasks([]);
      setHasFetched(false);
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith("jengasafi-clientProfile-")) {
          sessionStorage.removeItem(k);
        }
      });
    }
  }, [status]);

  const handleProfileSave = (profile: any) => {
    setClientData(profile);
    // 👇 Store with user-specific key
    sessionStorage.setItem(getStorageKey(), JSON.stringify(profile));
  };

  // Project and Task handlers
  const addProject = (p: any) => setProjects((prev) => [...prev, p]);
  const addEcoTask = (t: any) => setEcoTasks((prev) => [...prev, t]);
  const updateEcoTask = (t: any) => {
    setEcoTasks((prev) => prev.map((x) => (x._id === t._id ? t : x)));
    if (t?.status === "done") {
      setCarbonRefreshSignal((prev) => prev + 1);
    }
  };
  const deleteEcoTask = (taskId: string) => {
    setEcoTasks((prev) => prev.filter((task) => task._id !== taskId));
  };

  const greeting = currentTime
    ? (() => {
        const hour = currentTime.getHours();
        if (hour >= 5 && hour < 12) return "Good morning";
        if (hour >= 12 && hour < 17) return "Good afternoon";
        if (hour >= 17 && hour < 21) return "Good evening";
        return "Good night";
      })()
    : "Good morning";

  // --- render ---
  if (status === "loading" || (status === "authenticated" && loadingProfile)) {
    return (
      <div className="text-center text-gray-500 p-8">
        Loading your dashboard…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="text-center text-red-500 p-8">
        You must be signed in to view this page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-3 sm:p-6 lg:p-8">
      {!loadingProfile && hasFetched && !clientData && (
        <ClientInfoModal onSave={handleProfileSave} />
      )}

      {!loadingProfile && clientData && (
        <div className="space-y-10">
          {/* Section Content */}
          <div className="space-y-8">
            {activeTab === "overview" && (
              <div className="space-y-8">
                <header className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                    Operational overview
                  </p>
                  <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                    {greeting}, {session?.user?.name?.split(" ")[0] || "there"}
                  </h1>
                  <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
                    Understand what is happening on your construction work, what needs attention, and which action to take next.
                  </p>
                </header>

                <section className="app-surface p-4 sm:p-6" aria-labelledby="project-context-title">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Carbon intelligence command center</p>
                      <h2 id="project-context-title" className="mt-1 text-2xl font-bold text-slate-900">Construction project context</h2>
                      <p className="mt-1 text-slate-600">Use the operational tabs to review projects and sustainability actions.</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <span className="font-semibold">{projects.length}</span> project{projects.length === 1 ? "" : "s"} tracked
                    </div>
                  </div>
                  {projects.length > 0 ? (
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current project</p>
                        <p className="mt-1 font-semibold text-slate-900">{projects[0].name}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project location</p>
                        <p className="mt-1 font-semibold text-slate-900">{projects[0].location || "Not specified"}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open EcoTasks</p>
                        <p className="mt-1 font-semibold text-slate-900">{ecoTasks.filter((task) => task.status !== "done").length}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                      No construction project is linked yet. Open the Projects tab to create one and establish the context for carbon tracking.
                    </div>
                  )}
                </section>

                <section className="grid gap-6 lg:grid-cols-2" aria-label="Next actions">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                    <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Needs attention</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">{ecoTasks.length > 0 ? `${ecoTasks.filter((task) => task.status !== "done").length} EcoTasks remain open` : "No sustainability actions recorded"}</h2>
                    <p className="mt-2 text-sm text-slate-700">{ecoTasks.length > 0 ? "Review EcoTasks to turn sustainability priorities into assigned project actions." : "Add an EcoTask when you identify an opportunity to reduce the impact of construction work."}</p>
                    <button type="button" onClick={() => selectTab("eco-tasks")} className="mt-4 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-800">Open EcoTasks</button>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">Next action</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Record the next field activity</h2>
                    <p className="mt-2 text-sm text-slate-700">Carbon activity records provide evidence for project emissions, savings, and recommendations. Open Carbon Intelligence to review the recorded data and trends.</p>
                  </div>
                </section>


              </div>
            )}

            {activeTab === "carbon-intelligence" && (
              <section className="app-surface p-4 sm:p-6" aria-labelledby="sustainability-status-title">
                <div className="mb-6">
                  <h2 id="sustainability-status-title" className="text-2xl font-bold text-emerald-800">Carbon status</h2>
                  <p className="text-gray-600">Review recorded construction activity and identify the next area to improve.</p>
                </div>
                <CarbonVisualization
                  siteId={(() => {
                    const completedTask = ecoTasks.find((task) => task._id === recentlyCompletedTaskId);
                    return projects.find((project) => project._id === completedTask?.projectId)?.siteId
                      || projects[0]?.siteId
                      || sites[0]?._id
                      || "";
                  })()}
                  refreshSignal={carbonRefreshSignal}
                  completedTaskId={recentlyCompletedTaskId}
                  completedTaskTitle={ecoTasks.find((task) => task._id === recentlyCompletedTaskId && task.status === "done")?.title ?? null}
                  completedTaskImpact={ecoTasks.find((task) => task._id === recentlyCompletedTaskId && task.status === "done")?.actualCarbonReduction ?? null}
                  completedTaskImpactStatus={ecoTasks.find((task) => task._id === recentlyCompletedTaskId && task.status === "done")?.carbonImpactStatus ?? "not-verifiable"}
                  completedTaskType={(() => {
                    const completedTask = ecoTasks.find((task) => task._id === recentlyCompletedTaskId && task.status === "done");
                    return completedTask?.taskType === "inventory" || isInventoryTaskText(completedTask?.title, completedTask?.description)
                      ? "inventory"
                      : completedTask?.taskType;
                  })()}
                  carbonEmitted={clientData?.carbonEmitted ?? 0}
                  carbonSaved={clientData?.carbonSaved ?? 0}
                  trend={[
                    {
                      time: new Date().toISOString(),
                      emissions: clientData?.carbonEmitted ?? 0,
                      savings: clientData?.carbonSaved ?? 0,
                      net:
                        (clientData?.carbonEmitted ?? 0) -
                        (clientData?.carbonSaved ?? 0),
                    },
                  ]}
                />
              </section>
            )}
            {activeTab === "carbon-data" && (
              <CarbonData siteId={projects[0]?.siteId || sites[0]?._id || ""} />
            )}
            {activeTab === "projects" && (
              <ProjectList projects={projects} onAddProject={addProject} />
            )}

            {activeTab === "eco-tasks" && (
              <EcoTaskManager
                tasks={ecoTasks}
                projects={projects}
                onUpdateTask={updateEcoTask}
                onTaskCompleted={setRecentlyCompletedTaskId}
                recentlyCompletedTaskId={recentlyCompletedTaskId}
                onOpenCarbonIntelligence={() => selectTab("carbon-intelligence")}
                onDeleteTask={deleteEcoTask}
              />
            )}

            {activeTab === "decision-room" && (
              <DecisionRoom
                siteId={projects[0]?.siteId || sites[0]?._id || ""}
                projectId={projects[0]?._id || ""}
                onTaskCreated={addEcoTask}
                onViewEcoTasks={() => selectTab("eco-tasks")}
              />
            )}
          </div>

        </div>
      )}
      {loadingProfile && (
        <div className="text-gray-500 text-center">Loading profile…</div>
      )}
    </div>
  );
}
