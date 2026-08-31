# Agentic Sandbox — agent ergonomics implementation plan

Status: implementation plan for the agent-native target described in `AGENT_SYSTEM_DESIGN.md`. The submitted `factory-tools/v1` challenge profile remains frozen until the replacement profile passes unit, trajectory, visual, and live-host acceptance.

## 1. Outcome

The implementation is complete when an agent can move from an unfamiliar page to a current, evidence-backed recommendation with minimal calls, no hidden semantic reconstruction, no repeated evaluation of equivalent plans, and no unsupported claim of optimality.

The migration is not a tool rename. It changes the system from low-level scenario CRUD into a shared, append-only decision substrate.

Target experience:

1. One compact read establishes truth, authority, time, controls, mission, and reusable evidence.
2. One bounded evaluation call can normalize and test several alternatives transactionally.
3. One comparison call returns feasibility, Pareto status, policy rank, currentness, and exact evidence handles.
4. A human intervention invalidates authority explicitly; the agent recovers through a delta, not a full rediscovery.
5. Every result remains reusable through immutable lineage and content-addressed receipts.

## 2. Guardrails for the migration

- Preserve the submitted challenge behavior and public deployment until the target profile is independently verified.
- Do not expose v1 and v2 tools together in one page. A host must discover one coherent profile, never twelve overlapping capabilities.
- Do not add an embedded chatbot, model backend, machine-control action, agent lock override, authentication system, or generic workflow engine.
- Keep the deterministic evaluator pure and independent from WebMCP.
- Prefer generated semantic parity over duplicated constants and switch statements.
- Treat every response-byte and tool-call reduction as an optimization only after truth and authority remain explicit.

## 3. Workstream map

```text
WS0  Baseline and profile isolation
  └─> WS1 Canonical ontology and temporal semantics
        ├─> WS2 State identity, deltas, and recovery
        ├─> WS3 Immutable scenario/evidence graph
        └─> WS4 Evaluator normalization and receipt cache
              └─> WS5 Intent-level six-tool profile
                    ├─> WS6 Human-interface projection
                    └─> WS7 Agent trajectory evaluation
                          └─> WS8 Live-host cutover
```

Each workstream has an independently reviewable acceptance gate. Later work must consume earlier abstractions rather than reimplement them.

## 4. WS0 — freeze and measure the current profile

### Goal

Create a reproducible v1 behavioral baseline and prevent the submitted challenge build from drifting while v2 is developed.

### Changes

- Add a build-time profile selector with only two legal values: `challenge-v1` and `agent-native-v2`.
- Default production to `challenge-v1` until cutover.
- Keep the current six tool names and response fixtures as golden v1 artifacts.
- Record current call counts, response sizes, simulator executions, and live replay outcomes.
- Add a contract snapshot test that fails if the discovered v1 tool set changes unintentionally.

### Acceptance

- Existing 84 Vitest and 5 Sites tests stay green.
- Existing live replay remains byte/behavior compatible where promised.
- Production deployment still discovers exactly the submitted six v1 tools.
- Baseline metrics are committed for later comparison.

## 5. WS1 — canonical ontology and explicit time

### Goal

Eliminate semantic drift across schema, validation, store, evaluator, UI, tests, and documentation.

### New module

`src/domain/control-definitions.ts`

It owns a versioned `CONTROL_DEFINITIONS` registry. Every entry defines:

- canonical control ID;
- resource ID;
- display label;
- JSON type and allowed domain;
- unit;
- application phase;
- evaluator operation kind and value field;
- lock scope;
- baseline getter;
- no-op equality;
- UI formatting metadata.

Derived modules generate:

- WebMCP schema properties;
- runtime validators;
- `ScenarioChanges` type helpers;
- command-layer availability checks;
- evaluator operation mapping;
- lock-control paths;
- planning-context control catalog;
- UI labels and documentation tables;
- parity tests.

### Immediate defects fixed

1. Set the canonical speed domain to 5,000–10,000 bps everywhere. The current WebMCP maximum of 15,000 contradicts the evaluator's 10,000 limit.
2. Make `packaging_calibration` canonically owned and locked by Packaging everywhere, or rename it and migrate every layer together. For the challenge semantics, Packaging ownership is the least disruptive choice.
3. Represent `pre_shift` and `runtime` as explicit phases. `supplier_mode`, `packaging_changeover_minutes`, and `packaging_calibration` are not silently available after the shift begins.
4. Replace the implicit meaning of `packagingLocked` with a lock record containing `resource_id`, `effective_tick`, `scope`, `event_id`, and `imposed_by`.
5. Separate `planning_epoch_id`, `current_tick`, `evaluation_start_tick`, and event revision.

### Tests

- Every control appears exactly once in `CONTROL_DEFINITIONS`.
- Schema, validator, command layer, evaluator mapping, lock coverage, and UI projection are generated from the same entry.
- Boundary tests derive from registry values; no copied 10,000/15,000 literals.
- A locked Packaging resource blocks speed, changeover, and calibration consistently.
- A phase-closed control is rejected by the command layer before evaluator execution.
- An unchanged phase-closed value is normalized as a no-op and does not fail.

### Acceptance

There is no path where a value passes public validation and is rejected only because another layer uses a different domain, owner, unit, phase, or lock scope.

## 6. WS2 — state identity, delta reads, and recovery

### Goal

Give the agent a stable mental model and the cheapest correct recovery after state changes.

### New concepts

- `operational_state_token`: content identity over factory, mission, clock, locks, ontology, and evaluator version.
- `workspace_revision`: append revision for scenarios/comparisons/decisions.
- `event_cursor`: ordered operational event position.
- `Currentness`: structured status with source/current tokens, invalidating events, and decision usability.

### Changes

- Replace write preconditions based on three loosely related integers with `expected_operational_state_token` in v2.
- Keep granular revisions internally and include them in audit evidence.
- Add an append-only operational event store with typed events.
- Add `get_state_delta` with compaction fallback to full context.
- Return a state projection in every success response.
- Standardize every error with `committed`, observed/current state, changed dimensions, and one machine-actionable recovery route.

### Error examples

- `STALE_STATE` → call `get_state_delta` from returned cursor.
- `CONTROL_UNAVAILABLE/HUMAN_LOCKED` → remove the named controls or wait for a human event; never retry unchanged.
- `CONTROL_UNAVAILABLE/PHASE_CLOSED` → preserve the effective value or choose runtime controls.
- `IDEMPOTENCY_CONFLICT` → generate a fresh request ID only after intent changes.

### Tests

- Scenario/workspace growth does not invalidate the operational token.
- Human locks, clock movement, mission changes, ontology changes, and evaluator changes do invalidate it.
- Deltas contain exactly the changed dimensions and invalidated scenario IDs.
- A stale write commits nothing and returns a one-call recovery path.
- Historical receipts remain valid for their source state but are unusable for current selection when invalidated.

### Acceptance

An agent never needs to parse prose or guess which read to perform after a recoverable error.

## 7. WS3 — immutable scenario and evidence graph

### Goal

Make use accretive: no hidden deletion, no mutable historical head, and no loss of lineage.

### New domain records

- `ScenarioVersion`
- `ScenarioLineageEdge`
- `EvidenceEdge`
- `ComparisonRecord`
- `DecisionRecord`
- `ScenarioPin` for UI A/B views

### Changes

- Replace fixed A/B storage slots with append-only scenario versions.
- Treat A and B as user-interface pins to graph nodes.
- Store requested changes, normalized changes, complete effective controls, source state token, input hash, receipt ID, parent, and creation event.
- Preserve all scenario versions and receipts across new evaluations.
- Add equivalence, dominance, invalidation, proof, and selection edges.
- Make list/projection operations cursor-based and bounded.

### Tests

- At least ten generations can branch without losing any ancestor.
- Re-pinning A or B never deletes a node.
- Every receipt is reachable from at least one scenario or baseline record.
- Every comparison records the candidate set, state token, policy, and result.
- Graph traversal is deterministic and bounded.

### Acceptance

The system can answer “where did this recommendation come from?” without reconstructing history from UI slots or ledger prose.

## 8. WS4 — normalization, deduplication, and evaluator economy

### Goal

Spend evaluator work only on semantically distinct, legal inputs.

### Changes

- Expand candidate patches into complete effective control vectors before evaluation.
- Remove no-op controls and return them as `normalized_no_op_controls`.
- Reject unavailable controls before invoking the evaluator.
- Canonicalize the complete evaluator input, including model versions and effective time.
- Add a content-addressed receipt cache keyed by the canonical input hash.
- Distinguish `cache_hit`, `receipt_reused`, and `scenario_node_created`.
- Validate a multi-candidate batch completely before appending any graph node.
- Preserve deterministic evaluator purity; caching and graph writes live outside it.

### Tests

- Identical normalized inputs execute the evaluator once across different request IDs and scenario names.
- A no-op patch and an empty delta resolve to the same evaluator input.
- One invalid candidate rejects an atomic batch without graph mutation or evaluator calls.
- Cache identity changes when ontology, evaluator, mission operands, effective tick, or relevant locks change.
- Cached evidence returns the same receipt ID and exact counters.

### Acceptance

Redundant simulation count is zero for identical normalized input hashes.

## 9. WS5 — v2 intent-level six-tool profile

### Goal

Expose the smallest complete interface an agent needs to understand, explore, evaluate, compare, recover, and inspect evidence.

### Public tools

1. `get_planning_context`
2. `get_state_delta`
3. `search_plan_frontier`
4. `evaluate_scenarios`
5. `compare_scenarios`
6. `get_scenario_evidence`

Low-level create/apply/run commands remain internal application services. They are not independently registered in v2.

### Contract requirements

- Closed schemas and independent runtime validation.
- Intent-first descriptions with side effects, preconditions, and next action.
- One public write tool: `evaluate_scenarios`.
- One to four candidates per atomic call.
- Compact default results; progressive evidence handles.
- Explicit selection policy or Pareto-only behavior.
- Read-your-write state and scenario projections.
- No hidden positional anchor in comparison input.
- No agent lock/unlock/force action.

### Call-budget acceptance

Cold path:

1. `get_planning_context`
2. optional `search_plan_frontier`
3. `evaluate_scenarios`
4. `compare_scenarios`

Human-interruption path:

1. stale `evaluate_scenarios` rejection
2. `get_state_delta`
3. new `evaluate_scenarios` or `compare_scenarios`

### Acceptance

- Exactly six top-level tools discovered.
- A model unfamiliar with the implementation can complete each reference trajectory without undocumented assumptions.
- No routine successful trajectory requires an immediate read after a write.

## 10. WS6 — human-interface projection

### Goal

Make the human and agent see the same authority, time, currentness, policy, and evidence model.

### Changes

- Show current tick and elapsed shift time when operating mid-shift.
- Show each lock's effective tick/window and blocked controls.
- Replace implicit A/B storage with graph pins and a lineage affordance.
- Add canonical IDs as accessible metadata while retaining human labels.
- Show currentness as `CURRENT`, `HISTORICAL`, or `INVALID`, with reason.
- Show active selection policy and Pareto status in comparison.
- Expose cache reuse and receipt identity without adding dashboard clutter.
- Use the same event cursor and typed reasons in the revision ledger and tool deltas.
- Preserve full human-mode usability when WebMCP is absent.

### Acceptance

A human can independently verify every authority or evidence claim returned to the agent from the visible product.

## 11. WS7 — model-in-the-loop trajectory evaluation

### Goal

Measure whether the interface is actually intuitive to agents rather than merely type-correct.

### Harness

Create a deterministic host shim around the registered descriptors and run reference prompts with multiple agent configurations. Capture every tool call, argument, result byte count, state transition, evaluator execution, and final claim.

### Required trajectories

- cold start to feasible recommendation;
- human lock and stale recovery;
- phase closure with partial plan salvage;
- malformed input corrected once;
- equivalent candidate cache reuse;
- deep branching with provenance recall;
- stale evidence challenge;
- incomplete frontier search;
- conflicting objectives / Pareto result;
- adversarial strings in tool data.

### Metrics and gates

- task success: 100% on deterministic acceptance tasks;
- currentness accuracy: 100%;
- locked/phase-closed control write rate after context read: 0%;
- unsupported optimality claims: 0%;
- duplicate evaluator runs for one input hash: 0;
- median cold-path calls: <=4;
- median stale-recovery calls after rejection: <=2 additional calls;
- lineage/provenance completeness: 100%;
- result bytes measured and capped per projection.

### Acceptance

The v2 profile must outperform v1 on call count and recovery while matching v1 on exact outcomes and safety.

## 12. WS8 — live-host verification and cutover

### Goal

Move production only after the new profile is coherent in the real WebMCP host.

### Verification sequence

1. Deploy v2 to an isolated preview URL.
2. Confirm exactly six top-level tools and no v1 overlap.
3. Run the cold-start trajectory entirely through Site Tools.
4. Perform the human Packaging lock visibly.
5. Verify atomic stale-state rejection and returned recovery route.
6. Recover through `get_state_delta`.
7. Verify no-op normalization, cache reuse, graph lineage, currentness, policy rank, and evidence detail.
8. Compare final deterministic counters and proof against golden fixtures.
9. Run responsive and accessibility QA.
10. Promote only after all automated and manual gates pass.

### Rollback

The profile selector permits immediate restoration of `challenge-v1`. Data migrations must be additive and scenario graph storage must preserve v1 receipt IDs.

## 13. Pull-request sequence

### PR 1 — semantic integrity foundation

- canonical control registry;
- speed-domain parity;
- calibration ownership parity;
- explicit lock records and phases;
- no-op normalization;
- generated parity tests.

### PR 2 — state and recovery contract

- operational state token;
- workspace revision and event cursor;
- typed event log;
- structured currentness;
- standard recovery envelopes.

### PR 3 — append-only scenario graph

- immutable scenario nodes and lineage;
- A/B pins;
- evidence index;
- compatibility projection for existing UI.

### PR 4 — evaluator cache and atomic batch service

- effective-control expansion;
- content hash cache;
- batch validation and rollback;
- read-your-write summaries.

### PR 5 — v2 six-tool profile

- new descriptors, schemas, validators, and handlers;
- progressive evidence queries;
- frontier search and policy comparison;
- profile-isolation tests.

### PR 6 — aligned human interface

- explicit time and lock scope;
- currentness and policy display;
- lineage/pin behavior;
- evidence and delta ledger alignment.

### PR 7 — agent trajectory harness and cutover evidence

- model-in-loop evals;
- call/byte/simulation budgets;
- live-host replay report;
- production profile switch.

## 14. File-level target map

| Area | Target files / modules |
| --- | --- |
| Ontology | `src/domain/control-definitions.ts`, generated schema/validation adapters |
| Time and locks | `src/domain/types.ts`, `src/app/operationalState.ts`, `src/app/events.ts` |
| State identity | `src/domain/canonical.ts`, `src/app/stateToken.ts` |
| Graph | `src/app/scenarioGraph.ts`, `src/app/evidenceIndex.ts` |
| Cache | `src/app/receiptCache.ts` |
| Services | `src/app/planningService.ts`, `src/app/evaluationService.ts`, `src/app/comparisonService.ts` |
| WebMCP v2 | `src/webmcp/v2/contracts.ts`, `schemas.ts`, `validation.ts`, `tools.ts`, `register.ts` |
| Profile gate | `src/webmcp/profile.ts`, `src/App.tsx` |
| UI | current blueprint components plus graph/currentness/policy projections |
| Evals | `tests/agent-trajectories/`, golden traces, live replay checklist |

Names may change during implementation, but ownership boundaries may not collapse back into one oversized store.

## 15. Risk register

| Risk | Mitigation |
| --- | --- |
| Larger responses erase call-count gains | Compact projections, ontology hash, deltas, paged evidence, byte budgets |
| High-level tools become opaque monoliths | Keep internal command services modular and expose normalized plans and receipts |
| Frontier search implies false completeness | Explicit budget, search-space cardinality, completeness flag, Pareto honesty |
| State token invalidates too often | Separate operational state from workspace revision; document token inputs |
| State token invalidates too little | Include mission, clock, locks, ontology, and evaluator version; property tests |
| Cache reuses semantically different runs | Hash complete normalized input and all relevant versions/effective time |
| Graph growth becomes unbounded | Cursor-based projections and explicit retention/compaction policy; never silently delete decision evidence |
| v2 breaks submitted challenge | Isolated profile and preview deployment; production remains v1 until live replay passes |
| UI becomes denser | Progressive disclosure and views over the same graph; do not expose every internal edge by default |

## 16. Definition of done

The agent-native system is done only when all statements below are true:

- One canonical registry defines every control semantic across all layers.
- Time and lock effectiveness are explicit in context, evaluation, receipts, and UI.
- A full planning context is sufficient to generate only legal candidate actions.
- Writes bind to one operational state token and return read-your-write projections.
- Recoverable errors include a deterministic next tool and arguments.
- Scenario and evidence history is append-only and traversable.
- Equivalent normalized plans reuse receipts.
- Comparison distinguishes feasibility, Pareto dominance, policy rank, and proven optimality.
- The public v2 surface contains exactly six intent-level tools.
- Cold and interrupted workflows meet the call and evaluator budgets.
- Model-in-the-loop evals show zero currentness, lock, phase, and optimality-claim errors.
- The human interface and agent interface are demonstrably projections of the same state and evidence.
- The live WebMCP host replay passes before production cutover.
