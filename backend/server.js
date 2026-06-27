import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sampleCases } from "./data/cases.js";
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
