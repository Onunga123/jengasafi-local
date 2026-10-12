export type TaskCarbonSavingsLinkInput = {
  status?: unknown;
  actualCarbonReduction?: unknown;
  carbonImpactStatus?: unknown;
  postActionActivityId?: unknown;
};

export function canLinkVerifiedTaskCarbonSavings(task: TaskCarbonSavingsLinkInput) {
  return (
    task.status === "done" &&
    task.carbonImpactStatus === "verified" &&
    typeof task.actualCarbonReduction === "number" &&
    Number.isFinite(task.actualCarbonReduction) &&
    task.actualCarbonReduction >= 0 &&
    task.postActionActivityId !== undefined &&
    task.postActionActivityId !== null &&
    task.postActionActivityId !== ""
  );
}