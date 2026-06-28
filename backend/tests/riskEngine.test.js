import assert from "node:assert/strict";

import { sampleCases } from "../data/cases.js";
import { analyzeCargo, createDispatchInstruction } from "../riskEngine.js";

const lowRisk = analyzeCargo(sampleCases[0]);
assert.equal(lowRisk.risk_level, "Low");
assert.equal(lowRisk.requires_human_review, false);
assert.equal(lowRisk.detected_issues.length, 0);

const imbalance = analyzeCargo(sampleCases[1]);
assert.equal(imbalance.risk_level, "High");
assert.equal(imbalance.requires_human_review, true);
assert.ok(imbalance.detected_issues.some((issue) => issue.id === "weight_imbalance"));
assert.ok(imbalance.detected_issues.some((issue) => issue.id === "near_capacity"));

const fragile = analyzeCargo(sampleCases[2]);
assert.equal(fragile.risk_level, "High");
assert.equal(fragile.requires_human_review, true);
assert.ok(fragile.detected_issues.some((issue) => issue.id === "fragile_under_heavy"));
assert.ok(fragile.detected_issues.some((issue) => issue.id === "missing_evidence"));
assert.ok(fragile.detected_issues.some((issue) => issue.id === "hazardous_cargo"));
assert.ok(fragile.detected_issues.some((issue) => issue.id === "temperature_sensitive"));

const instruction = createDispatchInstruction(sampleCases[2], {
  approval_status: "Approved with conditions"
});
assert.equal(instruction.final_decision, "Dispatch approved with safer loading plan");
assert.equal(instruction.close_case, true);

const liveOperatorCase = analyzeCargo({
  case_id: "LCOPS-LIVE-TEST",
  shipment_id: "SHP-LIVE-TEST",
  truck_capacity_kg: 6500,
  cargo_items: [
    {
      name: "Dense machine pallet",
      quantity: 3,
      unit_weight_kg: 2100,
      heavy: true,
      stack_position: "floor"
    },
    {
      name: "Fragile replacement sensors",
      quantity: 6,
      unit_weight_kg: 18,
      fragile: true,
      stack_position: "top"
    }
  ],
  weight_distribution: {
    left_kg: 6100,
    right_kg: 308,
    front_kg: 3600,
    rear_kg: 2808
  },
  evidence: {
    image_uploaded: true,
    photo_quality: "operator-attested"
  },
  metadata: {
    manual_entry_only: true
  }
});
assert.equal(liveOperatorCase.risk_level, "High");
assert.equal(liveOperatorCase.requires_human_review, true);
assert.ok(liveOperatorCase.detected_issues.some((issue) => issue.id === "weight_imbalance"));

console.log("riskEngine tests passed");
