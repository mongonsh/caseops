const KG = "kg";

const ISSUE_POINTS = {
  overload: 48,
  nearCapacity: 22,
  fragileStacking: 44,
  imbalanceHigh: 38,
  imbalanceMedium: 24,
  missingEvidence: 20,
  damagedCargo: 42,
  hazardousCargo: 34,
  temperatureSensitive: 24,
  lowConfidence: 22
};

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function itemWeight(item) {
  if (Number.isFinite(item.total_weight_kg)) {
    return item.total_weight_kg;
  }

  const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
  const unitWeight = Number.isFinite(item.unit_weight_kg)
    ? item.unit_weight_kg
    : Number.isFinite(item.weight_kg)
      ? item.weight_kg
      : 0;

  return quantity * unitWeight;
}

function normalizeCargoItems(caseLike) {
  return caseLike.cargo_items || caseLike.cargo || caseLike.items || [];
}

function getCapacity(caseLike) {
  return (
    caseLike.truck_capacity_kg ||
    caseLike.capacity_kg ||
    caseLike.truck?.capacity_kg ||
    0
  );
}

function severityLabel(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function createIssue({
  id,
  severity,
  title,
  evidence,
  recommendation,
  points,
  requiresHuman = false
}) {
  return {
    id,
    severity,
    title,
    evidence,
    recommendation,
    points,
    requires_human_review: requiresHuman
  };
}

function detectFragileUnderHeavy(items) {
  const fragileBottom = items.filter(
    (item) =>
      item.fragile &&
      ["bottom", "floor", "lower"].includes(String(item.stack_position || "").toLowerCase())
  );
  const heavyTop = items.filter(
    (item) =>
      (item.heavy || itemWeight(item) >= 1200) &&
      ["top", "upper", "above"].includes(String(item.stack_position || "").toLowerCase())
  );

  if (fragileBottom.length === 0 || heavyTop.length === 0) {
    return null;
  }

  const matched = fragileBottom.find((fragile) =>
    heavyTop.some((heavy) => heavy.stack_group && heavy.stack_group === fragile.stack_group)
  );

  return matched || fragileBottom[0];
}

function analyzeDistribution(distribution, totalWeight) {
  if (!distribution || totalWeight <= 0) {
    return null;
  }

  const left = distribution.left_kg ?? distribution.left;
  const right = distribution.right_kg ?? distribution.right;
  const front = distribution.front_kg ?? distribution.front;
  const rear = distribution.rear_kg ?? distribution.rear;
  const lateral = Number.isFinite(left) && Number.isFinite(right)
    ? Math.abs(left - right) / totalWeight
    : 0;
  const longitudinal = Number.isFinite(front) && Number.isFinite(rear)
    ? Math.abs(front - rear) / totalWeight
    : 0;
  const maxAxis = Math.max(lateral, longitudinal);

  if (maxAxis >= 0.25) {
    return { severity: "High", ratio: round(maxAxis, 3), points: ISSUE_POINTS.imbalanceHigh };
  }

  if (maxAxis >= 0.12) {
    return { severity: "Medium", ratio: round(maxAxis, 3), points: ISSUE_POINTS.imbalanceMedium };
  }

  return null;
}

export function analyzeCargo(caseLike = {}) {
  const items = normalizeCargoItems(caseLike);
  const capacityKg = getCapacity(caseLike);
  const totalWeightKg = items.reduce((sum, item) => sum + itemWeight(item), 0);
  const cargoCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const fragileItems = items.filter((item) => item.fragile).length;
  const heavyItems = items.filter((item) => item.heavy || itemWeight(item) >= 1200).length;
  const issues = [];
  const suggestions = [];

  if (capacityKg > 0 && totalWeightKg > capacityKg) {
    issues.push(
      createIssue({
        id: "overload",
        severity: "High",
        title: "Total cargo weight exceeds truck capacity",
        evidence: `${round(totalWeightKg)} ${KG} cargo against ${round(capacityKg)} ${KG} capacity`,
        recommendation: "Split the shipment or assign a higher-capacity truck before dispatch.",
        points: ISSUE_POINTS.overload,
        requiresHuman: true
      })
    );
    suggestions.push("Move overflow pallets to a second vehicle or larger container.");
  } else if (capacityKg > 0 && totalWeightKg / capacityKg > 0.9) {
    issues.push(
      createIssue({
        id: "near_capacity",
        severity: "Medium",
        title: "Truck is loaded above 90 percent of rated capacity",
        evidence: `${round((totalWeightKg / capacityKg) * 100, 1)} percent utilization`,
        recommendation: "Confirm axle limits and reserve margin before departure.",
        points: ISSUE_POINTS.nearCapacity
      })
    );
    suggestions.push("Confirm axle and dock scale readings after rebalancing.");
  }

  const fragileStack = detectFragileUnderHeavy(items);
  if (fragileStack) {
    issues.push(
      createIssue({
        id: "fragile_under_heavy",
        severity: "High",
        title: "Fragile cargo is stacked below heavy freight",
        evidence: `${fragileStack.name} is marked fragile and placed in a lower stack position`,
        recommendation: "Move fragile cargo to the upper layer or isolate it in a protected bay.",
        points: ISSUE_POINTS.fragileStacking,
        requiresHuman: true
      })
    );
    suggestions.push("Place heavy freight on the floor and fragile items above braced dunnage.");
  }

  const imbalance = analyzeDistribution(caseLike.weight_distribution, totalWeightKg);
  if (imbalance) {
    const high = imbalance.severity === "High";
    issues.push(
      createIssue({
        id: "weight_imbalance",
        severity: imbalance.severity,
        title: "Weight distribution is outside safe balance tolerance",
        evidence: `${round(imbalance.ratio * 100, 1)} percent imbalance across a load axis`,
        recommendation: "Reposition dense pallets toward the center line and validate axle load.",
        points: imbalance.points,
        requiresHuman: high
      })
    );
    suggestions.push("Rebalance the heaviest pallets toward the center and forward third.");
  }

  const evidence = caseLike.evidence || {};
  const hasImageEvidence = evidence.image_uploaded === true || Boolean(evidence.photo_url);
  const missingEvidence = !hasImageEvidence;
  if (missingEvidence) {
    issues.push(
      createIssue({
        id: "missing_evidence",
        severity: "Medium",
        title: "Cargo image or loading evidence is missing",
        evidence: "No cargo image or dock photo was provided for AI vision review",
        recommendation: "Request a dock photo before approval or dispatch.",
        points: ISSUE_POINTS.missingEvidence,
        requiresHuman: true
      })
    );
    suggestions.push("Capture front, rear, left, and right dock images for the audit trail.");
  }

  const damagedCargo = caseLike.metadata?.damaged_cargo_detected || items.some((item) => item.damaged);
  if (damagedCargo) {
    issues.push(
      createIssue({
        id: "damaged_cargo",
        severity: "High",
        title: "Damaged cargo detected in shipment metadata",
        evidence: caseLike.metadata?.damage_notes || "At least one cargo item is marked damaged",
        recommendation: "Route to supervisor and document exception handling before dispatch.",
        points: ISSUE_POINTS.damagedCargo,
        requiresHuman: true
      })
    );
    suggestions.push("Isolate damaged freight and attach exception photos to the case.");
  }

  const hazardousCargo = items.some((item) => item.hazardous);
  if (hazardousCargo) {
    issues.push(
      createIssue({
        id: "hazardous_cargo",
        severity: "High",
        title: "Hazardous cargo requires governed approval",
        evidence: "Shipment includes an item flagged as hazardous",
        recommendation: "Verify hazmat documentation and supervisor signoff.",
        points: ISSUE_POINTS.hazardousCargo,
        requiresHuman: true
      })
    );
    suggestions.push("Validate labels, segregation, and hazmat documents before loading.");
  }

  const temperatureSensitive = items.some((item) => item.temperature_sensitive);
  if (temperatureSensitive) {
    issues.push(
      createIssue({
        id: "temperature_sensitive",
        severity: "Medium",
        title: "Temperature-sensitive cargo requires handling confirmation",
        evidence: "Shipment includes chilled or temperature-controlled freight",
        recommendation: "Confirm reefer settings and temperature handoff before dispatch.",
        points: ISSUE_POINTS.temperatureSensitive,
        requiresHuman: true
      })
    );
    suggestions.push("Attach temperature setpoint and pre-cool confirmation to the case.");
  }

  let confidence = caseLike.ai_confidence_override ?? 0.96;
  if (missingEvidence) confidence -= 0.18;
  if (evidence.photo_quality === "low") confidence -= 0.1;
  if (caseLike.metadata?.manual_entry_only) confidence -= 0.08;
  if (items.length === 0) confidence -= 0.22;
  confidence = Math.max(0.42, Math.min(0.99, confidence));

  if (confidence < 0.75) {
    issues.push(
      createIssue({
        id: "low_confidence",
        severity: "Medium",
        title: "AI confidence is below the approval threshold",
        evidence: `${round(confidence * 100, 1)} percent confidence`,
        recommendation: "Route to human review because the automated assessment is uncertain.",
        points: ISSUE_POINTS.lowConfidence,
        requiresHuman: true
      })
    );
    suggestions.push("Ask the warehouse team for clearer evidence or corrected cargo metadata.");
  }

  const riskScore = Math.min(
    100,
    Math.round(10 + issues.reduce((sum, issue) => sum + issue.points, 0))
  );
  const riskLevel = severityLabel(riskScore);
  const requiresHumanReview =
    riskLevel === "High" ||
    riskScore >= 50 ||
    issues.some((issue) => issue.requires_human_review) ||
    confidence < 0.75;

  const recommendedAction = requiresHumanReview
    ? riskLevel === "High"
      ? "Hold dispatch and request supervisor approval with a safer loading plan."
      : "Send to supervisor for exception review before dispatch."
    : "Recommend approval for dispatch under standard loading checks.";

  const humanReasons = issues
    .filter((issue) => issue.requires_human_review || issue.severity === "High")
    .map((issue) => issue.title);

  return {
    case_id: caseLike.case_id,
    shipment_id: caseLike.shipment_id,
    stage: caseLike.stage || "Load Risk Analysis",
    cargo_count: cargoCount,
    total_weight_kg: round(totalWeightKg),
    truck_capacity_kg: capacityKg,
    fragile_items: fragileItems,
    heavy_items: heavyItems,
    risk_score: riskScore,
    risk_level: riskLevel,
    detected_issues: issues.map(({ points, ...issue }) => issue),
    confidence_score: round(confidence, 2),
    recommended_action: recommendedAction,
    requires_human_review: requiresHumanReview,
    why_human_approval_required: humanReasons,
    safer_loading_suggestion:
      suggestions.length > 0
        ? [...new Set(suggestions)]
        : ["Proceed with standard securement, dock photo evidence, and final seal check."]
  };
}

export function createDispatchInstruction(caseLike = {}, decision = {}) {
  const analysis = analyzeCargo(caseLike);
  const approvalStatus = decision.approval_status || caseLike.approval_status || "Pending";
  const approved = ["Approved", "Approved with conditions", "Auto recommended"].includes(approvalStatus);
  const blocked = ["Rejected", "Blocked"].includes(approvalStatus);
  const requiresConditions = analysis.requires_human_review || approvalStatus === "Approved with conditions";

  let finalDecision = "Hold for supervisor review";
  if (blocked) {
    finalDecision = "Dispatch blocked";
  } else if (approved && requiresConditions) {
    finalDecision = "Dispatch approved with safer loading plan";
  } else if (approved) {
    finalDecision = "Dispatch approved";
  }

  return {
    instruction_id: `DISP-${analysis.case_id || "NEW"}-${Date.now().toString().slice(-5)}`,
    case_id: analysis.case_id,
    shipment_id: analysis.shipment_id,
    final_decision: finalDecision,
    approval_status: approvalStatus,
    dispatch_instruction: blocked
      ? "Do not dispatch. Escalate the case, correct the loading exception, and reopen risk analysis."
      : approved
        ? "Dispatch may proceed after the listed loading controls are confirmed and attached to the audit trail."
        : "Hold dispatch until supervisor approval is captured in UiPath Maestro Case.",
    loading_controls: [
      ...analysis.safer_loading_suggestion,
      "Confirm cargo securement, seal number, driver acknowledgement, and departure timestamp."
    ],
    close_case: approved && !blocked,
    generated_by: "Logithon coded cargo-risk service"
  };
}
