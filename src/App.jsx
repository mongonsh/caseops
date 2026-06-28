import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  Gauge,
  GitBranch,
  KeyRound,
  Layers,
  Package,
  Play,
  PlusCircle,
  Route,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserCheck,
  Workflow
} from "lucide-react";

const demoSteps = [
  {
    label: "New shipment case received",
    endpoint: "/api/uipath/case-created",
    body: { case_id: "LCOPS-1002" }
  },
  {
    label: "UiPath Maestro case created",
    endpoint: "/api/uipath/stage-update",
    body: { case_id: "LCOPS-1002", stage: "Shipment Intake" }
  },
  {
    label: "Cargo analysis started",
    endpoint: "/api/analyze-cargo",
    body: { case_id: "LCOPS-1002" }
  },
  {
    label: "Load risk detected",
    endpoint: "/api/risk-score",
    body: { case_id: "LCOPS-1002" }
  },
  {
    label: "Human approval required",
    endpoint: "/api/uipath/stage-update",
    body: { case_id: "LCOPS-1002", stage: "Human Supervisor Approval" }
  },
  {
    label: "Supervisor approves safer loading plan",
    endpoint: "/api/human-decision",
    body: {
      case_id: "LCOPS-1002",
      decision: "approved_with_conditions",
      supervisor: "Action Center Supervisor",
      notes: "Approved after rebalancing dense pallets toward the center line.",
      safer_loading_plan: [
        "Move two pump pallets from left wall to center bay.",
        "Capture dock photo and axle-weight confirmation before seal."
      ]
    }
  },
  {
    label: "Dispatch instruction generated",
    endpoint: "/api/dispatch-instructions",
    body: { case_id: "LCOPS-1002" }
  },
  {
    label: "Case closed with audit trail",
    endpoint: "/api/uipath/stage-update",
    body: { case_id: "LCOPS-1002", stage: "Closed", status: "Complete" }
  }
];

const fallbackStages = [
  "Shipment Intake",
  "Cargo Vision Review",
  "Load Risk Analysis",
  "Human Supervisor Approval",
  "Dispatch Instruction",
  "Closed"
];

const apiContract = [
  ["Live case intake", "POST /api/live-cases"],
  ["Case created", "POST /api/uipath/case-created"],
  ["AI review", "POST /api/analyze-cargo"],
  ["Risk scoring", "POST /api/risk-score"],
  ["Approval", "POST /api/human-decision"],
  ["Dispatch", "POST /api/dispatch-instructions"],
  ["Case plan", "GET /api/maestro/case-plan"]
];

const bonusItems = [
  "UiPath-ready case plan artifact",
  "Explicit case entity schema",
  "Task I/O write-back contracts",
  "Live operator-created cases",
  "Human approval and rework path",
  "Codex-built risk service"
];

function buildLiveForm() {
  const suffix = Date.now().toString().slice(-5);
  return {
    shipment_id: `SHP-LIVE-${suffix}`,
    title: "Live dock safety check",
    truck_type: "53 ft dry van",
    truck_capacity_kg: "18000",
    evidence_state: "attached",
    damaged_cargo_detected: false,
    manual_entry_only: true,
    left_kg: "9800",
    right_kg: "5200",
    front_kg: "8400",
    rear_kg: "6600",
    cargo_text:
      "Industrial pump pallet,4,1750,heavy,floor,left-wall\nMotor crate,2,1450,heavy,floor,left-wall\nElectronics carton,14,52,fragile,top,center"
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatKg(value) {
  return `${Number(value || 0).toLocaleString()} kg`;
}

function levelClass(level) {
  return String(level || "Low").toLowerCase();
}

function parseCargoLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, quantity, unitWeight, rawFlags = "", stackPosition = "floor", stackGroup = "main"] =
        line.split(",").map((part) => part.trim());
      const flags = new Set(
        rawFlags
          .toLowerCase()
          .split(/[| ]/)
          .map((flag) => flag.trim())
          .filter(Boolean)
      );

      return {
        sku: `LIVE-${String(index + 1).padStart(3, "0")}`,
        name: name || `Cargo item ${index + 1}`,
        quantity: Number(quantity) || 1,
        unit_weight_kg: Number(unitWeight) || 0,
        fragile: flags.has("fragile"),
        heavy: flags.has("heavy"),
        hazardous: flags.has("hazmat") || flags.has("hazardous"),
        damaged: flags.has("damaged"),
        temperature_sensitive: flags.has("temp") || flags.has("temperature"),
        stack_position: stackPosition || "floor",
        stack_group: stackGroup || "main"
      };
    })
    .filter((item) => item.unit_weight_kg > 0);
}

function App() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [demoStep, setDemoStep] = useState(-1);
  const [demoLog, setDemoLog] = useState([]);
  const [demoRunning, setDemoRunning] = useState(false);
  const [maestroPlan, setMaestroPlan] = useState(null);
  const [liveForm, setLiveForm] = useState(buildLiveForm);
  const [liveCaseStatus, setLiveCaseStatus] = useState("");

  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.case_id === selectedCaseId) || cases[0],
    [cases, selectedCaseId]
  );

  const stageNames = useMemo(
    () => maestroPlan?.case_plan?.stages?.map((stage) => stage.name) || fallbackStages,
    [maestroPlan]
  );

  const planStats = useMemo(() => {
    const stages = maestroPlan?.case_plan?.stages || [];
    const taskContracts = maestroPlan?.task_contracts || [];
    return {
      stages: stages.length || fallbackStages.length,
      tasks: taskContracts.length,
      personas: maestroPlan?.case_plan?.personas?.length || 0,
      triggers: maestroPlan?.case_plan?.triggerSources?.length || 0
    };
  }, [maestroPlan]);

  const summary = useMemo(() => {
    const highRisk = cases.filter((caseRecord) => caseRecord.risk_level === "High").length;
    const humanQueue = cases.filter((caseRecord) => caseRecord.requires_human_review).length;
    const totalWeight = cases.reduce((sum, caseRecord) => sum + caseRecord.total_weight_kg, 0);
    const liveCases = cases.filter((caseRecord) => !caseRecord.is_sample).length;

    return {
      activeCases: cases.length,
      highRisk,
      humanQueue,
      totalWeight,
      liveCases
    };
  }, [cases]);

  async function loadCases(nextSelectedCaseId) {
    const response = await fetch("/api/cases");
    const payload = await response.json();
    setCases(payload.cases);
    setSelectedCaseId(
      (current) => nextSelectedCaseId || current || payload.cases[1]?.case_id || payload.cases[0]?.case_id
    );
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const health = await fetch("/health");
        if (!health.ok) throw new Error("health check failed");
        if (mounted) setApiStatus("online");
        await loadCases();
        const planResponse = await fetch("/api/maestro/case-plan");
        if (planResponse.ok && mounted) {
          setMaestroPlan(await planResponse.json());
        }
      } catch (error) {
        if (mounted) setApiStatus("offline");
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  function updateLiveForm(field, value) {
    setLiveForm((current) => ({ ...current, [field]: value }));
  }

  async function createLiveCase(event) {
    event.preventDefault();
    const cargoItems = parseCargoLines(liveForm.cargo_text);

    if (cargoItems.length === 0) {
      setLiveCaseStatus("Add at least one cargo line with a positive weight.");
      return;
    }

    setLiveCaseStatus("Creating live case...");
    const payload = {
      shipment_id: liveForm.shipment_id,
      title: liveForm.title,
      truck_type: liveForm.truck_type,
      truck_capacity_kg: Number(liveForm.truck_capacity_kg),
      cargo_items: cargoItems,
      weight_distribution: {
        left_kg: Number(liveForm.left_kg),
        right_kg: Number(liveForm.right_kg),
        front_kg: Number(liveForm.front_kg),
        rear_kg: Number(liveForm.rear_kg)
      },
      evidence: {
        image_uploaded: liveForm.evidence_state === "attached",
        photo_quality: liveForm.evidence_state === "attached" ? "operator-attested" : "missing",
        vision_notes: "Created through the live intake panel."
      },
      metadata: {
        damaged_cargo_detected: liveForm.damaged_cargo_detected,
        manual_entry_only: liveForm.manual_entry_only
      }
    };

    try {
      const response = await fetch("/api/live-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const created = await response.json();
      if (!response.ok) throw new Error(created.message || "Live case creation failed.");

      await loadCases(created.case_id);
      setLiveCaseStatus(`Created ${created.case_id}: ${created.risk_level} risk, score ${created.risk_score}.`);
      setLiveForm((current) => ({
        ...current,
        shipment_id: `SHP-LIVE-${Date.now().toString().slice(-5)}`
      }));
    } catch (error) {
      setLiveCaseStatus(error.message);
    }
  }

  async function runDemoScenario() {
    setSelectedCaseId("LCOPS-1002");
    setDemoRunning(true);
    setDemoStep(-1);
    setDemoLog([]);

    for (let index = 0; index < demoSteps.length; index += 1) {
      const step = demoSteps[index];
      setDemoStep(index);
      setDemoLog((current) => [
        {
          label: step.label,
          status: "Running",
          time: new Date().toLocaleTimeString()
        },
        ...current
      ]);

      try {
        await fetch(step.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(step.body)
        });
        setDemoLog((current) =>
          current.map((entry, entryIndex) =>
            entryIndex === 0 ? { ...entry, status: "Done" } : entry
          )
        );
        await loadCases("LCOPS-1002");
      } catch (error) {
        setDemoLog((current) =>
          current.map((entry, entryIndex) =>
            entryIndex === 0 ? { ...entry, status: "API error" } : entry
          )
        );
      }

      await sleep(850);
    }

    setDemoRunning(false);
  }

  if (!selectedCase) {
    return (
      <main className="app-shell">
        <section className="empty-state">
          <Activity />
          <h1>Logithon CaseOps</h1>
          <p>Starting cargo safety command center...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="eyebrow">Track 1: UiPath Maestro Case</p>
            <h1>Logithon CaseOps</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`api-pill ${apiStatus}`}>
            <Activity size={16} />
            API {apiStatus}
          </span>
          <button className="primary-button" onClick={runDemoScenario} disabled={demoRunning}>
            <Play size={17} />
            {demoRunning ? "Running demo" : "Run Demo Scenario"}
          </button>
        </div>
      </header>

      <section className="mission-hero" aria-label="Mission dashboard">
        <div className="mission-copy">
          <p className="section-kicker">Maestro-governed cargo exceptions</p>
          <h2>Case management for unsafe or uncertain cargo loading decisions.</h2>
          <p>
            UiPath Maestro Case owns the lifecycle, stage rules, human approval, SLA visibility,
            and audit trail. The Codex-built cargo-risk service acts as an external task worker.
          </p>
          <div className="mission-stats">
            <Metric label="Active cases" value={summary.activeCases} icon={<Workflow />} />
            <Metric label="Live cases" value={summary.liveCases} icon={<Database />} />
            <Metric label="High risk" value={summary.highRisk} icon={<AlertTriangle />} />
            <Metric label="Human queue" value={summary.humanQueue} icon={<UserCheck />} />
          </div>
        </div>
        <CargoCommandVisual caseRecord={selectedCase} activeStep={demoStep} />
      </section>

      <section className="case-strip" aria-label="Cargo cases">
        {cases.map((caseRecord) => (
          <button
            className={`case-tile ${caseRecord.case_id === selectedCase.case_id ? "selected" : ""}`}
            key={caseRecord.case_id}
            onClick={() => setSelectedCaseId(caseRecord.case_id)}
          >
            <span className={`risk-dot ${levelClass(caseRecord.risk_level)}`} />
            <span>
              <strong>{caseRecord.case_id}</strong>
              <small>{caseRecord.title}</small>
            </span>
            <span className={`source-chip ${caseRecord.is_sample ? "sample" : "live"}`}>
              {caseRecord.is_sample ? "Sample" : "Live"}
            </span>
            <span className={`risk-badge ${levelClass(caseRecord.risk_level)}`}>
              {caseRecord.risk_level}
            </span>
          </button>
        ))}
      </section>

      <section className="operator-band">
        <Panel title="Live cargo intake" icon={<PlusCircle />}>
          <form className="live-form" onSubmit={createLiveCase}>
            <div className="form-grid">
              <label>
                <span>Shipment ID</span>
                <input
                  value={liveForm.shipment_id}
                  onChange={(event) => updateLiveForm("shipment_id", event.target.value)}
                />
              </label>
              <label>
                <span>Case title</span>
                <input
                  value={liveForm.title}
                  onChange={(event) => updateLiveForm("title", event.target.value)}
                />
              </label>
              <label>
                <span>Truck type</span>
                <input
                  value={liveForm.truck_type}
                  onChange={(event) => updateLiveForm("truck_type", event.target.value)}
                />
              </label>
              <label>
                <span>Capacity kg</span>
                <input
                  type="number"
                  value={liveForm.truck_capacity_kg}
                  onChange={(event) => updateLiveForm("truck_capacity_kg", event.target.value)}
                />
              </label>
            </div>
            <label className="wide-label">
              <span>Cargo manifest</span>
              <textarea
                value={liveForm.cargo_text}
                onChange={(event) => updateLiveForm("cargo_text", event.target.value)}
                rows={4}
              />
            </label>
            <div className="form-grid compact">
              <label>
                <span>Left kg</span>
                <input
                  type="number"
                  value={liveForm.left_kg}
                  onChange={(event) => updateLiveForm("left_kg", event.target.value)}
                />
              </label>
              <label>
                <span>Right kg</span>
                <input
                  type="number"
                  value={liveForm.right_kg}
                  onChange={(event) => updateLiveForm("right_kg", event.target.value)}
                />
              </label>
              <label>
                <span>Front kg</span>
                <input
                  type="number"
                  value={liveForm.front_kg}
                  onChange={(event) => updateLiveForm("front_kg", event.target.value)}
                />
              </label>
              <label>
                <span>Rear kg</span>
                <input
                  type="number"
                  value={liveForm.rear_kg}
                  onChange={(event) => updateLiveForm("rear_kg", event.target.value)}
                />
              </label>
            </div>
            <div className="toggle-row">
              <label>
                <UploadCloud size={16} />
                <select
                  value={liveForm.evidence_state}
                  onChange={(event) => updateLiveForm("evidence_state", event.target.value)}
                >
                  <option value="attached">Evidence attached</option>
                  <option value="missing">Evidence missing</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={liveForm.damaged_cargo_detected}
                  onChange={(event) => updateLiveForm("damaged_cargo_detected", event.target.checked)}
                />
                Damaged cargo
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={liveForm.manual_entry_only}
                  onChange={(event) => updateLiveForm("manual_entry_only", event.target.checked)}
                />
                Manual entry
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button form-button" type="submit">
                <PlusCircle size={17} />
                Create Live Case
              </button>
              {liveCaseStatus && <span>{liveCaseStatus}</span>}
            </div>
          </form>
        </Panel>

        <Panel title="Maestro case plan" icon={<Layers />}>
          <div className="plan-grid">
            <Metric label="Stages" value={planStats.stages} icon={<GitBranch />} />
            <Metric label="Task contracts" value={planStats.tasks} icon={<ClipboardCheck />} />
            <Metric label="Personas" value={planStats.personas} icon={<UserCheck />} />
            <Metric label="Triggers" value={planStats.triggers} icon={<KeyRound />} />
          </div>
          <div className="plan-list">
            {(maestroPlan?.case_plan?.triggerSources || []).map((trigger) => (
              <div key={trigger.source}>
                <strong>{trigger.source}</strong>
                <span>{trigger.endpoint || trigger.entity}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="dashboard-grid">
        <Panel title="Cargo intake" icon={<Package />}>
          <div className="case-head">
            <div>
              <p className="muted-label">Case ID</p>
              <h3>{selectedCase.case_id}</h3>
            </div>
            <span className={`status-chip ${levelClass(selectedCase.risk_level)}`}>
              {selectedCase.risk_level} risk
            </span>
          </div>
          <InfoGrid
            items={[
              ["Shipment ID", selectedCase.shipment_id],
              ["Maestro key", selectedCase.maestro_case_key],
              ["Source", selectedCase.case_source],
              ["Truck/container type", selectedCase.truck_type],
              ["Cargo count", selectedCase.cargo_count],
              ["Total weight", formatKg(selectedCase.total_weight_kg)],
              ["Truck capacity", formatKg(selectedCase.truck_capacity_kg)],
              ["SLA status", selectedCase.sla_status]
            ]}
          />
          <div className="cargo-list">
            {(selectedCase.cargo_items || []).map((item) => (
              <div className="cargo-row" key={item.sku}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.sku}</small>
                </span>
                <span>{item.quantity} units</span>
                <span>{formatKg((item.unit_weight_kg || item.weight_kg || 0) * (item.quantity || 1))}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="AI cargo vision review" icon={<Gauge />}>
          <div className="vision-block">
            <div className={`vision-frame ${selectedCase.evidence?.image_uploaded ? "ready" : "missing"}`}>
              <Boxes size={38} />
              <span>{selectedCase.evidence?.image_uploaded ? "Evidence attached" : "Evidence missing"}</span>
            </div>
            <p>{selectedCase.ai_analysis_result}</p>
          </div>
          <InfoGrid
            items={[
              ["Confidence score", `${Math.round(selectedCase.confidence_score * 100)}%`],
              ["Image quality", selectedCase.evidence?.photo_quality || "unknown"],
              ["Current stage", selectedCase.current_stage],
              ["Human review", selectedCase.requires_human_review ? "Required" : "Not required"]
            ]}
          />
        </Panel>

        <Panel title="Load risk analysis" icon={<AlertTriangle />}>
          <div className="risk-score-block">
            <div>
              <p className="muted-label">Risk score</p>
              <strong>{selectedCase.risk_score}</strong>
            </div>
            <div className="risk-meter" aria-label={`Risk score ${selectedCase.risk_score}`}>
              <span style={{ width: `${selectedCase.risk_score}%` }} />
            </div>
          </div>
          <IssueList issues={selectedCase.detected_issues || []} />
          <div className="recommendation">
            <ClipboardCheck size={18} />
            <span>{selectedCase.recommended_action}</span>
          </div>
        </Panel>

        <Panel title="Human approval queue" icon={<UserCheck />}>
          <InfoGrid
            items={[
              ["Approval status", selectedCase.approval_status],
              ["Human decision", selectedCase.human_approval_decision],
              ["Final dispatch decision", selectedCase.final_dispatch_decision],
              ["Requires review", selectedCase.requires_human_review ? "Yes" : "No"]
            ]}
          />
          <div className="approval-lane">
            {(selectedCase.why_human_approval_required || []).length > 0 ? (
              selectedCase.why_human_approval_required.map((reason) => (
                <span key={reason}>{reason}</span>
              ))
            ) : (
              <span>Low-risk case can proceed under standard checks</span>
            )}
          </div>
        </Panel>

        <Panel title="Dispatch instruction" icon={<Route />}>
          <p className="instruction">{selectedCase.dispatch_instruction}</p>
          <div className="suggestion-list">
            {(selectedCase.safer_loading_suggestion || []).map((suggestion) => (
              <div key={suggestion}>
                <CheckCircle2 size={16} />
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="UiPath Maestro integration" icon={<GitBranch />}>
          <div className="stage-rail">
            {stageNames.map((stage) => (
              <div
                className={`stage-node ${stage === selectedCase.current_stage ? "active" : ""}`}
                key={stage}
              >
                <span />
                {stage}
              </div>
            ))}
          </div>
          <div className="contract-list">
            {apiContract.map(([label, endpoint]) => (
              <div key={endpoint}>
                <span>{label}</span>
                <code>{endpoint}</code>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="lower-grid">
        <Panel title="Audit timeline" icon={<Clock />}>
          <div className="timeline">
            {(selectedCase.audit_events || []).map((event, index) => (
              <div className="timeline-item" key={`${event.timestamp}-${index}`}>
                <span className="timeline-pin" />
                <div>
                  <strong>{event.event}</strong>
                  <p>{event.actor}</p>
                  <small>{event.timestamp}</small>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Demo mode" icon={<Play />}>
          <div className="demo-steps">
            {demoSteps.map((step, index) => (
              <div className={`demo-step ${index === demoStep ? "active" : ""}`} key={step.label}>
                <span>{index + 1}</span>
                <p>{step.label}</p>
              </div>
            ))}
          </div>
          {demoLog.length > 0 && (
            <div className="demo-log">
              {demoLog.slice(0, 4).map((entry) => (
                <div key={`${entry.label}-${entry.time}`}>
                  <span>{entry.time}</span>
                  <strong>{entry.label}</strong>
                  <em>{entry.status}</em>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Coding Agent Bonus" icon={<FileText />}>
          <div className="bonus-grid">
            {bonusItems.map((item) => (
              <div key={item}>
                <CheckCircle2 size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="bonus-copy">
            Codex built the coded cargo-risk service and submission artifacts. UiPath Maestro Case
            remains the orchestration and governance layer.
          </p>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoGrid({ items }) {
  return (
    <div className="info-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function IssueList({ issues }) {
  if (!issues.length) {
    return (
      <div className="clear-state">
        <CheckCircle2 size={18} />
        <span>No blocking risks detected.</span>
      </div>
    );
  }

  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <div className={`issue-card ${levelClass(issue.severity)}`} key={issue.id}>
          <div>
            <strong>{issue.title}</strong>
            <p>{issue.evidence}</p>
          </div>
          <span>{issue.severity}</span>
        </div>
      ))}
    </div>
  );
}

function CargoCommandVisual({ caseRecord, activeStep }) {
  const cargoBlocks = [
    { label: "P1", className: "heavy" },
    { label: "P2", className: "heavy" },
    { label: "B1", className: "normal" },
    { label: "B2", className: "normal" },
    { label: "F1", className: caseRecord.fragile_items > 0 ? "fragile" : "normal" },
    { label: "AI", className: levelClass(caseRecord.risk_level) }
  ];

  return (
    <div className="command-visual" aria-label="Cargo loading command visual">
      <div className="visual-topline">
        <span>
          <Truck size={18} />
          {caseRecord.truck_type}
        </span>
        <strong>{caseRecord.case_id}</strong>
      </div>
      <div className="truck-bay">
        <div className="truck-cab">
          <Truck size={34} />
        </div>
        <div className="cargo-bay">
          {cargoBlocks.map((block) => (
            <div className={`cargo-block ${block.className}`} key={block.label}>
              {block.label}
            </div>
          ))}
        </div>
      </div>
      <div className="visual-flow">
        <span className={activeStep >= 1 ? "done" : ""}>Maestro</span>
        <ArrowRight size={16} />
        <span className={activeStep >= 3 ? "done" : ""}>AI Risk</span>
        <ArrowRight size={16} />
        <span className={activeStep >= 5 ? "done" : ""}>Human</span>
        <ArrowRight size={16} />
        <span className={activeStep >= 7 ? "done" : ""}>Dispatch</span>
      </div>
    </div>
  );
}

export default App;
