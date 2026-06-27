# Logithon CaseOps Demo Script

## Opening

Logithon CaseOps is a human-approved cargo loading safety workflow orchestrated by UiPath Maestro Case. The key point is governance: AI helps analyze cargo, but risky loading decisions are routed to a supervisor before dispatch.

## Scenario

1. A warehouse receives a shipment request for industrial equipment.
2. UiPath Maestro Case creates `LCOPS-1002`.
3. The Logithon coded AI cargo-risk service reviews the cargo list and mock dock evidence.
4. The service detects that the truck is above 90 percent capacity and that dense pallets are heavily left-biased.
5. The case is routed to human supervisor approval.
6. The supervisor approves only after a safer loading plan is captured.
7. Dispatch instructions are generated.
8. UiPath Maestro closes the case with an audit trail.

## Narration Beat

This is not only a dashboard. The dashboard is the visible demo surface, but the enterprise workflow is Maestro-driven. The coded agent produces explainable cargo analysis, and Maestro owns stage control, auditability, and human approval.

## Closing

Codex built the coded cargo analysis service, risk scoring logic, API endpoints, frontend dashboard, mock logistics cases, UiPath integration contract, and this demo script. UiPath Maestro remains the orchestration and governance layer.
