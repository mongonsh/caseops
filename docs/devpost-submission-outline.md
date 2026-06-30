# Devpost Submission Outline

## Project Title

Logithon CaseOps - Maestro-governed cargo loading safety

## Track

Track 1: UiPath Maestro Case

## Short Description

Logithon CaseOps uses UiPath Maestro Case to orchestrate unsafe or uncertain cargo loading decisions. The case plan coordinates warehouse intake, deterministic 3D load planning, external cargo-risk analysis, human supervisor approval, evidence rework, dispatch instructions, SLAs, and audit history.

## Problem

Cargo loading mistakes can cause damaged freight, unsafe dispatch, compliance violations, and delayed deliveries. Many decisions cannot be fully automated because the right path depends on weight distribution, cargo type, evidence quality, damage notes, hazmat requirements, and supervisor judgment.

## Solution

UiPath Maestro Case is the control plane. The coded services in this repo act as external task workers. The load planner places rectangular boxes into the truck envelope using real item dimensions, quantity, and weight. The risk service analyzes cargo manifests, truck capacity, weight distribution, dock evidence, fragile stacking, hazmat, temperature sensitivity, and damage metadata. Maestro uses the result to decide whether the case can proceed, must route to a human supervisor, should re-enter evidence review, or must block dispatch.

## UiPath Components

- UiPath Maestro Case
- Studio Web Case Plan Designer
- Case App
- Case Instance Management
- Action apps or human action tasks
- API Workflows
- Data Fabric or VDO case trigger
- Integration Service connector trigger
- Optional Insights dashboard for cycle time, risk count, SLA breach, and approval queue metrics

## Agents And Automations

- Codex-built load planner: deterministic API Workflow target for cargo placement feasibility.
- Codex-built cargo-risk service: deterministic external agent/API Workflow target.
- Case Manager: rules-first orchestration with agent fallback concept from Maestro Case.
- Human supervisor: approves, blocks, or approves with conditions.
- Dispatch workflow: generates loading controls and closure outcome.

## Demo Video Structure

Target: 4:30 to 5:00.

1. 0:00-0:30 - Problem and track choice.
2. 0:30-1:15 - Show the Maestro Case plan: stages, secondary stages, personas, SLAs.
3. 1:15-2:10 - Create a live cargo case in the dashboard and show API response.
4. 2:10-2:55 - Generate the load plan and show placed/unplaced boxes plus warnings.
5. 2:55-3:35 - Run risk analysis and show human approval requirement.
6. 3:35-4:25 - Supervisor approves safer loading plan, dispatch instruction is generated, audit trail updates.
7. 4:25-5:00 - Architecture, UiPath components, coding-agent bonus, production next steps.

## Screenshots To Capture

- Dashboard with live case selected.
- Deterministic 3D load plan visualization.
- Maestro case plan/stage artifact.
- Human approval queue with detected risks.
- Audit timeline after dispatch instruction.
- API contract or task I/O contract panel.

## Prize Alignment

- Runner-up / Honorable Mention of UiPath Maestro Case: strong stage-based case orchestration, human governance, re-entry, SLAs, deterministic load planning, and external task worker integration.
- Best Demo / Presentation: live-created case, visible load plan, risk decisioning, audit trail, and a clear 5-minute story.
- Coding agent bonus: Codex-generated code and artifacts documented in README and demo narration.
