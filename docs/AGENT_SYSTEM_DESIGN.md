# Agentic Sandbox agent-system design

Status: normative target architecture for challenge-safe evolution of the Agentic Sandbox WebMCP interface.

Document roles:

- `docs/PRODUCT_BRIEF.md` defines the product promise and participant responsibilities.
- This document defines the durable agent-facing system model and contracts.
- `docs/AGENT_SYSTEM_HARDENING_PLAN.md` maps the audited current runtime to this target in implementation order.
- `docs/AGENT_EVAL_PLAN.md` defines the trajectories and release gates that prove the contract.
- `docs/DEMO_SCRIPT.md` freezes the OpenAI WebMCP Challenge story.

No target behavior in this document is an implementation claim until code, generated parity tests, visible UI evidence, and a public ChatGPT Site Tools replay agree.

## North star

Agentic Sandbox is not a dashboard with tools attached. It is a small shared decision protocol with two first-class projections over one canonical system:

- a human projection that makes intent, authority, time, evidence, and intervention visible;
- an agent projection that makes the same system legible, actionable, copyable, and verifiable through six narrow WebMCP tools.

Before every write, an agent should be able to answer without guessing:

1. What decision is the human asking me to support?
2. What exact outcome and hard constraints define success?
3. What model, mission, authority, and effective time am I acting on?
4. Which controls exist, what do their values mean, and which are available now?
5. What evidence already exists, where did it come from, and is it usable for the current decision?
6. Which exact preconditions can I copy into the next call?
7. Is my requested change a legal mutation, a semantic no-op, or an unavailable action?
8. Did the previous operation commit, and what changed because of it?
9. What is the cheapest safe next action that reduces uncertainty or advances the decision?
10. What claim is justified by the evidence: feasible, dominated, best evaluated, historical, invalid, or proven infeasible?

The system is:

- **agent-intuitive** when tool metadata and results make the correct next action obvious;
- **agent-ergonomic** when the action requires little memory, arithmetic, translation, or redundant reading;
- **agent-accretive** when each interaction leaves durable state or evidence that later turns can reuse.

## Preserve essential friction; remove accidental friction

The challenge build should not collapse into an opaque `optimize_factory`, frontier-search, or batch-evaluation tool. Some steps are the product because they preserve authority and make reasoning inspectable.

| Preserve: meaningful decision boundary | Remove: accidental interface burden |
| --- | --- |
| Read current state before writing | Renaming returned revisions before reuse |
| Explicit scenario hypotheses | Hidden ranges, units, ownership, phase, or lock scope |
| Explicit mutation before evaluation | Same-value writes that create revision churn |
| Deterministic simulation | Discovering phase rules only through failed evaluation |
| Comparison of immutable receipts | Model-side arithmetic for targets, slack, and dominance |
| Human-only lock intervention | Tiny or ambiguous lock scope and effective time |
| One intentional stale rejection | Accidental stale calls and incomplete recovery errors |
| Fresh read and clean post-lock branch | Carrying pre-lock Packaging overrides into recovery |
| Current proof | Historical or invalid evidence silently winning |

The goal is **fewest avoidable calls while retaining every meaningful intent, authority, hypothesis, mutation, evaluation, conflict, recovery, and proof boundary**.

## System-wide axioms

### Axiom 1 — one semantic meaning

Every public control has one canonical unit, domain, resource owner, application phase, evaluator operation, and lock scope. Schema, runtime validation, command availability, evaluator behavior, UI, tests, and documentation derive from or are checked against that definition.

An agent must never learn a system rule by passing one layer and failing another.

### Axiom 2 — zero hidden state

A Site Tool outcome cannot depend on unexposed presentation state such as selected scenario column, open modal, viewport, focus, hover, scroll, render order, Strict Mode, or HMR.

Every human action that changes legal agent behavior advances an exposed authority or decision-epoch identity.

### Axiom 3 — authority is explicit

Human locks are typed authority objects, not decorative booleans. They state owner, resource, blocked controls, revision, and effective simulation time. The agent has no lock, unlock, force, approve, or override capability.

### Axiom 4 — time is explicit

Collaborative planning time and simulated operational time are separate clocks. A visible lock event occurring now may be modeled as effective at a specified tick in a counterfactual shift; the system must not blur those statements.

### Axiom 5 — evidence is source-bound

A receipt is immutable, but its usability is relational. Currentness depends on its source model, mission, authority, time, ontology, evaluator, and scenario identity. Historical evidence remains truthful for its source and cannot silently become a current recommendation.

### Axiom 6 — truth dimensions are orthogonal

Execution validity, source currentness, hard-constraint feasibility, proof state, and decision relation are independent. A convenient summary may be derived from them but cannot hide one axis behind another.

### Axiom 7 — labels are not instructions

Human and agent supplied names are untrusted display text. They never influence routing, validation, ownership, evaluator behavior, currentness, comparison policy, or selection.

### Axiom 8 — successful use compounds

A valid interaction creates or refreshes a reusable artifact: decision context, scenario head, committed transition, receipt, comparison, or structured recovery state. Important evidence is never silently overwritten because a UI slot changes.

## The linked abstraction tower

```text
Human intent and intervention
            │
            ▼
1. Mission contract
   Objective · hard constraints · exact derived thresholds · selection policy
            │
            ▼
2. Semantic kernel
   Resources · controls · units · domains · ownership · phases · lock scope
            │
            ▼
3. Model and decision context
   Factory model · baseline · clock · bottlenecks · evidence index
            │
            ▼
4. Authority epoch
   Human locks · blocked controls · effective time · authority revision
            │
            ▼
5. Capability map
   Current values · availability · reasons · legal actions · continuation
            │
            ▼
6. Scenario lineage
   Immutable hypothesis head · normalized overrides · effective controls · parent
            │
            ▼
7. Idempotent command
   Narrow intent · exact preconditions · atomic commit · read-your-write result
            │
            ▼
8. Deterministic receipt
   Canonical input · exact counters · constraints · invariants · proof · source binding
            │
            ▼
9. Evidence and selection graph
   Currentness · comparisons · dominance · Pareto relation · policy-bounded claim
            │
            ▼
10. Shared projections
    WebMCP and human UI render the same consequential state and evidence
```

Human locks cut vertically through layers 4–10. They narrow capability, make prior scenario evidence historical, require a clean branch, and affect comparison eligibility. They never rewrite old receipts.

## Identity model

Keep the existing compatibility revisions, but do not conceptually collapse four different identities.

### Model identity

Represents the deterministic factory definition: assets, baseline controls, deliveries, physical constants, and evaluator assumptions.

A permission change does not pretend that the physical factory model changed.

### Authority identity

Represents the admissible action space: human locks, blocked controls, effective time, and authority revision.

### Workspace identity

Represents collaborative presentation and planning artifacts: scenario heads, A/B display pins, selected UI state, comparisons, and ledger events.

Workspace selection may change presentation; it must not change tool semantics.

### Evidence identity

Represents the assumptions required to interpret a receipt: canonical scenario input, source model, mission operands, authority/time, semantic-kernel version, and evaluator version.

A compact `decision_epoch_token` may compose model, mission, authority, effective-time, ontology, and evaluator identities. It must exclude irrelevant UI state.

## Agent operating loop

### 1. Orient once

Call `get_factory_snapshot` first. One result should contain enough authoritative context to understand:

- exact mission and derived thresholds;
- declared selection policy and allowed claim level;
- current model and authority identities;
- planning and simulation-time assumptions;
- current controls, units, domains, owners, phases, and availability;
- active human locks with blocked fields and effective time;
- baseline metrics and bottleneck evidence;
- current and historical evidence index;
- copy-ready preconditions for the next write.

The agent should not inspect the DOM or infer a rule from a failed command when the application already owns that fact.

### 2. Form one coherent hypothesis

A scenario represents one causal idea, not a bag of unrelated changes.

Examples:

- “Remove the Packaging bottleneck within the cost cap.”
- “Test whether supplier expedite adds output or only cost.”
- “Replan around human-locked Packaging using only currently available controls.”

### 3. Create a clean scenario head

`create_scenario` binds the hypothesis to the current decision epoch. UI pins A and B are presentation metadata, not durable identity.

Scenario allocation is deterministic and independent of which column the human selected: allocate the first empty pin by marker, otherwise replace the first historical head by marker, and return `WORKSPACE_FULL` without displacement when both heads are current. The factory snapshot exposes the next allocation before the write.

### 4. Apply bounded controls

`apply_scenario_changes` receives absolute values. Before commit, the command layer:

1. validates the closed input shape;
2. resolves each field through the semantic kernel;
3. normalizes values equal to effective state as semantic no-ops;
4. verifies availability of changed controls;
5. verifies factory, scenario, and lock preconditions;
6. commits all changed fields atomically or none.

The result distinguishes requested, changed, no-op, and blocked fields and returns copy-ready simulation continuation.

### 5. Produce deterministic evidence

`run_factory_simulation` evaluates the exact scenario head and stores a content-addressed receipt. The compact result contains decision-complete evidence; full tick detail remains stored for progressive inspection.

### 6. Discriminate, do not merely list

`compare_simulation_runs` names its baseline anchor, validates source currentness and execution validity, computes exact deltas and dominance, and applies only a declared selection policy.

The model explains the result. It does not secretly reproduce exact arithmetic or promote “best among evaluated” to “globally optimal.”

### 7. Treat conflict as information

When the human changes authority, one deliberate stale write fails atomically. The system must not refresh and replay behind the human's back.

The error states:

- `committed: false`;
- every mismatched expected/current precondition;
- which evidence became historical;
- the correct recovery read;
- whether a fresh request ID and fresh scenario are required.

### 8. Re-read and branch cleanly

After an authority change, the agent reacquires the current capability map and creates a fresh scenario from current effective controls. It does not merge new unlocked controls into a head that still contains inadmissible pre-lock Packaging overrides.

### 9. Explain only from eligible evidence

A final recommendation names the scenario version and receipt, states source currentness and execution validity, quotes exact constraint operands, names the comparison policy, and uses the strongest justified epistemic label—no stronger.

## Semantic-kernel contract

The target implementation owns a versioned control registry conceptually shaped like:

```json
{
  "control_id": "packaging_speed_bps",
  "resource_id": "packaging",
  "label": "Packaging speed",
  "value_type": "integer",
  "unit": "basis_points_of_nameplate",
  "domain": { "minimum": 5000, "maximum": 10000 },
  "application_phase": "runtime",
  "operation_kind": "SET_PACKAGING_SPEED",
  "operation_value_field": "valueBps",
  "lock_scope": "Packaging",
  "baseline_value": 7500
}
```

For the current challenge vocabulary:

| Control | Resource | Phase | Packaging lock |
| --- | --- | --- | --- |
| `mixer_speed_bps` | Mixer | runtime | not covered |
| `packaging_speed_bps` | Packaging | runtime | covered |
| `packaging_changeover_minutes` | Packaging | pre-shift | covered |
| `packaging_calibration` | Packaging | pre-shift | covered |
| `supplier_mode` | Supplier | pre-shift | not covered; phase may close |
| `quality_rate_units_per_hour` | Quality Gate | runtime | not covered |
| `warehouse_dock_units_per_hour` | Warehouse | runtime | not covered |

Speed values are basis points of equipment nameplate; `10000 = 100%`. The canonical public and evaluator range is 5,000–10,000.

## Capability-map contract

A JSON Schema defines a general value domain. Current capability requires an availability projection:

```json
{
  "control_id": "supplier_mode",
  "resource_id": "supplier",
  "current_value": "standard",
  "domain": { "enum": ["standard", "expedite"] },
  "application_phase": "pre_shift",
  "availability": {
    "status": "PHASE_CLOSED",
    "reason_code": "PRE_SHIFT_ONLY",
    "effective_tick": 16,
    "may_preserve_current_value": true
  }
}
```

Allowed statuses:

- `AVAILABLE`
- `HUMAN_LOCKED`
- `PHASE_CLOSED`
- `UNSUPPORTED`

An unavailable changed value is rejected before evaluator execution. An unavailable requested value already equal to the effective state is normalized as a no-op.

## Time and human-lock contract

The visible Packaging lock is a planning-time event. The current deterministic proof models its effect at simulation tick 16, or 240 minutes into the 64-tick shift.

```json
{
  "lock_id": "lock-packaging-l3",
  "authority": "human",
  "resource": "Packaging",
  "blocked_fields": [
    "packaging_speed_bps",
    "packaging_changeover_minutes",
    "packaging_calibration"
  ],
  "planning_event_id": "event-19",
  "simulation_effect": {
    "effective_tick": 16,
    "effective_elapsed_minutes": 240
  },
  "lock_revision": 3
}
```

One domain constant drives the store, evaluator, proof, Site Tool output, UI, tests, README, and demo script.

The product is a shared live **decision state**, not a live plant-control or telemetry surface.

## Decision-context contract

The target `get_factory_snapshot` result adds a compact context without removing compatibility fields:

```json
{
  "decision_epoch_token": "epoch-5",
  "continuation": {
    "factory_version_id": "factory-v5",
    "expected_factory_revision": 5,
    "expected_lock_revision": 3
  },
  "mission": {
    "objective": "maximize_good_output_subject_to_hard_constraints",
    "derived_targets": {
      "minimum_good_output_units": 10937,
      "maximum_total_cost_formula": "floor(baseline_total_cost_micro_eur * 108 / 100)",
      "maximum_defect_fraction": "186/9300",
      "maximum_asset_count_delta": 0
    },
    "selection_policy": [
      "CURRENT_AND_VALID",
      "ALL_HARD_CONSTRAINTS_PASS",
      "MAX_GOOD_OUTPUT",
      "MIN_TOTAL_COST",
      "MIN_DEFECT_RATE",
      "MIN_CHANGED_CONTROLS",
      "CANONICAL_ID"
    ]
  },
  "clock": {},
  "authority": {},
  "control_catalog": [],
  "baseline": {},
  "evidence_index": []
}
```

Continuation keys match write-input keys so the agent copies rather than translates state.

An optional future `known_state_token` may let the same tool return `full`, `delta`, or `not_modified` mode. A stale token informs recovery; it never authorizes an automatic replay.

## Scenario contract

A scenario is an immutable lineage of hypothesis heads:

```json
{
  "scenario_id": "scenario-c",
  "scenario_version_id": "scenario-c-v2",
  "display_pin": "B",
  "parent_scenario_version_id": null,
  "source_decision_epoch_token": "epoch-5",
  "base_factory_version_id": "factory-v5",
  "base_lock_revision": 3,
  "requested_overrides": {},
  "normalized_overrides": {},
  "normalized_no_op_fields": [],
  "effective_controls": {},
  "currentness": {
    "status": "CURRENT",
    "usable_for_current_decision": true,
    "invalidated_by": []
  }
}
```

Rules:

- creation begins from current effective controls;
- no-op-only applies do not create a new head or clear a receipt;
- authority changes freeze old heads as historical;
- recovery creates a clean head under the new epoch;
- display re-pinning never deletes evidence;
- replacement/allocation is deterministic and independent of selected UI state.

## Continuation and command contract

Every successful read or write returns the exact fields required by the most likely next call:

```json
{
  "factory_version_id": "factory-v5",
  "expected_factory_revision": 5,
  "expected_lock_revision": 3,
  "scenario_id": "scenario-c",
  "expected_scenario_revision": 2
}
```

A successful mutation additionally reports:

```json
{
  "committed": true,
  "requested_fields": ["mixer_speed_bps", "supplier_mode"],
  "changed_fields": ["mixer_speed_bps"],
  "normalized_no_op_fields": ["supplier_mode"],
  "blocked_fields": [],
  "continuation": {}
}
```

A no-op-only request returns `committed: false`, preserves scenario and receipt identity, and still provides continuation.

## Error and recovery contract

Expected errors are protocol results, not generic exceptions:

```json
{
  "schema_version": "factory-tools/v1",
  "status": "error",
  "code": "STALE_FACTORY",
  "request_id": "scenario-b-retry-02",
  "message": "The decision authority changed. No scenario changes were applied.",
  "data": {
    "committed": false,
    "precondition_diff": {
      "expected_factory_revision": 4,
      "current_factory_revision": 5,
      "expected_lock_revision": 2,
      "current_lock_revision": 3
    },
    "recovery": {
      "tool": "get_factory_snapshot",
      "arguments": {},
      "fresh_scenario_required": true,
      "fresh_request_id_required": true
    }
  }
}
```

All mismatches that can be safely disclosed are returned together. A command committed in the domain remains authoritative even if a later paint/visibility wait fails.

A future audit plane may record a rejected attempt, but it uses a separate audit revision and never makes `committed: false` ambiguous about operational or scenario state.

## Receipt contract

A receipt is the evidence unit. Its compact agent projection includes:

- run ID, content hash, input hash, evaluator and energy-model versions;
- source model, mission, authority/time, semantic-kernel, and scenario identities;
- exact metrics and baseline deltas;
- each hard constraint with `lhs`, `operator`, `rhs`, `unit`, `pass`, and exact slack;
- remaining bottlenecks;
- accepted/rejected operation audit;
- invariant results;
- proof metadata and exact inequality;
- five independent truth axes.

### Truth axes

```json
{
  "execution_validity": "VALID",
  "currentness": {
    "status": "CURRENT",
    "source_decision_epoch_token": "epoch-5",
    "current_decision_epoch_token": "epoch-5",
    "invalidated_by": []
  },
  "hard_constraint_state": "VIOLATED",
  "proof_state": "PROVEN_INFEASIBLE",
  "decision_relation": "UNCOMPARED"
}
```

Allowed conceptual values:

- execution: `VALID`, `INVALID_OPERATIONS`, `INVALID_INVARIANTS`;
- scenario-head currentness: `CURRENT`, `CURRENT_UNEVALUATED`, `HISTORICAL`; receipt currentness remains `CURRENT` or `HISTORICAL`;
- constraints: `ALL_PASS`, `VIOLATED`;
- proof: `NONE`, `INCONCLUSIVE_BOUND`, `PROVEN_INFEASIBLE`;
- relation: `UNCOMPARED`, `DOMINATED`, `NON_DOMINATED`, `POLICY_WINNER`, `BEST_EVALUATED_UNDER_POLICY`, `PROVEN_OPTIMAL`.

The existing `feasibilityStatus` may remain as a compatibility projection, but it is derived from the independent facts. A proof cannot hide invalid execution. `PROVEN_OPTIMAL` requires complete search or a named optimality proof.

No model-authored interpretation belongs inside the receipt.

## Evidence graph and trust partition

The application preserves:

- baseline receipt;
- immutable scenario versions;
- receipt-to-scenario/source relationships;
- authority invalidation relationships;
- comparisons and dominance edges;
- selection policy and justified claim level;
- current and historical evidence.

The bounded `evidence_index` is projected from immutable source-bound run evidence rather than only active scenario heads. A context-free agent can therefore recover displaced or superseded receipts without remembering a run ID or re-running a simulation.

Each entry structurally separates:

- authoritative deterministic facts;
- untrusted display labels.

A label that resembles a tool instruction, revision, metric, or proof remains inert text.

## Comparison contract

The current grammar makes the first `run_id` the anchor. That ordering is explicit in schema copy and result, and every delta is defined as candidate minus anchor:

```json
{
  "anchor_run_id": "factory-run-baseline",
  "candidate_run_ids": ["factory-run-a", "factory-run-b"],
  "eligible_current_run_ids": ["factory-run-a", "factory-run-b"],
  "historical_run_ids": [],
  "invalid_run_ids": [],
  "pareto_frontier_run_ids": ["factory-run-b"],
  "dominated": [
    {
      "run_id": "factory-run-a",
      "dominated_by": "factory-run-b",
      "reasons": ["same_good_output", "higher_total_cost"]
    }
  ],
  "selected_run_id": "factory-run-b",
  "claim_level": "BEST_EVALUATED_UNDER_POLICY"
}
```

Current selection rules:

1. source is current and execution is valid;
2. all hard constraints pass;
3. maximize good output;
4. minimize total cost;
5. minimize defect rate;
6. minimize changed controls;
7. stable canonical identifier as final tie-break.

Historical receipts may be compared for audit only and cannot produce an unlabeled current winner. Invalid receipts are diagnostic and cannot win.

## Tool ergonomics while retaining exactly six tools

| Tool | Agent question | Minimum sufficient behavior |
| --- | --- | --- |
| `get_factory_snapshot` | What decision world, authority, time, capability, and evidence exist now? | Return mission, derived targets, epoch, capability map, locks/time, baseline, evidence index, and continuation. |
| `get_scenario_snapshot` | What exactly is this hypothesis head, where did it come from, and is it usable now? | Return lineage, requested/normalized/effective controls, source binding, currentness reason, receipt summary, and continuation. |
| `create_scenario` | Create a clean hypothesis under the authority I currently hold. | Bind to supplied epoch, use deterministic UI pin/allocation semantics, preserve old evidence, and return continuation. |
| `apply_scenario_changes` | Commit these available absolute controls to this current head. | Normalize no-ops, reject unavailable changes before evaluation, commit atomically, and report requested/changed/no-op/blocked fields. |
| `run_factory_simulation` | What deterministically happens for this exact hypothesis? | Return compact source-bound receipt, exact slack, bottlenecks, operation/invariant audit, proof, truth axes, and continuation. |
| `compare_simulation_runs` | Which eligible evidence is feasible, dominated, or preferred under the declared policy? | Make anchor explicit; validate currentness/validity; return deltas, dominance, frontier, selection, and claim level. |

Tool descriptions state when to call, side effects, preconditions, normal failures, and the result-enabled next step. They never instruct the browser to trust arbitrary page text.

## Accretion model

Every useful interaction leaves one durable artifact:

- fresher decision context;
- immutable scenario head;
- committed state transition;
- content-addressed receipt;
- deterministic comparison;
- or structured recovery state.

Nothing important is silently overwritten:

- stale receipts become historical;
- A/B re-pinning does not delete scenario or evidence identity;
- currentness is computed from source binding;
- comparisons reference run IDs, not mutable labels;
- the human ledger and agent evidence index project the same typed events;
- conversation memory is optional because application evidence is recoverable.

## Resource-efficiency contract

Optimize in this order:

1. semantic correctness;
2. human-authority preservation;
3. evidence validity and currentness;
4. recovery correctness;
5. avoidable calls;
6. evaluator executions;
7. repeated bytes and model tokens.

Principles:

- one complete orientation read;
- copy continuations instead of translating revisions;
- compact decision-complete receipts;
- detailed ticks only on demand;
- normalize no-ops before commit;
- do not repeat deterministic arithmetic in model prose;
- do not re-run an identical canonical input;
- optional delta/not-modified reads only after correctness;
- no agent-only shadow state;
- no mega-tool that hides challenge boundaries.

### Minimal current traces

Initial two-scenario decision: exactly eight Site Tool calls—orient, create/apply/run twice, compare.

After the one intentional stale response: exactly four calls—refresh, create, apply, simulate.

A three-call recovery target conflicts with the public create/apply/run grammar and is not an optimization unless the product deliberately changes that grammar after the challenge.

## Shared human projection

The visible interface should expose the same consequential facts the agent receives:

- mission and exact thresholds;
- model and authority revisions;
- control availability and reason;
- human lock owner, blocked fields, and tick-16 / 240-minute effect;
- durable scenario identity and A/B display pin;
- requested versus effective overrides;
- current, historical, and invalid evidence with reason;
- independent validity, feasibility, proof, and decision-relation states;
- receipt and evaluator identity;
- declared comparison policy and justified claim level.

The human lock affordance must remain obvious at compressed demo scale. Status cannot rely on color alone.

## Challenge-safe evolution

Do not change in the submitted profile without a complete replay:

- exactly six top-level imperative tools;
- human-only lock/unlock;
- explicit create/apply/run boundaries;
- one visible stale rejection before recovery;
- deterministic receipts and `9252 < 10937` proof;
- no external side effects;
- visible revision and evidence trail.

Implementation order and current defects live in `docs/AGENT_SYSTEM_HARDENING_PLAN.md`.

Every code change requires:

- `npm run verify` from a clean checkout;
- generated control parity tests;
- applicable golden traces in `docs/AGENT_EVAL_PLAN.md`;
- exactly six discovered top-level tools;
- complete reset → two scenarios → compare replay;
- intentional stale rejection with no operational/scenario mutation;
- fresh authority read and clean post-lock branch;
- current proof and exact engine identity;
- visual inspection at recorded and compressed demo sizes;
- documentation/payload/UI agreement;
- recording compatibility decision.

## Non-goals for the challenge build

- embedded chatbot;
- public frontier-search, batch-evaluation, or optimizer mega-tool;
- agent-accessible lock, unlock, force, approve, or machine-control capability;
- external telemetry or plant integration;
- authentication or multi-factory administration;
- broad catalogues of weak tools;
- automatic stale-command replay;
- model-authored operational metrics or proofs;
- global-optimality claims from a bounded comparison;
- simultaneous v1 and experimental v2 tool profiles on one page.

## Product thesis

The deepest product idea is not factory simulation. It is **shared epistemic and operational control inside a visible decision system**:

- the human owns intent and authority;
- the semantic kernel owns what actions mean;
- the agent owns hypothesis formation and evidence navigation within current capability;
- deterministic software owns operational facts and proofs;
- immutable artifacts preserve what was known, attempted, rejected, compared, and proven;
- WebMCP makes the same system directly operable by the browser agent;
- the human interface makes every consequential transition inspectable and interruptible.

The system is maximally agent-friendly not when it removes every step, but when every necessary step is obvious, every accidental step disappears, and every claim has an inspectable source.