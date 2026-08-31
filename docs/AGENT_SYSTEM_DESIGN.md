# Agentic Sandbox — agent-native system design

Status: target architecture for the post-challenge system. The submitted challenge build remains the verified `factory-tools/v1` implementation until this design is implemented and replay-tested.

## 1. Design thesis

Agentic Sandbox is not a dashboard with tools attached. It is one shared decision substrate with three participants:

- the human defines intent, constraints, and authority boundaries;
- the agent explores, evaluates, compares, and explains alternatives;
- deterministic software owns operational truth, exact arithmetic, and proofs.

The visible interface and the agent interface are projections of the same versioned system. Neither is the source of truth. The source of truth is the canonical operational state, its event history, the immutable scenario graph, and content-addressed receipts.

The target experience is simple from the agent's seat:

1. Read one compact planning context.
2. Know exactly what is true, what is mutable, what is locked, what is temporally available, and what “best” means.
3. Evaluate a small batch of explicit candidate plans without manually orchestrating low-level CRUD steps.
4. Receive deterministic evidence, ranking, provenance, currentness, and the cheapest legal next action.
5. Recover from a human intervention through a small delta rather than reconstructing the world.
6. Reuse prior evidence instead of repeating equivalent work.

This is what **agent-accretive** means here: every observation, scenario, receipt, comparison, human intervention, and proof becomes structured, attributable knowledge that can be reused by later reasoning. The system becomes more useful as it is used without allowing stale evidence to masquerade as current authority.

## 2. The ideal agent control loop

The agent loop should be legible as one closed system rather than a sequence of unrelated tool calls.

### 2.1 Orient

`get_planning_context` returns the minimum sufficient model of the current decision:

- operational state identity and currentness token;
- simulation clock and planning phase;
- exact mission thresholds and selection policy;
- canonical resource and control catalog;
- current values, allowed domains, temporal availability, locks, and reasons;
- baseline metrics and bottlenecks;
- current scenario heads and reusable evidence;
- event cursor for future delta reads.

The agent should not have to infer a control's owner, unit, legal range, phase, or lock coverage from several schemas and error messages.

### 2.2 Bound the action space

Before generating a plan, the agent can distinguish:

- mutable now;
- human-locked;
- phase-closed;
- unsupported;
- unchanged/no-op;
- technically valid but dominated under known evidence.

A control that cannot be changed should never appear merely as a valid JSON field. Its unavailability must be explicit in the read model before the agent spends a write call.

### 2.3 Generate candidates

Candidate plans are expressed as deviations from an explicit immutable base. The server expands them into a complete effective control vector and removes semantic no-ops. The agent never has to remember an implicit patch stack.

### 2.4 Evaluate

One transactional call can evaluate one to four candidates against the same operational state. The whole request is validated before any visible scenario node is appended. Equivalent normalized inputs reuse an existing receipt.

### 2.5 Compare and select

The comparison layer reports:

- hard-constraint feasibility;
- exact deltas;
- Pareto dominance;
- currentness;
- policy-based rank when a policy exists;
- why a candidate wins, loses, or remains incomparable.

The system must not call a plan “optimal” unless the search was complete or the optimization policy and proof justify that claim. Otherwise it returns a non-dominated set and the limits of the search.

### 2.6 Observe and recover

Human actions append events and change the operational state token. A stale write fails atomically and returns:

- `committed: false`;
- the observed and current state identities;
- the dimensions that changed;
- the event cursor to read;
- the cheapest recovery tool and arguments.

The agent then calls `get_state_delta`, updates only the invalidated part of its model, and replans.

### 2.7 Explain and accrete

The final answer is grounded in a decision bundle containing the current state token, scenario version, receipt hash, exact constraints, currentness, and comparison policy. Historical evidence remains available, but its source state is always visible.

## 3. Non-negotiable system invariants

1. **One noun, one identifier, one meaning.** A control or resource has the same canonical ID, owner, unit, range, phase, and lock semantics in schemas, validators, command handling, simulation, UI, tests, and documentation.
2. **Time is explicit.** Planning revision time, event time, and simulation time are separate concepts. A boolean lock may never implicitly mean “tick 16.”
3. **Reads provide knowledge; tokens bind authority.** A write is authorized only against the exact operational state the agent observed.
4. **Writes are atomic, idempotent, and intent-complete.** No partial mutation, silent rebase, hidden archival, or ambiguous merge is allowed.
5. **Evidence is immutable; currentness is contextual.** A stale receipt can remain true for its source state while being unusable for a current recommendation.
6. **The command layer rejects impossible plans before simulation.** Locked, phase-closed, out-of-range, and unsupported controls do not become fatal “simulation results.”
7. **Every write returns a read-your-write projection.** The agent receives the complete effective plan, created IDs, source state, receipt summary, and next precondition without an immediate read call.
8. **Every error includes recovery semantics.** Error codes are not prose puzzles.
9. **History grows as a graph, not a pair of mutable slots.** UI labels such as A and B are views, not storage identities.
10. **Detail is progressive.** Initial reads and evaluation results are compact; exact cost ledgers, proofs, and tick traces are fetched only when needed.
11. **No optimality without an objective.** Feasibility, dominance, and policy rank are separate claims.
12. **Human authority has no agent override.** No tool can lock, unlock, force, or perform a real machine action.

## 4. Tower of linked abstractions

```text
Human intent and intervention
            │
            ▼
Mission contract and decision policy
            │
            ▼
Agent planning context and six intent-level tools
            │
            ▼
Immutable scenario / decision graph
            │
            ▼
Transactional command and authority layer
            │
            ▼
Deterministic evaluator, proofs, and receipt cache
            │
            ▼
Canonical resource, control, unit, phase, and lock ontology
            │
            ▼
Append-only operational state and event log
```

Each layer narrows and stabilizes the layer above it. Higher layers may compose lower-level primitives, but they may not invent alternate semantics.

### 4.1 Operational state and event log

Owns the live factory version, simulation clock, mission version, active locks, and ordered human/system events.

### 4.2 Canonical ontology

Owns every resource and control definition. It generates the machine contract used by all other layers.

### 4.3 Deterministic evaluator

Accepts only normalized, semantically valid inputs. It computes counters, constraints, invariants, proofs, hashes, and receipts.

### 4.4 Command and authority layer

Checks state tokens, temporal availability, locks, idempotency, and batch atomicity. It converts agent intent into normalized evaluator inputs.

### 4.5 Scenario graph

Stores immutable plan versions, lineage, receipts, equivalence, dominance, and decisions. It never overwrites evidence.

### 4.6 Agent tool layer

Exposes a small intent-level interface with compact projections, progressive detail, and machine-readable recovery.

### 4.7 Human interface

Uses the same IDs, currentness, control availability, lock scope, and evidence. It does not maintain a parallel interpretation of state.

## 5. Canonical control ontology

A single `CONTROL_DEFINITIONS` registry should generate JSON Schema, runtime validation, command normalization, operation mapping, lock coverage, UI labels, snapshots, and documentation.

| Canonical control ID | Resource | Domain / unit | Application phase | Human lock scope |
| --- | --- | --- | --- | --- |
| `mixer_speed_bps` | Mixer | integer 5,000–10,000 basis points | runtime-adjustable | Mixer |
| `packaging_speed_bps` | Packaging | integer 5,000–10,000 basis points | runtime-adjustable | Packaging |
| `packaging_changeover_minutes` | Packaging | 15, 30, or 45 minutes | pre-shift only | Packaging |
| `packaging_calibration` | Packaging | `standard` or `enhanced` | pre-shift only | Packaging |
| `supplier_mode` | Supplier | `standard` or `expedite` | pre-shift only | Supplier |
| `quality_rate_units_per_hour` | Quality Gate | 600, 700, 800, or 900 units/hour | runtime-adjustable | Quality Gate |
| `warehouse_dock_units_per_hour` | Warehouse | 800, 900, or 1,000 units/hour | runtime-adjustable | Warehouse |

Every definition must include:

- canonical ID and display label;
- owning resource ID;
- value type, unit, range or enum;
- baseline field and evaluator operation kind;
- application phase and effective-time rule;
- lock scope and human-control policy;
- no-op normalization policy;
- exact or monotonic effect metadata where the model can support it;
- ontology version.

### 5.1 Current semantic defects this registry must eliminate

The current challenge implementation contains three important cross-layer inconsistencies:

1. WebMCP validation advertises speed values through 15,000 bps while the evaluator rejects values above 10,000 bps.
2. The tool and store call calibration a Packaging control, while the evaluator currently maps `SET_CALIBRATION` to Quality Gate.
3. Pre-shift-only controls are not exposed as phase-constrained in planning context, so an agent can spend a valid tool call on a control that will later be rejected by the evaluator.

These are ontology failures, not isolated validation bugs. Fixing only one occurrence leaves the system vulnerable to future drift.

## 6. State, identity, and authority

The target design separates operational currentness from workspace growth.

### 6.1 `operational_state_token`

A server-generated content token over the dimensions that can change the meaning or legality of a plan:

- factory version;
- mission version;
- simulation clock / evaluation start tick;
- active lock set and effective windows;
- ontology version;
- evaluator version.

Appending a scenario does not invalidate this token. A human lock, phase advance, mission change, or evaluator change does.

### 6.2 `workspace_revision`

Monotonically increments when scenarios, comparisons, or decisions are appended. It supports UI synchronization without invalidating independent candidate evaluations.

### 6.3 `event_cursor`

Monotonically identifies the operational event stream. `get_state_delta` reads from this cursor. If the requested history has compacted, the response requires a full context refresh.

### 6.4 `scenario_version_id`

Immutable identifier for one normalized candidate plan. It includes or references:

- parent scenario version;
- source operational state token;
- requested changes;
- normalized no-op-free delta;
- complete effective control vector;
- scenario input hash;
- latest receipt ID.

### 6.5 `receipt_id`

Content-addressed identity for the deterministic evaluation. Reuse is safe only when the normalized evaluator input and all model versions match.

### 6.6 Currentness is structured

Do not return only `source_is_current: boolean`. Return:

```json
{
  "status": "CURRENT",
  "source_operational_state_token": "ost_...",
  "current_operational_state_token": "ost_...",
  "invalidated_by": [],
  "usable_for_current_decision": true
}
```

A stale result names the dimensions and events that invalidated it.

## 7. Temporal model

The system currently conflates workflow interruption and simulated shift time. The target model must represent both explicitly.

### 7.1 Required clock fields

- `planning_epoch_id` — the collaborative decision session;
- `simulation_horizon_ticks` and `tick_minutes`;
- `evaluation_start_tick` — where the proposed intervention begins;
- `current_tick` — when modeling an in-progress shift;
- `effective_tick` or effective window for every lock and operation.

### 7.2 Control availability

Availability is derived, never guessed:

```text
available_now = supported
             ∧ resource_not_human_locked_at_effective_tick
             ∧ application_phase_allows_effective_tick
             ∧ value_in_domain
```

The planning context returns one of:

- `AVAILABLE`;
- `HUMAN_LOCKED`;
- `PHASE_CLOSED`;
- `UNSUPPORTED`.

### 7.3 No-op normalization

An absolute value equal to the base value is recorded as a no-op and omitted from evaluator operations. It must not fail because its nominal command phase has passed. The response reports `normalized_no_op_controls` so the agent understands what happened.

### 7.4 Tick-16 challenge behavior

If the lock-bound proof intentionally models a human intervention four hours into a 16-hour shift, that fact must be explicit in the operational state and UI. The agent should receive `current_tick: 16`, `elapsed_minutes: 240`, and the exact controls still available at that time. The lock must not be inferred from `packaging_locked: true`.

## 8. Accretive scenario and evidence graph

The current A/B slots are useful presentation devices but poor storage primitives. Creating a third scenario can replace a slot while only the receipt remains reachable. The target store is append-only.

### 8.1 Scenario node

```text
ScenarioVersion
├── scenario_version_id
├── parent_scenario_version_id
├── source_operational_state_token
├── requested_changes
├── normalized_changes
├── effective_controls
├── input_hash
├── receipt_id
└── created_event_cursor
```

### 8.2 Evidence edges

The system can append machine-derived relationships:

- `EQUIVALENT_INPUT` — same normalized evaluator input;
- `EQUIVALENT_OUTCOME` — same relevant metrics under the same context;
- `DOMINATES` — no worse on all declared objectives and better on at least one;
- `INVALIDATED_BY` — state event that makes a receipt non-current;
- `PROVES_INFEASIBLE_UNDER` — proof bound and lock set;
- `SELECTED_UNDER_POLICY` — policy and comparison set used for a decision.

### 8.3 Receipt cache

Before simulating, canonicalize the complete evaluator input and look up its hash. A cache hit returns the existing receipt and appends a new scenario node only when the user wants a distinct named branch. The response exposes `cache_hit` and `reused_receipt_id`.

### 8.4 Views, not slots

The UI may pin any two nodes as Scenario A and Scenario B. Replacing a visual pin never deletes the underlying node, lineage, or receipt.

## 9. Mission and decision contract

The mission must distinguish hard constraints from optimization preferences.

### 9.1 Hard constraints for the challenge profile

- `good_output_units >= 10,937`;
- `scenario_total_cost * 100 <= baseline_total_cost * 108`;
- `scenario_bad * baseline_gross <= baseline_bad * scenario_gross`;
- asset inventory unchanged.

The planning context returns both human-readable intent and exact machine operands.

### 9.2 Selection policy

A default challenge policy can be explicit and lexicographic:

1. current and evaluator-valid;
2. all hard constraints pass;
3. greater good output;
4. lower total cost;
5. lower defect rate;
6. fewer changed controls;
7. canonical plan hash as deterministic tie-breaker.

The policy is versioned. A different business objective should create a different policy rather than silently changing the meaning of “best.”

### 9.3 Pareto honesty

When no policy is supplied, the system returns a Pareto set. When a search budget is incomplete, it reports `search_complete: false` and must not claim global optimality.

## 10. Target six-tool surface

The high-level tool surface remains deliberately small. Low-level command primitives stay internal and testable.

| Tool | Kind | Agent intent |
| --- | --- | --- |
| `get_planning_context` | Read | Obtain the compact authoritative model needed to plan. |
| `get_state_delta` | Read | Read only operational changes since a prior state/cursor. |
| `search_plan_frontier` | Read | Use deterministic bounded search and cached evidence to propose non-dominated candidates. |
| `evaluate_scenarios` | Write | Atomically normalize, persist, and evaluate one to four candidate plans against one state token. |
| `compare_scenarios` | Read | Rank current candidates, report dominance, and return exact decision evidence. |
| `get_scenario_evidence` | Read | Fetch progressive receipt detail: constraints, proof, cost, invariants, or paged ticks. |

### 10.1 Why these tools

- They map to agent intentions, not database operations.
- They reduce the initial two-scenario path from eight calls to roughly three or four.
- They make human-interruption recovery a delta read plus reevaluation.
- They preserve a narrow write surface: only `evaluate_scenarios` mutates local planning state.
- They keep expensive or verbose evidence on demand.

### 10.2 `get_planning_context`

Returns:

- operational state token, workspace revision, and event cursor;
- exact clock and lock semantics;
- mission and selection policy;
- canonical control availability matrix;
- baseline and bottleneck summary;
- current scenario graph heads and reusable receipts;
- supported detail routes.

### 10.3 `get_state_delta`

Input: prior state token or event cursor.

Returns ordered events, changed dimensions, newly unavailable controls, invalidated scenario versions, current state token, and whether a full refresh is required.

### 10.4 `search_plan_frontier`

Input: state token, search budget, optional control subset, and policy ID.

Returns up to four non-dominated candidate specifications, cached evidence used, deterministic bounds, and whether the search is complete. It does not append visible scenario nodes.

### 10.5 `evaluate_scenarios`

Input:

```json
{
  "request_id": "eval-...",
  "expected_operational_state_token": "ost_...",
  "candidates": [
    {
      "client_ref": "candidate-b",
      "name": "Constrained line plan",
      "base_scenario_version_id": null,
      "changes": {
        "mixer_speed_bps": 9500,
        "packaging_speed_bps": 9000,
        "packaging_changeover_minutes": 15,
        "packaging_calibration": "enhanced"
      }
    }
  ]
}
```

The command layer expands each candidate to complete effective controls, removes no-ops, checks availability and the entire batch, reuses cached receipts, appends immutable nodes, and returns compact summaries plus the next state projection.

### 10.6 `compare_scenarios`

Comparison order must not create hidden anchor semantics. The response names the reference, computes pairwise deltas, identifies the Pareto set, applies the declared policy, and refuses a decision if any candidate is stale or incomparable under missing objectives.

### 10.7 `get_scenario_evidence`

The `detail` enum is intentionally small:

- `summary`;
- `constraints`;
- `proof`;
- `cost_ledger`;
- `invariants`;
- `ticks` with cursor and page size.

## 11. Standard response and recovery contract

Every tool result uses a closed, versioned envelope.

```json
{
  "schema_version": "factory-tools/v2",
  "status": "ok",
  "code": "OK",
  "request_id": null,
  "committed": false,
  "state": {
    "operational_state_token": "ost_...",
    "workspace_revision": 12,
    "event_cursor": 18
  },
  "data": {},
  "next": [
    {
      "tool": "evaluate_scenarios",
      "reason_code": "CANDIDATES_READY"
    }
  ]
}
```

Errors are equally actionable:

```json
{
  "schema_version": "factory-tools/v2",
  "status": "error",
  "code": "STALE_STATE",
  "request_id": "eval-42",
  "committed": false,
  "state": {
    "observed_operational_state_token": "ost_old",
    "current_operational_state_token": "ost_new",
    "event_cursor": 19
  },
  "data": {
    "changed_dimensions": ["locks", "clock"],
    "invalidated_candidate_refs": ["candidate-b"]
  },
  "recovery": {
    "tool": "get_state_delta",
    "arguments": { "from_event_cursor": 18 },
    "fresh_request_id_required_on_retry": true
  }
}
```

### 11.1 Error taxonomy

Target codes should reflect agent recovery categories:

- `STALE_STATE`;
- `CONTROL_UNAVAILABLE` with reason `HUMAN_LOCKED`, `PHASE_CLOSED`, or `UNSUPPORTED`;
- `VALIDATION_ERROR`;
- `IDEMPOTENCY_CONFLICT`;
- `NOT_FOUND`;
- `SEARCH_BUDGET_EXHAUSTED`;
- `ABORTED`;
- `INTERNAL_ERROR`.

Granular internal causes remain in `data`, but the top-level code tells the agent which recovery path applies.

## 12. Progressive disclosure and context economy

The agent should not pay repeatedly for information it already has.

- Planning context is compact and omits tick arrays and full ledgers.
- `ontology_version` and `ontology_hash` let the agent cache unchanged control semantics.
- State deltas contain only changed dimensions.
- Evaluation returns summaries and evidence handles, not complete receipts.
- Full evidence is fetched by section and ticks are paged.
- Batch evaluation accepts up to four candidates against one state token.
- Canonical input hashes eliminate duplicate simulation.
- Success responses return the exact next precondition and effective state, avoiding immediate read-after-write calls.

Initial targets:

- no more than four tool calls from cold start to a ranked recommendation;
- no more than three calls after a human intervention, including the rejected stale write;
- no duplicate evaluator execution for an identical normalized input hash;
- no hidden scenario deletion;
- no full receipt transfer unless explicitly requested.

## 13. Human-interface alignment

The UI must mirror the agent read model rather than summarize it differently.

- Resource and control labels use canonical IDs underneath.
- Locks show blocked controls, effective tick/window, and imposing human event.
- Scenario cards show scenario version, parent, source state, currentness reason, and receipt ID.
- A/B are visual pins onto immutable scenario nodes.
- The comparison table shows the active decision policy and Pareto status.
- The evidence dialog distinguishes `CURRENT`, `HISTORICAL`, and `INVALID` evidence.
- The revision ledger exposes the same event cursor and change reasons returned by tools.

The human remains able to use the normal interface without WebMCP. The agent remains unable to change human locks or external systems.

## 14. Safety and trust boundaries

- Treat tool definitions, arguments, names, and results as untrusted data.
- Validate from a descriptor snapshot and return frozen plain JSON.
- Bind every write to an operational state token and idempotency key.
- Validate an entire candidate batch before appending any node.
- Keep local planning mutations separate from machine or enterprise-system actions.
- Preserve exact source context for every receipt and proof.
- Never convert a stale result into a current decision through prose.
- Never infer permission from a control's presence in schema; use derived availability.
- Keep human lock controls out of the agent tool surface.

## 15. Agent trajectory evaluation

Unit correctness is necessary but insufficient. The target system needs model-in-the-loop trajectory evals.

### 15.1 Core scenarios

1. Cold start to feasible recommendation.
2. Human lock after the first comparison.
3. Lock plus phase change invalidating only part of a plan.
4. Malformed input corrected in one recovery step.
5. Repeated equivalent plan producing a cache hit.
6. Ten generations of branching without evidence loss.
7. Stale historical receipt never presented as current.
8. Incomplete frontier search never described as globally optimal.
9. Conflicting objectives producing a Pareto set rather than a false winner.
10. Tool result containing adversarial strings without changing authority or intent.

### 15.2 Metrics

- task success and exact constraint accuracy;
- currentness-statement accuracy;
- locked-control violation rate;
- tool calls and response bytes;
- redundant simulation count;
- recovery calls after stale state;
- correct policy winner / Pareto set;
- unsupported optimality claims;
- lineage and receipt provenance completeness.

## 16. Current v1 to target v2 mapping

| Current challenge primitive | Target abstraction |
| --- | --- |
| `get_factory_snapshot` | `get_planning_context` plus `get_state_delta` |
| `get_scenario_snapshot` | `get_scenario_evidence` summary/detail projections |
| `create_scenario` + `apply_scenario_changes` + `run_factory_simulation` | one transactional `evaluate_scenarios` call over immutable nodes |
| `compare_simulation_runs` | `compare_scenarios` with currentness, policy rank, and dominance |
| two mutable scenario slots | append-only scenario graph with A/B visual pins |
| factory/lock/scenario revision tuple | operational state token plus immutable scenario version |
| boolean source currentness | structured currentness with invalidation reasons |
| implicit tick-16 lock behavior | explicit clock and lock effective window |
| repeated simulation | canonical input cache and evidence reuse |

## 17. Architecture decisions

1. Keep exactly six public tools, but move composition into high-level intent tools.
2. Keep low-level command primitives internal for tests and modularity.
3. Introduce one generated control ontology before extending the tool surface.
4. Separate operational currentness from scenario-workspace growth.
5. Replace mutable slots with an immutable graph.
6. Make time and phase first-class.
7. Return a Pareto set unless an explicit policy permits ranking.
8. Make every response self-locating, verifiable, and recoverable.
9. Optimize for fewer calls and smaller projections before optimizing prose.
10. Preserve the submitted challenge build until the v2 profile passes its own live WebMCP replay.
