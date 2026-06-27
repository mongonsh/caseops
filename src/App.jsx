import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  GitBranch,
  Package,
  Play,
  Route,
  Scale,
  ShieldCheck,
  Truck,
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

const maestroStages = [
  "Shipment Intake",
  "Cargo Vision Review",
  "Load Risk Analysis",
  "Human Supervisor Approval",
  "Dispatch Instruction",
  "Closed"
];

const apiContract = [
  ["Case created", "POST /api/uipath/case-created"],
  ["AI review", "POST /api/analyze-cargo"],
  ["Risk scoring", "POST /api/risk-score"],
  ["Approval", "POST /api/human-decision"],
  ["Dispatch", "POST /api/dispatch-instructions"],
  ["Stage sync", "POST /api/uipath/stage-update"]
];

const bonusItems = [
  "Coded cargo analysis service",
  "Generated API endpoints",
  "Risk scoring logic",
  "UiPath integration contract",
  "Human approval workflow support"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatKg(value) {
  return `${Number(value || 0).toLocaleString()} kg`;
}

function levelClass(level) {
  return String(level || "Low").toLowerCase();
}

function App() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [demoStep, setDemoStep] = useState(-1);
  const [demoLog, setDemoLog] = useState([]);
  const [demoRunning, setDemoRunning] = useState(false);

  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.case_id === selectedCaseId) || cases[0],
    [cases, selectedCaseId]
  );

  const summary = useMemo(() => {
    const highRisk = cases.filter((caseRecord) => caseRecord.risk_level === "High").length;
    const humanQueue = cases.filter((caseRecord) => caseRecord.requires_human_review).length;
    const totalWeight = cases.reduce((sum, caseRecord) => sum + caseRecord.total_weight_kg, 0);

    return {
      activeCases: cases.length,
      highRisk,
      humanQueue,
      totalWeight
    };
  }, [cases]);

  async function loadCases() {
    const response = await fetch("/api/cases");
    const payload = await response.json();
    setCases(payload.cases);
    setSelectedCaseId((current) => current || payload.cases[1]?.case_id || payload.cases[0]?.case_id);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const health = await fetch("/health");
        if (!health.ok) throw new Error("health check failed");
        if (mounted) setApiStatus("online");
        await loadCases();
      } catch (error) {
        if (mounted) setApiStatus("offline");
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

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
        await loadCases();
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
            <p className="eyebrow">Human-approved cargo loading safety</p>
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
          <p className="section-kicker">Mission dashboard</p>
          <h2>AI cargo loading safety workflow orchestrated by UiPath Maestro Case.</h2>
          <p>
            Enterprise case orchestration for cargo intake, AI vision review, load-risk analysis,
            human supervisor approval, and dispatch instructions.
          </p>
          <div className="mission-stats">
            <Metric label="Active cases" value={summary.activeCases} icon={<Workflow />} />
            <Metric label="High risk" value={summary.highRisk} icon={<AlertTriangle />} />
            <Metric label="Human queue" value={summary.humanQueue} icon={<UserCheck />} />
            <Metric label="Total cargo" value={formatKg(summary.totalWeight)} icon={<Scale />} />
          </div>
        </div>
        <CargoCommandVisual caseRecord={selectedCase} activeStep={demoStep} />
      </section>

      <section className="case-strip" aria-label="Sample cases">
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
            <span className={`risk-badge ${levelClass(caseRecord.risk_level)}`}>
              {caseRecord.risk_level}
            </span>
          </button>
        ))}
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
              ["Truck/container type", selectedCase.truck_type],
              ["Cargo count", selectedCase.cargo_count],
              ["Total weight", formatKg(selectedCase.total_weight_kg)],
              ["Truck capacity", formatKg(selectedCase.truck_capacity_kg)],
              ["Fragile items", selectedCase.fragile_items],
              ["Heavy items", selectedCase.heavy_items],
              ["SLA status", selectedCase.sla_status]
            ]}
          />
          <div className="cargo-list">
            {selectedCase.cargo_items.map((item) => (
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
          <IssueList issues={selectedCase.detected_issues} />
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
            {selectedCase.why_human_approval_required.length > 0 ? (
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
            {selectedCase.safer_loading_suggestion.map((suggestion) => (
              <div key={suggestion}>
                <CheckCircle2 size={16} />
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="UiPath Maestro integration" icon={<GitBranch />}>
          <div className="stage-rail">
            {maestroStages.map((stage) => (
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
            {selectedCase.audit_events.map((event, index) => (
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
            Codex built the specialized coded service and demo assets. UiPath Maestro remains the
            enterprise orchestration and governance layer.
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
