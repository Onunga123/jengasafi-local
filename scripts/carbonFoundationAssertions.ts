import assert from "node:assert/strict";
import {
  CarbonActivityContractError,
  normalizeCarbonActivityInput,
  normalizeCarbonActivityRecord,
  validateCarbonActivityInput,
} from "@/lib/carbonActivityContract";
import { calculateActivityTotals, emissionFactors } from "@/lib/carbonCalculation";
import {
  getTaskCarbonReductionStatus,
  getTaskMeasurementStatus,
  isNegativeTaskCarbonReduction,
  isVerifiedTaskCarbonReduction,
} from "@/lib/taskMeasurement";
import { canLinkVerifiedTaskCarbonSavings } from "@/lib/taskCarbonSavings";

const activity = {
  id: "ordinary",
  timestamp: "2026-01-01T00:00:00.000Z",
  description: "ordinary activity",
  type: "energy",
  value: 2,
  fuelType: "grid",
};

assert.equal(validateCarbonActivityInput(activity).value, 2);
assert.throws(() => validateCarbonActivityInput({ ...activity, value: -1 }), CarbonActivityContractError);
assert.throws(() => validateCarbonActivityInput({ ...activity, value: Number.NaN }), CarbonActivityContractError);
assert.throws(() => validateCarbonActivityInput({ ...activity, value: Number.POSITIVE_INFINITY }), CarbonActivityContractError);

const material = { ...activity, type: "material", value: 1, standardEF: 0, sustainableEF: 0 };
assert.equal(validateCarbonActivityInput(material).standardEF, 0);
assert.equal(normalizeCarbonActivityInput({ ...material, type: "material_savings" }).type, "material");
assert.throws(() => normalizeCarbonActivityInput({ ...material, type: "unknown" }), CarbonActivityContractError);
assert.throws(() => validateCarbonActivityInput({ ...material, standardEF: -1 }), CarbonActivityContractError);
assert.throws(() => validateCarbonActivityInput({ ...material, sustainableEF: Number.NaN }), CarbonActivityContractError);
assert.throws(() => validateCarbonActivityInput({ ...activity, type: "material" }), CarbonActivityContractError);

assert.equal(calculateActivityTotals([{ ...material, standardEF: 800, sustainableEF: 350 }], emissionFactors).savings, 450);
assert.equal(calculateActivityTotals([{ ...material, standardEF: 350, sustainableEF: 800 }], emissionFactors).savings, -450);
assert.ok(Math.abs(calculateActivityTotals([{ ...activity, value: 0.1 }], emissionFactors).emissions - 0.043) < Number.EPSILON);
assert.equal(calculateActivityTotals([{ ...activity, value: 2, fuelType: "diesel" }], emissionFactors).emissions, 5.36);

assert.throws(() => calculateActivityTotals([{ ...activity, value: Number.NaN }], emissionFactors), CarbonActivityContractError);
assert.throws(() => calculateActivityTotals([{ ...material, standardEF: undefined }], emissionFactors), CarbonActivityContractError);

assert.equal(getTaskCarbonReductionStatus(12), "verified");
assert.equal(getTaskCarbonReductionStatus(0), "verified");
assert.equal(getTaskCarbonReductionStatus(-12), "not-verifiable");
assert.equal(getTaskMeasurementStatus({
  measurementMode: "baseline-post-action",
  baselineActivityId: "baseline",
  postActionActivityId: "post-action",
  actualCarbonReduction: -12,
  carbonImpactStatus: "not-verifiable",
}), "not-verifiable");
assert.equal(getTaskMeasurementStatus({
  measurementMode: "baseline-post-action",
  baselineActivityId: "baseline",
  postActionActivityId: "post-action",
}), "ready-to-calculate");
assert.equal(isNegativeTaskCarbonReduction(-12), true);
assert.equal(isNegativeTaskCarbonReduction(0), false);
assert.equal(isNegativeTaskCarbonReduction(Number.NaN), false);
assert.equal(isVerifiedTaskCarbonReduction(12, "verified"), true);
assert.equal(isVerifiedTaskCarbonReduction(-12, "not-verifiable"), false);
assert.equal(isVerifiedTaskCarbonReduction(-12, "verified"), false);
assert.equal(isVerifiedTaskCarbonReduction(12, "not-verifiable"), false);
assert.equal(canLinkVerifiedTaskCarbonSavings({
  status: "done",
  actualCarbonReduction: 12,
  carbonImpactStatus: "verified",
  postActionActivityId: "post-action",
}), true);
assert.equal(canLinkVerifiedTaskCarbonSavings({
  status: "done",
  actualCarbonReduction: 0,
  carbonImpactStatus: "verified",
  postActionActivityId: "post-action",
}), true);
assert.equal(canLinkVerifiedTaskCarbonSavings({
  status: "done",
  actualCarbonReduction: -1,
  carbonImpactStatus: "verified",
  postActionActivityId: "post-action",
}), false);
assert.equal(canLinkVerifiedTaskCarbonSavings({
  status: "done",
  actualCarbonReduction: 12,
  carbonImpactStatus: "not-verifiable",
  postActionActivityId: "post-action",
}), false);
assert.equal(canLinkVerifiedTaskCarbonSavings({
  status: "done",
  actualCarbonReduction: 12,
  carbonImpactStatus: "verified",
}), false);

const normalized = normalizeCarbonActivityRecord({
  _id: "legacy-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...material,
});
assert.equal(normalized.unit, "tons");

console.log("Carbon foundation assertions passed");