# Logithon CaseOps

Human-approved cargo loading safety orchestrated with UiPath Maestro Case.

Logithon CaseOps is a Track 1 UiPath AgentHack project. It models cargo loading as a long-running, exception-heavy case where UiPath Maestro Case coordinates intake, cargo evidence review, risk analysis, supervisor approval, evidence rework, dispatch instructions, SLAs, and audit history.

The local app is a working prototype and demo surface. The intended production control plane is UiPath Automation Cloud with Maestro Case.

## Why Maestro Case

Cargo loading is not a simple linear process. A case may move forward, pause, re-enter evidence review, route to a human supervisor, or block dispatch depending on:

- Truck capacity and total cargo weight
- Left/right and front/rear imbalance
- Fragile cargo stacked below heavy freight
- Missing dock photos or low-quality evidence
- Box placement feasibility inside the selected truck size
- Damaged cargo
- Hazardous or temperature-sensitive cargo
- Low AI confidence
- Human supervisor approval or rejection

That matches UiPath Maestro Case better than a fixed BPMN-only flow because the process is stage-based, exception-heavy, and judgment-driven.

## UiPath Components

Planned UiPath Automation Cloud implementation:

- UiPath Maestro Case
- Studio Web Case Plan Designer
- Case App
- Case Instance Management
- Action apps or human action tasks
- API Workflows
- Data Fabric or Virtual Data Object trigger
- Integration Service connector trigger
- Optional Insights dashboard

Local prototype components:

- React + Vite dashboard
- Express API
- Deterministic cargo-risk service
- Deterministic cargo load planner
- Live operator-created case intake
- Maestro-aligned case plan, entity schema, and task I/O contracts

## What Is Real vs. Simulated

Real in this repository:

- Working dashboard and API
- Live case creation from user-entered cargo data
- Load plan generation from truck dimensions, box dimensions, quantities, and weights
- Risk scoring and dispatch logic
- Human approval endpoint
- Audit timeline
- Machine-readable Maestro case plan artifact
- Task input/output write-back contracts

Simulated until connected to UiPath Automation Cloud:

- Native Maestro Case runtime
- Generated Case App
- Action app tasks
- Data Fabric/VDO trigger
- UiPath tenant authentication
- Real warehouse/TMS systems
- Real computer-vision model or certified loading/axle-weight solver

## Quick Start

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

The API runs at:

```text
http://localhost:4000
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

## Keys And Environment

No key is required for the local prototype.

Copy `.env.example` only when connecting to real services:

```bash
cp .env.example .env
```

Important values for a connected UiPath deployment:

```env
UIPATH_BASE_URL=
UIPATH_ORGANIZATION_NAME=
UIPATH_TENANT_NAME=
UIPATH_FOLDER_ID=
UIPATH_CASE_PROJECT_KEY=
UIPATH_PAT=
UIPATH_WEBHOOK_SECRET=
```

`UIPATH_ORGANIZATION_NAME` is the account/organization logical name in the URL. For example:

```text
https://staging.uipath.com/hackathon26_1032/portal_/profile
```

means:

```env
UIPATH_BASE_URL=https://staging.uipath.com
UIPATH_ORGANIZATION_NAME=hackathon26_1032
```

`UIPATH_TENANT_NAME` is the tenant segment in the Maestro URL. For example:

```text
https://staging.uipath.com/hackathon26_1032/DefaultTenant/maestro_/case-management
```

means:

```env
UIPATH_TENANT_NAME=DefaultTenant
```

For the Personal Access Token screen, use the scopes that match API resources:

- Maestro
- Orchestrator
- Data Fabric
- Apps, if you build Action apps or UiPath Apps screens
- Integration Service or Resource Catalog, if your case starts from connector events

Studio Web may not appear as a token scope. That is okay: Studio Web is the browser design surface where you create and publish the case plan with your logged-in UiPath account.

For a production External Application OAuth setup, use:

```env
UIPATH_CLIENT_ID=
UIPATH_CLIENT_SECRET=
```

Optional if replacing the deterministic service with model-based cargo vision:

```env
OPENAI_API_KEY=
```

## Demo Modes

The app has two demo paths:

- Live Cargo Intake: enter a shipment, cargo manifest, truck dimensions, truck capacity, evidence state, and weight distribution. The API creates a new non-sample case, and the load-plan action generates a placement plan from that same manifest.
- Run Demo Scenario: replays a high-risk sample case through the end-to-end Maestro-style API flow, including load planning.

The sample cases are intentionally labeled `Sample`. Operator-created cases are labeled `Live`.

## Maestro Artifacts

Primary artifacts:

- `docs/maestro-case-plan.md`
- `uipath/maestro-case-plan.json`
- `docs/demo-script.md`
- `docs/devpost-submission-outline.md`
- `.env.example`

Runtime artifact endpoints:

```text
GET /api/maestro/case-plan
GET /api/maestro/entity-schema
GET /api/maestro/task-contracts
```

## API Contract

UiPath Maestro Case or UiPath API Workflows can call:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health check |
| GET | `/api/cases` | List cases |
| GET | `/api/cases/{case_id}` | Get one case |
| POST | `/api/live-cases` | Create a live operator-entered case |
| POST | `/api/load-plan` | Generate a deterministic cargo placement plan |
| POST | `/api/uipath/case-created` | Register a Maestro-created case |
| POST | `/api/uipath/stage-update` | Sync stage changes |
| POST | `/api/analyze-cargo` | Run cargo/evidence analysis |
| POST | `/api/risk-score` | Return structured risk score |
| POST | `/api/human-decision` | Record supervisor approval decision |
| POST | `/api/dispatch-instructions` | Generate dispatch instruction |

## Case Plan Summary

Case entity: `CargoLoadSafetyCase`

Case key: external key from `shipment_id`, with `LCOPS` as system-prefix fallback.

Primary stages:

1. Shipment Intake
2. Cargo Vision Review
3. 3D Load Plan Generation
4. Load Risk Analysis
5. Human Supervisor Approval
6. Dispatch Instruction
7. Closed

Secondary stages:

- Evidence Rework
- Dispatch Blocked

Core task workers:

- API Workflow: register loading request
- External agent/API: cargo vision review
- API Workflow: deterministic load plan generation
- API Workflow: load risk analysis
- Human action: supervisor approval
- API Workflow: dispatch instruction

## Judging Alignment

For UiPath AgentHack, this project targets:

- Runner-up of UiPath Maestro Case
- Honorable Mention of UiPath Maestro Case
- Best Demo / Presentation

It is designed to score well on:

- Business impact: unsafe dispatch prevention and accountable supervisor governance
- Platform usage: Maestro Case as the orchestration layer, with people, agents, API workflows, Data Fabric, and Case App concepts
- Technical execution: working API, live intake, deterministic load planner and risk engine, edge-case handling, and audit trail
- Completeness: runnable prototype, docs, setup, demo script, and submission outline
- Presentation: a 5-minute live-created case demo instead of only slides
- Coding agent bonus: Codex-built service and artifacts are documented

## Sources Used

- UiPath Maestro docs: [How Maestro fits into UiPath](https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/maestro-integration-with-the-uipath-ecosystem)
- UiPath Maestro docs: [Introduction to Maestro Case](https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/introduction-to-maestro-case)
- UiPath Maestro docs: [Maestro Case lifecycle](https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/maestro-case-lifecycle-from-event-trigger-to-app-experience)
- UiPath Maestro docs: [Task I/O and write-back contracts](https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/how-to-establish-task-io-and-write-back-contracts)
- UiPath AgentHack Devpost page: [uipath-agenthack.devpost.com](https://uipath-agenthack.devpost.com/)

## License

MIT
