export const caseEntitySchema = {
  entityName: "CargoLoadSafetyCase",
  keyStrategy: {
    type: "external",
    externalKeyField: "shipment_id",
    fallbackSystemPrefix: "LCOPS"
  },
  inputFields: {
    shipment_id: { type: "string", required: true, readOnly: true },
    warehouse_id: { type: "string", required: false, readOnly: true },
    dock_id: { type: "string", required: false, readOnly: true },
    truck_type: { type: "string", required: true, readOnly: true },
    truck_capacity_kg: { type: "number", required: true, readOnly: true },
    cargo_items: { type: "array", required: true, readOnly: true },
    weight_distribution: { type: "object", required: false, readOnly: true },
    evidence: { type: "object", required: false, readOnly: true },
    metadata: { type: "object", required: false, readOnly: true }
  },
  computedFields: {
    "cargoVision.status": { type: "string", writtenBy: "Cargo Vision Review" },
    "cargoVision.confidence": { type: "number", writtenBy: "Cargo Vision Review" },
    "risk.score": { type: "number", writtenBy: "Load Risk Analysis" },
    "risk.level": { type: "string", writtenBy: "Load Risk Analysis" },
    "risk.detectedIssues": { type: "array", writtenBy: "Load Risk Analysis" },
    "risk.requiresHumanReview": { type: "boolean", writtenBy: "Load Risk Analysis" },
    "approval.status": { type: "string", writtenBy: "Human Supervisor Approval" },
    "approval.notes": { type: "string", writtenBy: "Human Supervisor Approval" },
    "dispatch.finalDecision": { type: "string", writtenBy: "Dispatch Instruction" },
    "dispatch.loadingControls": { type: "array", writtenBy: "Dispatch Instruction" }
  }
};

export const taskContracts = [
  {
    stage: "Shipment Intake",
    task: "Register loading request",
    type: "API Workflow",
    mode: "sequential",
    runOnlyOnce: true,
    input: {
      shipment_id: "caseEntity.shipment_id",
      truck_type: "caseEntity.truck_type",
      cargo_items: "caseEntity.cargo_items"
    },
    output: {
      "caseEntity.intake.status": "taskOutput.status"
    }
  },
  {
    stage: "Cargo Vision Review",
    task: "Cargo Vision Review",
    type: "External Agent",
    mode: "sequential",
    runOnlyOnce: false,
    input: {
      evidence: "caseEntity.evidence",
      cargo_items: "caseEntity.cargo_items",
      metadata: "caseEntity.metadata"
    },
    output: {
      "caseEntity.cargoVision.status": "taskOutput.status",
      "caseEntity.cargoVision.confidence": "taskOutput.confidence"
    }
  },
  {
    stage: "Load Risk Analysis",
    task: "Load Risk Analysis",
    type: "API Workflow",
    mode: "sequential",
    runOnlyOnce: false,
    input: {
      cargo_items: "caseEntity.cargo_items",
      truck_capacity_kg: "caseEntity.truck_capacity_kg",
      weight_distribution: "caseEntity.weight_distribution",
      evidence: "caseEntity.evidence",
      metadata: "caseEntity.metadata"
    },
    output: {
      "caseEntity.risk.score": "taskOutput.risk_score",
      "caseEntity.risk.level": "taskOutput.risk_level",
      "caseEntity.risk.detectedIssues": "taskOutput.detected_issues",
      "caseEntity.risk.requiresHumanReview": "taskOutput.requires_human_review"
    }
  },
  {
    stage: "Human Supervisor Approval",
    task: "Approve safer loading plan",
    type: "Human action",
    mode: "event-driven",
    runOnlyOnce: false,
    input: {
      risk_score: "caseEntity.risk.score",
      detected_issues: "caseEntity.risk.detectedIssues",
      safer_loading_suggestion: "caseEntity.risk.saferLoadingSuggestion"
    },
    output: {
      "caseEntity.approval.status": "taskOutput.approvalStatus",
      "caseEntity.approval.notes": "taskOutput.notes"
    }
  },
  {
    stage: "Dispatch Instruction",
    task: "Generate dispatch instruction",
    type: "API Workflow",
    mode: "sequential",
    runOnlyOnce: false,
    input: {
      risk_level: "caseEntity.risk.level",
      approval_status: "caseEntity.approval.status",
      cargo_items: "caseEntity.cargo_items"
    },
    output: {
      "caseEntity.dispatch.finalDecision": "taskOutput.final_decision",
      "caseEntity.dispatch.loadingControls": "taskOutput.loading_controls"
    }
  }
];

export const maestroCasePlan = {
  name: "LogithonCargoSafety",
  track: "UiPath Maestro Case",
  problem: "Cargo loading exceptions are dynamic, safety-critical, and require governed human approval before dispatch.",
  caseKey: caseEntitySchema.keyStrategy,
  triggerSources: [
    {
      source: "Data Fabric row created",
      entity: "CargoLoadSafetyCase",
      use: "Production path for warehouse or TMS-created loading requests."
    },
    {
      source: "Wait for connector or API trigger",
      endpoint: "POST /api/uipath/case-created",
      use: "Hackathon demo path and integration test path."
    },
    {
      source: "Dashboard live intake",
      endpoint: "POST /api/live-cases",
      use: "Creates non-sample cases from operator-entered cargo data."
    }
  ],
  dataObjects: [
    "Case Entity: CargoLoadSafetyCase",
    "Case Documents: dock photos, axle tickets, hazmat forms",
    "Case Comments: supervisor notes and rework rationale"
  ],
  personas: [
    {
      name: "Warehouse Intake",
      viewStages: ["Shipment Intake", "Cargo Vision Review", "Evidence Rework"],
      actStages: ["Shipment Intake", "Evidence Rework"]
    },
    {
      name: "Cargo Safety Supervisor",
      viewStages: ["Load Risk Analysis", "Human Supervisor Approval", "Dispatch Blocked"],
      actStages: ["Human Supervisor Approval", "Dispatch Blocked"]
    },
    {
      name: "Dispatch Coordinator",
      viewStages: ["Dispatch Instruction", "Closed"],
      actStages: ["Dispatch Instruction"]
    },
    {
      name: "Case Operator",
      viewStages: ["Shipment Intake", "Cargo Vision Review", "Load Risk Analysis", "Human Supervisor Approval", "Dispatch Instruction", "Closed"],
      actStages: ["Pause", "Resume", "Retry", "Migrate", "Cancel"]
    }
  ],
  stages: [
    {
      name: "Shipment Intake",
      kind: "primary",
      required: true,
      sla: "4 business hours",
      entryRule: { when: "CaseCreated" },
      completeRule: {
        when: "TaskCompleted:Register loading request",
        if: "caseEntity.shipment_id != null && caseEntity.cargo_items.length > 0",
        action: "Start Cargo Vision Review"
      }
    },
    {
      name: "Cargo Vision Review",
      kind: "primary",
      required: true,
      sla: "2 business hours",
      entryRule: { when: "StageCompleted:Shipment Intake" },
      completeRule: {
        when: "TaskCompleted:Cargo Vision Review",
        if: "caseEntity.cargoVision.status != null",
        action: "Start Load Risk Analysis"
      },
      reEntryRule: {
        when: "TaskCompleted:Evidence Rework",
        if: "caseEntity.evidence.image_uploaded == true"
      }
    },
    {
      name: "Load Risk Analysis",
      kind: "primary",
      required: true,
      sla: "1 business hour",
      entryRule: { when: "StageCompleted:Cargo Vision Review" },
      completeRule: {
        when: "TaskCompleted:Load Risk Analysis",
        if: "caseEntity.risk.requiresHumanReview == false",
        action: "Start Dispatch Instruction"
      },
      exitRule: {
        when: "TaskCompleted:Load Risk Analysis",
        if: "caseEntity.risk.requiresHumanReview == true",
        action: "Start Human Supervisor Approval"
      }
    },
    {
      name: "Human Supervisor Approval",
      kind: "primary",
      required: false,
      sla: "8 business hours",
      entryRule: {
        when: "caseEntity.risk.requiresHumanReview changes",
        if: "caseEntity.risk.requiresHumanReview == true",
        interrupting: false
      },
      completeRule: {
        when: "TaskCompleted:Approve safer loading plan",
        if: "caseEntity.approval.status in ['Approved', 'Approved with conditions']",
        action: "Start Dispatch Instruction"
      },
      exitRule: {
        when: "TaskCompleted:Approve safer loading plan",
        if: "caseEntity.approval.status in ['Rejected', 'Blocked']",
        action: "Start Dispatch Blocked"
      }
    },
    {
      name: "Dispatch Instruction",
      kind: "primary",
      required: true,
      sla: "2 business hours",
      entryRule: {
        when: "StageCompleted:Load Risk Analysis or StageCompleted:Human Supervisor Approval"
      },
      completeRule: {
        when: "TaskCompleted:Generate dispatch instruction",
        if: "caseEntity.dispatch.finalDecision != null",
        action: "Complete case"
      }
    },
    {
      name: "Evidence Rework",
      kind: "secondary",
      required: false,
      sla: "4 business hours",
      entryRule: {
        when: "caseEntity.risk.detectedIssues changes",
        if: "caseEntity.risk.detectedIssues contains 'missing_evidence'",
        interrupting: false
      },
      completeRule: {
        when: "TaskCompleted:Capture dock evidence",
        action: "Return-to-origin"
      }
    },
    {
      name: "Dispatch Blocked",
      kind: "secondary",
      required: false,
      sla: "immediate",
      entryRule: {
        when: "caseEntity.approval.status changes",
        if: "caseEntity.approval.status in ['Rejected', 'Blocked']",
        interrupting: true
      },
      completeRule: {
        when: "StageEntered:Dispatch Blocked",
        action: "Exit case"
      }
    },
    {
      name: "Closed",
      kind: "primary",
      required: true,
      sla: "terminal",
      entryRule: {
        when: "CaseComplete"
      }
    }
  ],
  slas: {
    caseLevel: "24 business hours",
    atRiskThreshold: "80%",
    escalationActions: [
      "Notify Cargo Safety Supervisor when a stage is at risk.",
      "Flag the case and notify operations management when the case SLA breaches.",
      "Pause SLA while waiting on external dock evidence and resume when evidence arrives."
    ]
  },
  platformComponents: [
    "UiPath Maestro Case",
    "Studio Web Case Plan Designer",
    "Case App",
    "Case Instance Management",
    "Action apps or human action tasks",
    "API Workflows",
    "Data Fabric or VDO trigger",
    "Integration Service connector trigger",
    "Codex-built external cargo-risk service"
  ],
  docsBasis: [
    "https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/maestro-integration-with-the-uipath-ecosystem",
    "https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/introduction-to-maestro-case",
    "https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/maestro-case-lifecycle-from-event-trigger-to-app-experience",
    "https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/how-to-establish-task-io-and-write-back-contracts"
  ],
  hackathonAlignment: {
    track: "Track 1: UiPath Maestro Case",
    whyCaseNotBpmn: "The loading path is exception-heavy: missing evidence, imbalance, hazmat, damaged freight, and supervisor decisions can reopen or reroute the case.",
    judgingHooks: [
      "Business impact: prevents unsafe cargo dispatch and creates auditable supervisor governance.",
      "Platform usage: Maestro Case is the orchestration layer; external coded service is a task worker.",
      "Technical execution: deterministic rules, live intake, API contracts, rework, SLA and human approval paths.",
      "Presentation: 5-minute demo can show a live-created case rather than only canned data.",
      "Coding agent bonus: Codex-built risk service and project artifacts are documented."
    ]
  }
};

export const submissionChecklist = [
  "Public GitHub repository with MIT license.",
  "README with UiPath components, setup, prerequisites, and coding-agent disclosure.",
  "Demo video under 5 minutes showing the solution running, the architecture, agents, orchestration, and human approval.",
  "UiPath Automation Cloud implementation using Maestro Case as the orchestration and governance layer.",
  "Presentation deck with problem, solution, architecture, demo flow, impact, and next steps."
];
