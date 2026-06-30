# Logithon CaseOps Demo Script

## Opening

Logithon CaseOps is a UiPath Maestro Case solution for cargo loading safety. It focuses on exception-heavy work: a deterministic load planner and risk service can detect unsafe loading patterns, but Maestro owns the governed case lifecycle and routes risky decisions to a human supervisor before dispatch.

## Live Demo Path

1. Open the dashboard and point out the Track 1: UiPath Maestro Case label.
2. Show the Maestro case plan panel: stages, task contracts, personas, and trigger count.
3. Create a live case from the intake panel using a cargo manifest, truck capacity, evidence state, and weight distribution.
4. Click Generate Load Plan and show the isometric cargo placement generated from truck dimensions, item dimensions, quantity, and weight.
5. Select the new live case and show that it is not one of the sample cases.
6. Explain the external key: `shipment_id` maps to the Maestro case key.
7. Show risk analysis: overload, near capacity, imbalance, fragile stacking, missing evidence, hazmat, temperature, damaged cargo, and confidence rules.
8. If the risk requires review, show the Human Supervisor Approval stage and approval reasons.
9. Run the demo scenario to show the end-to-end API handoff: case creation, stage update, analysis, load plan, risk score, human decision, dispatch instruction, and closure.
10. Close on the audit timeline and API contract for UiPath API Workflows.

## Narration Beat

The dashboard is the demo surface, not the orchestrator. UiPath Maestro Case is the orchestrator: it models stages, rules, re-entry, SLAs, personas, human tasks, and case operations. The coded service is one task worker inside that case plan.

## What To Say About Data

The three `LCOPS-1001` to `LCOPS-1003` cases are sample scenarios for a reliable demo. The Live Cargo Intake panel creates a new case from operator-entered data. The load planner is deterministic: it uses rectangular cargo dimensions and truck dimensions, not fake AI performance or synthetic accuracy claims.

## Closing

Codex built the deterministic load planner, cargo-risk service, Express API, React demo surface, live intake path, Maestro case plan artifact, task I/O contracts, and submission documentation. UiPath Maestro Case remains the enterprise orchestration and governance layer.
