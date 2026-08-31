# Agentic Sandbox — agent contract

Status: normative contract for the target `factory-tools/v2` profile. `AGENT_SYSTEM_DESIGN.md` explains the architecture; `AGENT_ERGONOMICS_IMPLEMENTATION_PLAN.md` defines the migration.

This document is written from the consuming agent's point of view. A conforming implementation makes every legal decision path discoverable from tool definitions and returned data. It does not require private knowledge of UI components, store layout, simulator internals, or demo choreography.

## 1. Contract goals

The interface must let an agent answer five questions with minimal work:

1. **What is true now?**
2. **What am I allowed to change, at what effective time, and why?**
3. **What outcome is required and how is “best” selected?**
4. **What evidence already exists and can be reused?**
5. **What is the cheapest correct next action?**

The contract is successful when the agent can maintain a compact, correct world model instead of reconstructing one from tool failures.

## 2. Normative vocabulary

### 2.1 State identities

- `operational_state_token`: authority token for the live decision context.
- `workspace_revision`: revision of appended scenarios, comparisons, and decisions.
- `event_cursor`: cursor in the operational event stream.
- `planning_epoch_id`: identity of the collaborative planning session.
- `ontology_version`: semantic version of resources and controls.
- `evaluator_version`: deterministic model version.

### 2.2 Evidence identities

- `scenario_version_id`: immutable normalized plan node.
- `receipt_id`: content-addressed deterministic evaluation.
- `comparison_id`: immutable comparison over a declared candidate set and policy.
- `decision_id`: immutable selected recommendation with its evidence bundle.

### 2.3 Currentness

`CURRENT` means evidence was produced under the current operational state and evaluator semantics.

`HISTORICAL` means evidence remains truthful for its source state but cannot support a current recommendation without reevaluation.

`INVALID` means the evaluator rejected the input or an invariant failed; it is diagnostic evidence, not a candidate outcome.

## 3. Canonical control model

Every control returned by the system has this shape:

```json
{
  "control_id": "packaging_speed_bps",
  "resource_id": "packaging",
  "label": "Packaging speed",
  "value_type": "integer",
  "unit": "basis_points_of_nameplate",
  "domain": { "minimum": 5000, "maximum": 10000 },
  "current_value": 7500,
  "application_phase": "runtime",
  "availability": {
    "status": "HUMAN_LOCKED",
    "reason_code": "RESOURCE_LOCK",
    "effective_tick": 16,
    "lock_event_id": "event-19"
  }
}
```

Allowed availability values:

- `AVAILABLE`
- `HUMAN_LOCKED`
- `PHASE_CLOSED`
- `UNSUPPORTED`

A control's presence in a schema does not imply current availability. The planning context is authoritative.

## 4. Mission and selection model

The mission response contains both exact constraints and human-readable intent.

```json
{
  "mission_id": "challenge-mission/v1",
  "mission_version": 1,
  "intent": "Increase good output by at least 20% without more than 8% additional cost, a defect-rate increase, or a new machine.",
  "hard_constraints": [
    {
      "code": "OUTPUT_20",
      "lhs_metric": "good_output_units",
      "operator": ">=",
      "rhs": "10937",
      "unit": "units"
    }
  ],
  "selection_policy": {
    "policy_id": "challenge-lexicographic/v1",
    "kind": "lexicographic",
    "order": [
      "CURRENT_AND_VALID",
      "ALL_HARD_CONSTRAINTS_PASS",
      "MAX_GOOD_OUTPUT",
      "MIN_TOTAL_COST",
      "MIN_DEFECT_RATE",
      "MIN_CHANGED_CONTROLS",
      "CANONICAL_HASH"
    ]
  }
}
```

A tool may return `policy_rank` only when it names the policy. Without a policy it returns Pareto relationships only.

## 5. Standard envelope

Every tool returns a closed `factory-tools/v2` envelope.

```json
{
  "schema_version": "factory-tools/v2",
  "status": "ok",
  "code": "OK",
  "request_id": null,
  "committed": false,
  "state": {
    "operational_state_token": "ost_sha256...",
    "workspace_revision": 12,
    "event_cursor": 19
  },
  "data": {},
  "next": []
}
```

### 5.1 Required semantics

- `committed` is `true` only when this call appended visible workspace state.
- Read tools always return `committed: false`.
- A failed write always returns `committed: false`.
- `state` locates the response in the shared system.
- `next` contains zero or more legal, useful continuations. It is advisory, not an authority escalation.
- Unexpected faults never expose stack traces, secrets, or raw exception messages.

## 6. Tool 1 — `get_planning_context`

### Intent

Obtain the minimum sufficient authoritative model for planning.

### Input

```json
{}
```

### Required output sections

- `state_identity`
- `clock`
- `mission`
- `controls`
- `locks`
- `baseline_summary`
- `bottlenecks`
- `scenario_summary`
- `reusable_evidence`
- `detail_capabilities`

### Clock example

```json
{
  "planning_epoch_id": "epoch-1",
  "tick_minutes": 15,
  "simulation_horizon_ticks": 64,
  "current_tick": 16,
  "elapsed_minutes": 240,
  "evaluation_start_tick": 16,
  "phase": "IN_SHIFT"
}
```

### Agent guarantee

After this read, an agent can construct candidate changes without attempting a locked, phase-closed, out-of-domain, or unsupported control.

## 7. Tool 2 — `get_state_delta`

### Intent

Refresh only the part of the world model that changed.

### Input

One of:

```json
{ "from_event_cursor": 18 }
```

or

```json
{ "from_operational_state_token": "ost_old" }
```

Exactly one locator is required.

### Output

- ordered typed events;
- changed state dimensions;
- changed controls and availability;
- invalidated scenario versions and reasons;
- new token/cursor;
- `full_refresh_required`.

### Compaction

If the cursor predates retained event history, return `full_refresh_required: true` and recommend `get_planning_context`.

## 8. Tool 3 — `search_plan_frontier`

### Intent

Use deterministic bounded search and cached evidence to propose promising, non-dominated candidates without appending scenario state.

### Input

```json
{
  "operational_state_token": "ost_...",
  "search_budget": {
    "max_candidates_evaluated": 64,
    "max_candidates_returned": 4
  },
  "control_ids": [
    "mixer_speed_bps",
    "quality_rate_units_per_hour",
    "warehouse_dock_units_per_hour"
  ],
  "policy_id": "challenge-lexicographic/v1"
}
```

### Required output

- candidate specs with stable `client_ref`;
- controls searched and domains considered;
- cache hits and new evaluator executions;
- Pareto status;
- policy rank when supplied;
- lower/upper bounds where available;
- `search_complete` and exact search-space/budget statement.

### Honesty rule

`search_complete: false` prohibits “globally optimal.” The strongest allowed claim is “best among evaluated candidates under policy X.”

## 9. Tool 4 — `evaluate_scenarios`

### Intent

Atomically normalize, append, and evaluate one to four candidate plans under one operational state.

### Input

```json
{
  "request_id": "eval-2026-08-31-001",
  "expected_operational_state_token": "ost_...",
  "candidates": [
    {
      "client_ref": "standard-plan",
      "name": "Constrained standard-supplier plan",
      "base_scenario_version_id": null,
      "changes": {
        "mixer_speed_bps": 9500,
        "packaging_speed_bps": 9000,
        "packaging_changeover_minutes": 15,
        "packaging_calibration": "enhanced",
        "supplier_mode": "standard"
      }
    }
  ]
}
```

### Batch semantics

- Validate the entire request before any graph append or evaluator execution.
- All candidates share the same expected operational state.
- `client_ref` is unique within the request and echoed in output.
- A candidate's base is immutable. Omitted base means the current operational controls.
- Expand to complete effective controls.
- Remove no-op values before availability checks that would otherwise reject an unchanged setting.
- Reject an unavailable changed control before evaluator execution.
- Reuse a receipt for an equivalent canonical input.
- Append immutable scenario nodes only after validation succeeds.

### Success output per candidate

```json
{
  "client_ref": "standard-plan",
  "scenario_version_id": "scenario-sha256...",
  "parent_scenario_version_id": null,
  "requested_changes": {},
  "normalized_changes": {},
  "normalized_no_op_controls": ["supplier_mode"],
  "effective_controls": {},
  "input_hash": "...",
  "receipt_id": "factory-run-...",
  "cache_hit": false,
  "currentness": {
    "status": "CURRENT",
    "usable_for_current_decision": true,
    "invalidated_by": []
  },
  "summary": {
    "feasibility": "FEASIBLE",
    "all_hard_constraints_pass": true,
    "good_output_units": 11114,
    "total_cost_micro_eur": "45170508333",
    "bad_units": 226
  },
  "evidence_available": ["constraints", "cost_ledger", "invariants", "ticks"]
}
```

### Idempotency

- Successful same-key/same-payload replay returns the committed outcome.
- Same key with different payload returns `IDEMPOTENCY_CONFLICT`.
- Failed or aborted operations do not reserve a key permanently.
- A replay reports currentness against the live state without rewriting the immutable receipt.

## 10. Tool 5 — `compare_scenarios`

### Intent

Compare explicit scenario versions under an explicit policy or return their Pareto relationships.

### Input

```json
{
  "operational_state_token": "ost_...",
  "scenario_version_ids": ["scenario-1", "scenario-2"],
  "policy_id": "challenge-lexicographic/v1"
}
```

### Rules

- Input order is not an implicit anchor or preference.
- Every scenario must be evaluated and current for a current decision comparison.
- Historical comparisons are allowed only when `allow_historical: true` is explicitly added to the future contract; they never produce a current recommendation.
- Return pairwise metric deltas, hard constraints, dominance edges, Pareto set, policy rank, and selection rationale.
- A tie is explicit.
- A missing objective produces `INCOMPARABLE` rather than a fabricated winner.

### Output claim levels

- `FEASIBLE`
- `NON_DOMINATED`
- `POLICY_WINNER`
- `BEST_EVALUATED_UNDER_POLICY`
- `PROVEN_OPTIMAL` only with a complete search/proof reference

## 11. Tool 6 — `get_scenario_evidence`

### Intent

Fetch only the evidence detail needed for verification or explanation.

### Input

```json
{
  "scenario_version_id": "scenario-...",
  "detail": "constraints"
}
```

Allowed details:

- `summary`
- `constraints`
- `proof`
- `cost_ledger`
- `invariants`
- `ticks`

For ticks:

```json
{
  "scenario_version_id": "scenario-...",
  "detail": "ticks",
  "cursor": null,
  "page_size": 8
}
```

### Output

Every detail response includes receipt ID, evaluator version, source state token, currentness, and detail-specific data. Tick pages include a next cursor.

## 12. Recovery contract

Every recoverable error includes one canonical recovery object.

```json
{
  "status": "error",
  "code": "STALE_STATE",
  "committed": false,
  "state": {
    "observed_operational_state_token": "ost_old",
    "current_operational_state_token": "ost_new",
    "event_cursor": 19
  },
  "data": {
    "changed_dimensions": ["locks", "clock"]
  },
  "recovery": {
    "tool": "get_state_delta",
    "arguments": { "from_event_cursor": 18 },
    "fresh_request_id_required_on_retry": true
  }
}
```

### Error taxonomy

| Code | Meaning | Normal recovery |
| --- | --- | --- |
| `STALE_STATE` | Authority token no longer current | Read delta, replan affected controls, use fresh request ID |
| `CONTROL_UNAVAILABLE` | Changed control is locked, phase-closed, or unsupported | Remove/replace named changes; do not blind retry |
| `VALIDATION_ERROR` | Input violates the closed contract | Correct listed fields |
| `IDEMPOTENCY_CONFLICT` | Request ID reused for different intent | New request ID after intent is settled |
| `NOT_FOUND` | Named immutable object does not exist or is outside retained projection | Refresh context or correct ID |
| `SEARCH_BUDGET_EXHAUSTED` | Requested completeness impossible under budget | Increase budget or accept bounded result |
| `ABORTED` | Operation cancelled before commit | Retry only when still desired and state remains current |
| `INTERNAL_ERROR` | Sanitized unexpected fault | Do not assume state changed; refresh before retry if needed |

## 13. Currentness contract

Every scenario and receipt projection carries:

```json
{
  "status": "HISTORICAL",
  "source_operational_state_token": "ost_old",
  "current_operational_state_token": "ost_new",
  "invalidated_by": [
    {
      "event_id": "event-19",
      "reason_code": "LOCK_ADDED",
      "changed_dimension": "locks",
      "resource_id": "packaging"
    }
  ],
  "usable_for_current_decision": false
}
```

The implementation must never silently upgrade historical evidence to current. Reusing a cached receipt is allowed only when the canonical evaluator context matches; otherwise the scenario needs a new receipt.

## 14. Evidence and proof semantics

- Metrics are computed by deterministic software, never accepted from model prose.
- Constraint results include exact operands.
- Infeasibility requires a named proof method and exact bound.
- A proof is current only when its source state and relevant assumptions remain current.
- An unproven bound is labeled `INCONCLUSIVE`.
- Invariant failure makes the receipt `INVALID` regardless of attractive metrics.
- A fatal rejected operation makes the plan invalid; impossible operations should normally have been blocked before evaluator invocation.

## 15. Context-economy contract

- The planning context omits tick traces and full ledgers.
- Ontology content is versioned and hashable so unchanged definitions can be cached.
- Delta reads do not repeat the baseline.
- Evaluation summaries include evidence handles, not complete receipts.
- Tick traces are paged.
- One evaluation handles multiple candidates.
- Equivalent inputs reuse receipts.
- Successful writes return their effective plan and next precondition.

Target budgets:

- <=4 calls from cold start to ranked recommendation;
- <=3 calls in the complete stale-write and recovery path;
- zero duplicate evaluator executions for one canonical input hash;
- no full receipt unless explicitly requested.

## 16. Reference trajectories

### 16.1 Cold start

1. `get_planning_context`
2. optional `search_plan_frontier`
3. `evaluate_scenarios`
4. `compare_scenarios`

### 16.2 Human interruption

1. `evaluate_scenarios` returns `STALE_STATE`, committed false
2. `get_state_delta`
3. `evaluate_scenarios` with only currently available changed controls

### 16.3 Explain recommendation

1. Use comparison summary for the decision
2. Call `get_scenario_evidence` only for the proof or exact ledger requested by the human

## 17. Compatibility and profile isolation

The current challenge profile remains `factory-tools/v1`. A deployment registers exactly one profile:

- `challenge-v1`: submitted six low-level tools and current replay;
- `agent-native-v2`: six intent-level tools defined here.

No production page exposes both profiles simultaneously. Profile selection is explicit, tested, and visible in diagnostics.

## 18. Conformance checklist

A v2 implementation conforms only when:

- every control semantic comes from one registry;
- planning context makes all current action availability explicit;
- time and lock effectiveness are explicit;
- all writes use operational state tokens;
- all writes are atomic and idempotent;
- all successes are read-your-write;
- all recoverable failures prescribe one legal recovery;
- scenarios and evidence are immutable and append-only;
- comparisons have no hidden positional semantics;
- policy rank and Pareto status are distinct;
- incomplete search never claims global optimality;
- verbose evidence is progressive;
- exactly six tools are registered;
- the human interface projects the same state and authority model.
