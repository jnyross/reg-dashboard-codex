# Interaction Worker Rollout Checklist (One-Step Enablement Gate)

## Scope
- Interaction worker: dashboard detail pagination + refresh behavior governed by cursor and stale contracts.
- Target: safe transition from deterministic read-only mode to update/write mode.

## Preconditions
- [ ] `tests/dashboard/interaction-worker-fixtures.json` reviewed and versioned.
- [ ] `tests/dashboard/interaction-worker-validation-cases.json` reviewed and versioned.
- [ ] `tests/dashboard/stale-refresh-payload-cases.json` reviewed and versioned.
- [ ] `.ralph/guardrails.md` section for interaction-worker pagination and stale behavior includes active config checks.
- [ ] `tests/dashboard/interaction-worker-gate-verification.json` recorded with status matrix and transition recommendation.

## Verification Gates (must pass before enablement)
- [ ] Execute fixture case `IFC-001` and confirm:
  - Page 1 item IDs are stable.
  - Page 2 item IDs are stable under concurrent update mutation.
  - No duplicates across pages for the same `snapshot_signature`.
- [ ] Execute malformed token cases `VAL-001` and `VAL-002`.
- [ ] Execute mixed-direction case `MIX-001`.
- [ ] Execute stale payload cases `STALE-TO-TOO-LATE-01` and `STALE-TO-PARTIAL-01`.
- [ ] Confirm `PRD.json` acceptance criteria `interaction_worker_fixture_suite`, `stale_payload_contract`, and `rollout_readiness_gate` evaluate to `pass`.

## Rollout Actions
- [ ] Set runtime flag:
  - `interaction_worker.mode = "validation"`
  - Execute one full synthetic interaction pass (fetch -> paginate -> refresh) with no degraded errors.
- [ ] Set runtime flag:
  - `interaction_worker.mode = "enabled"`
- [ ] Record completion artifact in `activity.md` with timestamp and test references.

## Rollback Trigger (single action, one-step rollback)
- Condition: any gate failure, malformed cursor acceptance drift, stale contract mismatch, or duplicate/skip detected across pagination.
- One-step action:
  1. Flip `interaction_worker.mode` to `read-only`.
  2. Reload runtime configuration.
  3. Preserve last known payload and expose stale warning state.
- [ ] Validate that no writes are made while rollback action is active.
