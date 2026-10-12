export type TaskWorkflowType = "standard" | "inventory";

const inventoryTaskPattern = /(?:carbon\s+activity\s+inventory|activity\s+inventory|establish(?:ing)?\s+(?:the\s+)?(?:project\s+)?baseline|collect(?:ing)?\s+(?:the\s+)?(?:project\s+)?(?:activity|emissions)\s+data|record(?:ing)?\s+(?:the\s+)?(?:project\s+)?(?:activity|emissions)\s+data)/i;

export function isInventoryTaskText(title?: unknown, description?: unknown) {
  return inventoryTaskPattern.test(`${typeof title === "string" ? title : ""} ${typeof description === "string" ? description : ""}`);
}

export function resolveTaskWorkflowType(input: {
  taskType?: unknown;
  title?: unknown;
  description?: unknown;
}): TaskWorkflowType {
  if (input.taskType === "inventory") return "inventory";
  if (input.taskType === "standard") return "standard";
  return isInventoryTaskText(input.title, input.description) ? "inventory" : "standard";
}