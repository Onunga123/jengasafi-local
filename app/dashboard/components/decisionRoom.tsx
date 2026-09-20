"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Sparkles } from "lucide-react";
import Card from "@/components/ui/card";
import TextArea from "@/components/ui/text-area";
import { requestJson } from "@/lib/client-errors";
import type { DecisionRoomResponse } from "@/lib/decision-room/schema";

interface DecisionRoomProps {
  siteId: string;
  projectId: string;
  onTaskCreated: (task: CreatedTask) => void;
  onViewEcoTasks?: () => void;
}

interface CreatedTask {
  _id?: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "done";
  projectId: string;
  estimatedCarbonReduction?: number;
  dueDate?: string;
}

const defaultQuestion =
  "What should we focus on first to reduce this project's environmental impact while keeping the plan practical and cost-conscious?";

const sourceLabels: Record<string, string> = {
  recorded_project_data: "Recorded project data",
  deterministic_calculation: "Deterministic calculation",
  external_estimate: "External estimate",
  ai_reasoning: "AI reasoning",
};

export default function DecisionRoom({ siteId, projectId, onTaskCreated, onViewEcoTasks }: DecisionRoomProps) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<DecisionRoomResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingStep, setCreatingStep] = useState<number | null>(null);
  const [createdSteps, setCreatedSteps] = useState<Set<number>>(new Set());
  const [taskErrors, setTaskErrors] = useState<Record<number, string>>({});

  const submitQuestion = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedQuestion = question.trim();

    if (!siteId || !projectId) {
      setError("Create or select a project before asking the Decision Room.");
      return;
    }
    if (!trimmedQuestion) {
      setError("Enter a question for the Decision Room.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const response = await requestJson<DecisionRoomResponse>("/api/decision-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, projectId, question: trimmedQuestion }),
      });
      setResult(response);
      setCreatedSteps(new Set());
      setTaskErrors({});
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The Decision Room could not answer right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const addNextStepToEcoTasks = async (stepIndex: number) => {
    const step = result?.nextSteps[stepIndex];
    if (!step || !projectId || creatingStep !== null || createdSteps.has(stepIndex)) return;

    setTaskErrors((current) => ({ ...current, [stepIndex]: "" }));
    setCreatingStep(stepIndex);
    try {
      const createdTask = await requestJson<CreatedTask>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: step.title,
          description: step.description,
          priority: step.priority,
          impact: step.impact,
          estimatedCarbonReduction: step.estimatedCarbonReduction,
          dueDate: step.dueDate,
          projectId,
          status: "todo",
        }),
      });
      onTaskCreated(createdTask);
      setCreatedSteps((current) => new Set(current).add(stepIndex));
    } catch (requestError) {
      setTaskErrors((current) => ({
        ...current,
        [stepIndex]: requestError instanceof Error ? requestError.message : "Unable to add this next step to EcoTasks.",
      }));
    } finally {
      setCreatingStep(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Brain className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide">Decision Room</p>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Ask about your project</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Get a grounded recommendation based on the currently recorded project context, with evidence, tradeoffs, uncertainties, and proposed next steps.
            </p>
          </div>
          <Sparkles className="hidden h-8 w-8 text-emerald-500 sm:block" aria-hidden="true" />
        </div>

        {!siteId || !projectId ? (
          <div className="mt-6 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            Create or select a construction project before using the Decision Room.
          </div>
        ) : (
          <form onSubmit={submitQuestion} className="mt-6 space-y-4">
            <label htmlFor="decision-room-question" className="block text-sm font-semibold text-slate-700">
              Your question
            </label>
            <TextArea
              id="decision-room-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={defaultQuestion}
              rows={5}
              disabled={isLoading}
              aria-describedby="decision-room-help"
              className="border border-slate-300 bg-white ps-3 text-slate-900 placeholder:text-slate-400"
            />
            <p id="decision-room-help" className="text-xs text-slate-500">
              Questions are answered from the selected project and site context. The Decision Room does not change project records.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                <Brain className="h-4 w-4" aria-hidden="true" />
                {isLoading ? "Analyzing project context..." : "Ask Decision Room"}
              </button>
              {!result && !isLoading && (
                <button
                  type="button"
                  onClick={() => setQuestion(defaultQuestion)}
                  className="rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  Use example question
                </button>
              )}
            </div>
          </form>
        )}

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="space-y-3">
              <p>{error}</p>
              {question.trim() && siteId && projectId && !isLoading && (
                <button
                  type="button"
                  onClick={() => void submitQuestion()}
                  className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      {!result && !isLoading && !error && siteId && projectId && (
        <Card className="border-slate-200 bg-slate-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">A grounded project conversation</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Ask about priorities, evidence, tradeoffs, constraints, uncertainties, or next steps. The response will keep its evidence provenance visible.
              </p>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <div className="space-y-6" aria-live="polite">
          <Card className="border-emerald-300 bg-emerald-50">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Recommendation</p>
            <p className="mt-2 text-xl font-bold leading-8 text-emerald-950">{result.recommendation}</p>
          </Card>

          <Card title="Reasoning" className="border-slate-200 bg-white">
            <p className="text-sm leading-7 text-slate-700">{result.reasoning}</p>
          </Card>

          <Card title="Evidence" className="border-slate-200 bg-white">
            <div className="space-y-4">
              {result.evidence.map((item, index) => (
                <div key={`${item.source}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm leading-6 text-slate-800">{item.statement}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                      {sourceLabels[item.source] || item.source}
                    </span>
                    {item.sourceReference && (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
                        {item.sourceReference}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Tradeoffs" className="border-amber-200 bg-amber-50 text-slate-900">
              <BulletList items={result.tradeoffs} emptyLabel="No tradeoffs were returned." />
            </Card>
            <Card title="Constraints considered" className="border-blue-200 bg-blue-50 text-slate-900">
              <BulletList items={result.constraintsConsidered} emptyLabel="No constraints were returned." />
            </Card>
            <Card title="Uncertainties" className="border-violet-200 bg-violet-50 text-slate-900">
              <BulletList items={result.uncertainties} emptyLabel="No uncertainties were returned." />
            </Card>
          </div>

          <Card title="Next steps" className="border-slate-200 bg-white">
            <div className="grid gap-4 md:grid-cols-2">
              {result.nextSteps.map((step, index) => (
                <div key={`${step.title}-${index}`} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{step.title}</h3>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">
                      {step.priority} priority
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">Impact: {step.impact}</span>
                    {step.estimatedCarbonReduction !== undefined && step.estimatedCarbonReduction !== null && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Estimated reduction: {step.estimatedCarbonReduction} kg CO₂
                      </span>
                    )}
                    {step.dueDate && <span className="rounded-full bg-slate-100 px-2.5 py-1">Due: {formatDate(step.dueDate)}</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void addNextStepToEcoTasks(index)}
                      disabled={creatingStep !== null || createdSteps.has(index)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    >
                      {creatingStep === index
                        ? "Adding..."
                        : createdSteps.has(index)
                          ? "Added to EcoTasks"
                          : "Add to EcoTasks"}
                    </button>
                    {createdSteps.has(index) && <span className="text-xs font-medium text-emerald-700">Task created successfully.</span>}
                    {createdSteps.has(index) && onViewEcoTasks && (
                      <button
                        type="button"
                        onClick={() => onViewEcoTasks()}
                        className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      >
                        View in EcoTasks
                      </button>
                    )}
                    {taskErrors[index] && <span role="alert" className="text-xs font-medium text-red-700">{taskErrors[index]}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function BulletList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-700">{emptyLabel}</p>;
  return (
    <ul className="space-y-3 text-sm leading-6 text-slate-800">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}