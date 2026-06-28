import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sampleCases } from "./data/cases.js";
import {
  caseEntitySchema,
  maestroCasePlan,
  submissionChecklist,
  taskContracts
} from "./maestroCasePlan.js";
import { analyzeCargo, createDispatchInstruction } from "./riskEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 4000;

const cases = new Map(sampleCases.map((caseRecord) => [caseRecord.case_id, clone(caseRecord)]));

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function timestamp() {
  return new Date().toISOString();
}

function addAuditEvent(caseRecord, actor, event) {
  caseRecord.audit_events = caseRecord.audit_events || [];
  caseRecord.audit_events.push({
    timestamp: timestamp(),
    actor,
    event
  });
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeCargoItem(item, index) {
  return {
    sku: item.sku || `LIVE-${String(index + 1).padStart(3, "0")}`,
    name: item.name || `Cargo item ${index + 1}`,
    quantity: toNumber(item.quantity, 1),
    unit_weight_kg: toNumber(item.unit_weight_kg ?? item.weight_kg, 0),
    fragile: Boolean(item.fragile),
    heavy: Boolean(item.heavy),
    hazardous: Boolean(item.hazardous),
    damaged: Boolean(item.damaged),
    temperature_sensitive: Boolean(item.temperature_sensitive),
    stack_position: item.stack_position || "floor",
    stack_group: item.stack_group || "main"
  };
}

function normalizeLiveCasePayload(payload) {
  const incoming = payload.case || payload;
  const cargoItems = Array.isArray(incoming.cargo_items)
    ? incoming.cargo_items.map(normalizeCargoItem).filter((item) => item.unit_weight_kg > 0)
    : [];

  if (cargoItems.length === 0) {
    const error = new Error("At least one cargo item with weight is required.");
    error.statusCode = 400;
    throw error;
  }

  const now = Date.now().toString().slice(-6);
  const shipmentId = incoming.shipment_id || `SHP-LIVE-${now}`;
  const caseId = incoming.case_id || `LCOPS-${now}`;

  return {
    case_id: caseId,
    shipment_id: shipmentId,
    uipath_case_id: incoming.uipath_case_id || null,
    title: incoming.title || "Live cargo loading safety case",
    case_source: incoming.case_source || "Live intake",
    is_sample: false,
    truck_type: incoming.truck_type || "Unspecified truck",
    truck_capacity_kg: toNumber(incoming.truck_capacity_kg, 0),
    sla_status: "On track",
    stage: "Shipment Intake",
    current_stage: "Shipment Intake",
    approval_status: "Pending",
    human_approval_decision: "Awaiting analysis",
    cargo_items: cargoItems,
    weight_distribution: {
      left_kg: toNumber(incoming.weight_distribution?.left_kg ?? incoming.left_kg, 0),
      right_kg: toNumber(incoming.weight_distribution?.right_kg ?? incoming.right_kg, 0),
      front_kg: toNumber(incoming.weight_distribution?.front_kg ?? incoming.front_kg, 0),
      rear_kg: toNumber(incoming.weight_distribution?.rear_kg ?? incoming.rear_kg, 0)
    },
    evidence: {
      image_uploaded: incoming.evidence?.image_uploaded === true || incoming.image_uploaded === true,
      photo_quality: incoming.evidence?.photo_quality || incoming.photo_quality || "operator-entered",
      photo_url: incoming.evidence?.photo_url || incoming.photo_url || null,
      vision_notes:
        incoming.evidence?.vision_notes ||
        incoming.vision_notes ||
        "Live case created from operator-entered cargo data."
    },
    metadata: {
      damaged_cargo_detected: Boolean(
        incoming.metadata?.damaged_cargo_detected || incoming.damaged_cargo_detected
      ),
      damage_notes: incoming.metadata?.damage_notes || incoming.damage_notes || "",
      manual_entry_only: incoming.metadata?.manual_entry_only ?? incoming.manual_entry_only ?? true
    },
    audit_events: []
  };
}

function mergeWithStoredCase(payload) {
  const body = payload.case || payload;
  const existing = body.case_id ? cases.get(body.case_id) : null;

  if (!existing) {
    return clone(body);
  }

  return {
    ...clone(existing),
    ...clone(body),
    cargo_items: body.cargo_items || existing.cargo_items,
    weight_distribution: body.weight_distribution || existing.weight_distribution,
    evidence: { ...(existing.evidence || {}), ...(body.evidence || {}) },
    metadata: { ...(existing.metadata || {}), ...(body.metadata || {}) },
    audit_events: body.audit_events || existing.audit_events
  };
}

function buildCaseResponse(caseRecord) {
  const analysis = analyzeCargo(caseRecord);
  const dispatch = createDispatchInstruction(caseRecord, {
    approval_status: caseRecord.approval_status
  });

  return {
    case_id: caseRecord.case_id,
    shipment_id: caseRecord.shipment_id,
    uipath_case_id: caseRecord.uipath_case_id,
    case_source: caseRecord.case_source || (caseRecord.is_sample === false ? "Live intake" : "Sample data"),
    is_sample: caseRecord.is_sample !== false,
    maestro_case_key: caseRecord.shipment_id || caseRecord.case_id,
    title: caseRecord.title,
    truck_type: caseRecord.truck_type,
    stage: caseRecord.stage || caseRecord.current_stage || analysis.stage,
    current_stage: caseRecord.current_stage || caseRecord.stage || analysis.stage,
    sla_status: caseRecord.sla_status || "On track",
    cargo_count: analysis.cargo_count,
    total_weight_kg: analysis.total_weight_kg,
    truck_capacity_kg: analysis.truck_capacity_kg,
    fragile_items: analysis.fragile_items,
    heavy_items: analysis.heavy_items,
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    confidence_score: analysis.confidence_score,
    detected_issues: analysis.detected_issues,
    recommended_action: analysis.recommended_action,
    requires_human_review: analysis.requires_human_review,
    why_human_approval_required: analysis.why_human_approval_required,
    safer_loading_suggestion: analysis.safer_loading_suggestion,
    approval_status: caseRecord.approval_status || (analysis.requires_human_review ? "Pending supervisor" : "Auto recommended"),
    human_approval_decision:
      caseRecord.human_approval_decision ||
      (analysis.requires_human_review ? "Awaiting decision" : "Not required - low risk"),
    final_dispatch_decision:
      caseRecord.final_dispatch_decision ||
      dispatch.final_decision,
    dispatch_instruction: caseRecord.dispatch_instruction || dispatch.dispatch_instruction,
    ai_analysis_result:
      caseRecord.ai_analysis_result ||
      "Deterministic cargo-risk service analyzed the submitted cargo list and evidence.",
    cargo_items: caseRecord.cargo_items || [],
    evidence: caseRecord.evidence || {},
    metadata: caseRecord.metadata || {},
    weight_distribution: caseRecord.weight_distribution || {},
    audit_events: caseRecord.audit_events || []
  };
}

function getCaseOr404(caseId, res) {
  const caseRecord = cases.get(caseId);
  if (!caseRecord) {
    res.status(404).json({
      error: "case_not_found",
      message: `No Logithon CaseOps case exists for ${caseId}`
    });
    return null;
  }

  return caseRecord;
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Logithon CaseOps API",
    orchestrator: "UiPath Maestro Case",
    timestamp: timestamp()
  });
});

app.get("/api/maestro/case-plan", (_req, res) => {
  res.json({
    case_plan: maestroCasePlan,
    entity_schema: caseEntitySchema,
    task_contracts: taskContracts,
    submission_checklist: submissionChecklist
  });
});

app.get("/api/maestro/entity-schema", (_req, res) => {
  res.json(caseEntitySchema);
});

app.get("/api/maestro/task-contracts", (_req, res) => {
  res.json({ task_contracts: taskContracts });
});

app.get("/api/cases", (_req, res) => {
  res.json({
    cases: [...cases.values()].map(buildCaseResponse)
  });
});

app.get("/api/cases/:case_id", (req, res) => {
  const caseRecord = getCaseOr404(req.params.case_id, res);
  if (!caseRecord) return;
  res.json(buildCaseResponse(caseRecord));
});

app.post("/api/live-cases", (req, res) => {
  try {
    const caseRecord = normalizeLiveCasePayload(req.body);
    addAuditEvent(caseRecord, "Dashboard live intake", "Operator-created cargo loading case");
    cases.set(caseRecord.case_id, caseRecord);
    res.status(201).json(buildCaseResponse(caseRecord));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: "live_case_invalid",
      message: error.message || "Unable to create live case."
    });
  }
});

app.post("/api/analyze-cargo", (req, res) => {
  const payload = mergeWithStoredCase(req.body);
  const analysis = analyzeCargo(payload);

  if (payload.case_id && cases.has(payload.case_id)) {
    const caseRecord = cases.get(payload.case_id);
    caseRecord.stage = "Cargo Vision Review";
    caseRecord.current_stage = "Cargo Vision Review";
    caseRecord.last_analysis = analysis;
    addAuditEvent(caseRecord, "Logithon coded AI service", "Cargo analysis completed");
  }

  res.json({
    ...analysis,
    approval_status: payload.approval_status || (analysis.requires_human_review ? "Pending supervisor" : "Auto recommended"),
    audit_events: payload.audit_events || []
  });
});

app.post("/api/risk-score", (req, res) => {
  const payload = mergeWithStoredCase(req.body);
  const analysis = analyzeCargo(payload);

  if (payload.case_id && cases.has(payload.case_id)) {
    const caseRecord = cases.get(payload.case_id);
    caseRecord.stage = "Load Risk Analysis";
    caseRecord.current_stage = "Load Risk Analysis";
    caseRecord.last_analysis = analysis;
    addAuditEvent(caseRecord, "Logithon risk engine", `Risk score calculated: ${analysis.risk_score} (${analysis.risk_level})`);
  }

  res.json({
    case_id: analysis.case_id,
    shipment_id: analysis.shipment_id,
    stage: "Load Risk Analysis",
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    detected_issues: analysis.detected_issues,
    confidence_score: analysis.confidence_score,
    recommended_action: analysis.recommended_action,
    requires_human_review: analysis.requires_human_review,
    why_human_approval_required: analysis.why_human_approval_required,
    safer_loading_suggestion: analysis.safer_loading_suggestion
  });
});

app.post("/api/human-decision", (req, res) => {
  const {
    case_id: caseId,
    decision = "Approved with conditions",
    supervisor = "Action Center Supervisor",
    notes = "Supervisor approved safer loading plan.",
    safer_loading_plan = []
  } = req.body;
  const caseRecord = getCaseOr404(caseId, res);
  if (!caseRecord) return;

  const normalizedDecision = String(decision).toLowerCase();
  let approvalStatus = "Approved with conditions";
  if (normalizedDecision === "approved") approvalStatus = "Approved";
  if (normalizedDecision === "rejected" || normalizedDecision === "blocked") approvalStatus = "Rejected";

  caseRecord.approval_status = approvalStatus;
  caseRecord.human_approval_decision = notes;
  caseRecord.stage = "Dispatch Instruction";
  caseRecord.current_stage = "Dispatch Instruction";
  caseRecord.safer_loading_plan = safer_loading_plan;
  addAuditEvent(caseRecord, supervisor, `${approvalStatus}: ${notes}`);

  res.json({
    case_id: caseRecord.case_id,
    shipment_id: caseRecord.shipment_id,
    stage: caseRecord.stage,
    approval_status: approvalStatus,
    human_approval_decision: notes,
    safer_loading_plan,
    audit_events: caseRecord.audit_events
  });
});

app.post("/api/dispatch-instructions", (req, res) => {
  const caseRecord = getCaseOr404(req.body.case_id, res);
  if (!caseRecord) return;

  const instruction = createDispatchInstruction(caseRecord, {
    approval_status: req.body.approval_status || caseRecord.approval_status
  });

  caseRecord.dispatch_instruction = instruction.dispatch_instruction;
  caseRecord.final_dispatch_decision = instruction.final_decision;
  caseRecord.stage = instruction.close_case ? "Closed" : "Dispatch Instruction";
  caseRecord.current_stage = caseRecord.stage;
  addAuditEvent(caseRecord, "Dispatch workflow", instruction.final_decision);

  res.json({
    ...instruction,
    stage: caseRecord.stage,
    audit_events: caseRecord.audit_events
  });
});

app.post("/api/uipath/case-created", (req, res) => {
  const incoming = req.body.case || req.body;
  const caseId = incoming.case_id || `LCOPS-${Date.now().toString().slice(-6)}`;
  const caseRecord = cases.get(caseId) || {
    case_id: caseId,
    shipment_id: incoming.shipment_id || `SHP-${Date.now().toString().slice(-5)}`,
    title: incoming.title || "New cargo loading request",
    truck_type: incoming.truck_type || "Unassigned truck",
    truck_capacity_kg: incoming.truck_capacity_kg || 0,
    cargo_items: incoming.cargo_items || [],
    weight_distribution: incoming.weight_distribution || {},
    evidence: incoming.evidence || {},
    metadata: incoming.metadata || {},
    audit_events: []
  };

  Object.assign(caseRecord, incoming, {
    case_id: caseId,
    stage: "Shipment Intake",
    current_stage: "Shipment Intake",
    approval_status: incoming.approval_status || caseRecord.approval_status || "Pending"
  });

  addAuditEvent(caseRecord, "UiPath Maestro Case", "Case created from warehouse loading request");
  cases.set(caseId, caseRecord);

  res.status(201).json(buildCaseResponse(caseRecord));
});

app.post("/api/uipath/stage-update", (req, res) => {
  const { case_id: caseId, stage, status, uipath_case_id } = req.body;
  const caseRecord = getCaseOr404(caseId, res);
  if (!caseRecord) return;

  caseRecord.stage = stage || caseRecord.stage;
  caseRecord.current_stage = stage || caseRecord.current_stage;
  caseRecord.uipath_case_id = uipath_case_id || caseRecord.uipath_case_id;
  if (status) {
    caseRecord.status = status;
  }

  addAuditEvent(caseRecord, "UiPath Maestro Case", `Stage updated to ${caseRecord.stage}`);

  res.json(buildCaseResponse(caseRecord));
});

const distPath = path.resolve(__dirname, "../dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Logithon CaseOps API listening on http://localhost:${port}`);
});
