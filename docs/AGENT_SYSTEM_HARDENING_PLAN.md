# Agentic Sandbox agent-system hardening plan

Status: executable design delta from the verified challenge runtime to the normative architecture in `docs/AGENT_SYSTEM_DESIGN.md`.

This document does not replace the product brief, system design, or evaluation plan. It turns them into an ordered implementation program grounded in a code-level audit of the current `factory-tools/v1` runtime.

No target behavior described here is implemented merely because it is documented. A behavior becomes claimable only when code, generated contracts, tests, visible UI evidence, and a public ChatGPT Site Tools replay agree.

## Executive decision

Keep the challenge entry's current six public tools and its explicit evidence-producing workflow:

1. orient;
2. create a hypothesis;
3. apply bounded controls;
4. run the deterministic evaluator;
5. compare immutable evidence;
6. let the human change authority;
7. reject one stale command;
8. re-read, branch cleanly, and prove what remains possible.

Do **not** replace this flow before judging with a batch optimizer, frontier-search tool, separate delta tool, or new `factory-tools/v2` profile. Those ideas can reduce call count, but they also hide the exact boundaries the OpenAI WebMCP Challenge should make visible.

The hardening order is therefore:

1. **semantic integrity** — every layer agrees on what controls, time, authority, and evidence mean;
2. **agent ergonomics** — every legal next action is obvious and copyable;
3. **evidence accretion** — completed work remains discoverable and reusable;
4. **resource economy** — repeated bytes, arithmetic, reads, and simulations disappear;
5. **only then** consider a different public tool grammar after the challenge.

## Definition of done

A capable agent unfamiliar with the implementation can use only the six Site Tools and answer, before every write:

- What decision is being made?
- What exact state and authority epoch is current?
- What controls exist, what do their values mean, and which are available now?
- What evidence already exists, where did it come from, and is it usable for the current decision?
- What exact preconditions should be copied into the next call?
- Will the requested operation be a semantic no-op, a legal mutation, or an unavailable action?
- If the call fails, did anything commit and what single recovery action is correct?
- What claim is justified: feasible, best among evaluated candidates, dominated, historical, invalid, or mathematically proven infeasible?

The human can independently verify the same answers in the visible interface.

## The hardened synthetic system

```text
Human mission and intervention
            │
            ▼
1. Semantic kernel
   Resources · controls · units · domains · ownership · phases · lock scope
            │
            ▼
2. Decision epoch
   Model identity · mission · authority · effective time · ontology/evaluator versions
            │
            ▼
3. Capability projection
   Current values · availability · reason · legal next settings · copy-ready preconditions
            │
            ▼
4. Hypothesis graph
   Immutable scenario heads · normalized overrides · lineage · display pins
            │
            ▼
5. Command protocol
   Intent · idempotency · preconditions · atomic commit · read-your-write continuation
            │
            ▼
6. Deterministic evaluator
   Canonical input · exact counters · constraints · invariants · proof
            │
            ▼
7. Evidence and selection graph
   Receipts · currentness · comparisons · dominance · policy-bounded claim level
            │
            ▼
8. Shared projections
   WebMCP response and human UI render the same authority and evidence
```

Each layer may summarize the one below it, but it may not invent facts, silently reinterpret identifiers, or omit state that changes legal behavior.

## Four identities that must not be conflated

The current implementation uses factory, lock, scenario, and event revisions to protect writes. Keep those compatibility fields, but model four different identities explicitly:

### 1. Model identity

The deterministic factory definition: assets, baseline controls, deliveries, evaluator assumptions, and physical constants.

A human permission change does not rewrite the physical model.

### 2. Authority identity

The human-defined action boundary: active locks, blocked controls, effective time, and lock revision.

A lock changes authority even when the factory model is unchanged.

### 3. Workspace identity

The collaborative planning surface: scenario heads, UI pins, selected display state, comparisons, and ledger events.

Workspace changes must not silently change operational authority.

### 4. Evidence identity

The immutable combination that makes a receipt meaningful: canonical scenario input, model version, evaluator version, mission operands, authority/effective-time assumptions, and source revisions.

A receipt can remain truthful for its source identity while becoming historical for the current decision.

A compact `decision_epoch_token` may compose the model, mission, authority, clock, ontology, and evaluator identities. It must not include irrelevant UI selection or modal state.

## Zero-hidden-state invariant

No Site Tool result or mutation may depend on state that the tool interface does not expose.

Specifically, tool semantics must be independent of:

- which scenario column the human selected;
- which modal or evidence panel is open;
- viewport size, scroll position, focus, or hover state;
- React rendering order, Strict Mode, or HMR lifecycle;
- decorative UI labels;
- conversation-only memory held by the agent.

Every human action that changes legal agent behavior must advance an exposed revision or decision-epoch identity.

UI markers `A` and `B` are presentation pins, not durable scenario identity and not an implicit replacement policy. When the two-slot challenge workspace is full, `create_scenario` must follow a documented deterministic rule or fail with an explicit capacity response. It must never choose a replacement based on `selectedScenarioId`.

## Canonical semantic kernel

Create one versioned control registry, conceptually `CONTROL_DEFINITIONS`, from which the application derives:

- WebMCP JSON Schema properties;
- independent runtime validation;
- TypeScript control types;
- resource ownership;
- unit and meaning;
- minimum, maximum, or enum domain;
- pre-shift versus runtime application phase;
- evaluator operation kind and payload mapping;
- human-lock coverage;
- no-op equality;
- agent-facing capability metadata;
- UI labels and formatting;
- documentation tables and parity tests.

Example:

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

`10000` means 100% of equipment nameplate, not 100% of the baseline setting.

### Canonical challenge ownership

For the existing public vocabulary, use this ownership model unless every layer is renamed together:

| Control | Resource | Phase | Packaging lock blocks it? |
| --- | --- | --- | --- |
| `mixer_speed_bps` | Mixer | runtime | No |
| `packaging_speed_bps` | Packaging | runtime | Yes |
| `packaging_changeover_minutes` | Packaging | pre-shift | Yes |
| `packaging_calibration` | Packaging | pre-shift | Yes |
| `supplier_mode` | Supplier | pre-shift | No, but phase may make it unavailable |
| `quality_rate_units_per_hour` | Quality Gate | runtime | No |
| `warehouse_dock_units_per_hour` | Warehouse | runtime | No |

`packaging_calibration` already names a Packaging concept in the public contract and is blocked by the store's Packaging lock. The least disruptive challenge-safe correction is to make the evaluator attribute `SET_CALIBRATION` to Packaging as well.

## Temporal capability model

A schema describes the value domain. It does not by itself prove that a control is available **now**.

Every control projection should therefore include availability:

```json
{
  "control_id": "supplier_mode",
  "current_value": "standard",
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

The command layer must reject an unavailable **changed** control before evaluator execution. An unavailable field whose requested value equals the effective value is a semantic no-op and should be normalized away rather than creating a false error.

### Planning time versus simulation time

The visible lock click occurs in collaborative planning time. The deterministic counterfactual currently models the Packaging lock as effective at simulation tick 16, which is 240 minutes into a 16-hour shift.

Those are different clocks and must be named separately:

```json
{
  "planning_event": {
    "event_id": "event-19",
    "kind": "HUMAN_LOCK_ADDED"
  },
  "simulation_effect": {
    "effective_tick": 16,
    "effective_elapsed_minutes": 240,
    "tick_minutes": 15,
    "horizon_ticks": 64
  }
}
```

Use one domain constant for the lock-effective tick. The store, simulator, proof, tool output, UI, tests, README, and demo narration must derive from it.

Call the product a **shared live decision state**, not a live plant state. The app has no telemetry or machine-control integration.

## Capability projection

`get_factory_snapshot` should provide the minimum sufficient world model for planning in one call:

- exact mission and derived thresholds;
- model identity and current decision epoch;
- current controls and canonical meaning;
- availability, reason, and blocked fields for every control;
- active human locks and effective simulation time;
- baseline metrics and bottleneck evidence;
- current and historical evidence index;
- copy-ready write continuation.

The agent should never need to discover a legal range, owner, phase, lock scope, or unit by attempting a write or running the evaluator.

## Hypothesis and scenario model

A scenario is an immutable hypothesis head, not an editable table cell.

Target projection:

```json
{
  "scenario_id": "scenario-b",
  "scenario_version_id": "scenario-b-v2",
  "display_pin": "B",
  "parent_scenario_version_id": null,
  "source_decision_epoch_token": "epoch-4",
  "base_factory_version_id": "factory-v4",
  "base_lock_revision": 2,
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

- creation starts from the current effective controls;
- requested values equal to effective values become reported no-ops;
- a no-op-only apply does not increment scenario revision or clear a valid receipt;
- a human authority change freezes earlier heads as historical;
- a clean post-lock scenario starts from the new epoch and contains no inherited blocked override;
- the old head and receipt remain addressable;
- display re-pinning never deletes evidence;
- scenario allocation is deterministic and independent of human UI selection.

## Command protocol

Every successful mutation returns read-your-write state:

```json
{
  "committed": true,
  "requested_fields": ["mixer_speed_bps"],
  "changed_fields": ["mixer_speed_bps"],
  "normalized_no_op_fields": [],
  "cleared_receipt_id": null,
  "continuation": {
    "factory_version_id": "factory-v5",
    "expected_factory_revision": 5,
    "expected_lock_revision": 3,
    "scenario_id": "scenario-c",
    "expected_scenario_revision": 2
  }
}
```

A semantic no-op returns `committed: false`, explains why, preserves the scenario revision and receipt, and still returns a valid continuation.

Every expected write failure returns:

- `committed: false`;
- all mismatched expected/current preconditions, not only the first checked field;
- named unavailable or blocked controls;
- current decision epoch and continuation when safe;
- one canonical recovery tool and arguments;
- whether a fresh request ID and fresh scenario are required.

Do not auto-refresh and replay a stale write. The intentional stale rejection is part of the challenge product.

## Orthogonal receipt truth model

Do not force execution validity, source currentness, hard-constraint feasibility, proof state, and decision rank into one overloaded status.

Every receipt projection should expose five independent axes:

### 1. Execution validity

- `VALID`
- `INVALID_OPERATIONS`
- `INVALID_INVARIANTS`

### 2. Source currentness

- `CURRENT`
- `HISTORICAL`

Include source/current epoch identities and the event or dimension that invalidated current use.

### 3. Hard-constraint feasibility

- `ALL_PASS`
- `VIOLATED`

Include exact operands, pass/fail, and slack for every constraint.

### 4. Proof state

- `NONE`
- `INCONCLUSIVE_BOUND`
- `PROVEN_INFEASIBLE`

Include method, assumptions, source currentness, exact inequality, and proof version.

### 5. Decision relation

- `UNCOMPARED`
- `DOMINATED`
- `NON_DOMINATED`
- `POLICY_WINNER`
- `BEST_EVALUATED_UNDER_POLICY`
- `PROVEN_OPTIMAL`

`PROVEN_OPTIMAL` requires an exhaustive search or a named optimality proof. Comparing Scenario A and B justifies `BEST_EVALUATED_UNDER_POLICY`, not “globally optimal.”

The existing `feasibilityStatus` may remain as a compatibility summary, but it must be derived from these axes and must not hide invalid operations behind a proof label.

## Evidence binding and accretion

A receipt is immutable and content-addressed, but currentness is relational. Store enough source metadata with every run to answer:

- which scenario version produced it;
- which model, evaluator, mission, and authority epoch it assumes;
- whether those assumptions still match the current decision;
- which event made it historical;
- whether it remains comparable as historical evidence.

The bounded `evidence_index` should expose:

```json
{
  "run_id": "factory-run-...",
  "scenario_version_id": "scenario-b-v2",
  "display_label": "Scenario B",
  "label_trust": "UNTRUSTED_DISPLAY_TEXT",
  "source_decision_epoch_token": "epoch-4",
  "currentness": "HISTORICAL",
  "execution_validity": "VALID",
  "hard_constraints": "ALL_PASS",
  "proof_state": "NONE",
  "good_output_units": 11114,
  "total_cost_micro_eur": "45170508333"
}
```

Conversation memory is an optimization, never the only index. A new agent turn should recover stored evidence without re-running simulations.

### Rejected commands and audit accretion

A rejected write must mutate no operational or scenario state. A future audit record may still be appended to a separate audit plane if it has its own revision and the response explicitly says:

- `committed: false` for operational state;
- `audit_recorded: true` for observability.

Do not blur those two meanings in the challenge build.

## Trust partition

Tool output contains two different trust classes:

1. **authoritative deterministic facts** — revisions, control domains, counters, constraints, hashes, proof operands;
2. **untrusted display text** — user or agent supplied scenario names and labels.

Keep them structurally distinct. Display labels must never influence:

- resource ownership;
- tool routing;
- validation;
- evaluator behavior;
- currentness;
- comparison policy;
- final decision selection.

Adversarial scenario names are rendered as text, preserved for display, and ignored by the control plane.

## Comparison and selection contract

The current public grammar uses the first `run_id` as the comparison anchor. Make that ordering explicit in the schema description and result:

```json
{
  "anchor_run_id": "factory-run-baseline",
  "candidate_run_ids": ["factory-run-a", "factory-run-b"]
}
```

Before producing a current recommendation, comparison must verify each candidate's source binding.

- Current valid receipts may participate in current selection.
- Historical receipts may be compared for audit only and must be labeled historical.
- Invalid receipts are diagnostic and cannot win.
- Mixed-currentness input must never silently produce a current winner.

The challenge selection policy should be declared and deterministic:

1. source is current and execution is valid;
2. every hard constraint passes;
3. maximize good output;
4. minimize total cost;
5. minimize defect rate;
6. minimize number of changed controls;
7. stable canonical identifier as final tie-break.

The comparison result should return feasibility, exact deltas, dominance edges, Pareto frontier, policy ordering, and the justified claim level.

## Six-tool target contract

The public names remain unchanged for challenge compatibility.

| Tool | Minimum sufficient result | Forbidden hidden behavior |
| --- | --- | --- |
| `get_factory_snapshot` | Mission, derived targets, decision epoch, capability map, locks/time, baseline, evidence index, continuation | Omitting a rule the agent can discover only by failure |
| `get_scenario_snapshot` | Immutable head, lineage, requested/normalized/effective controls, currentness reason, receipt summary, continuation | Treating UI pin or selected column as durable identity |
| `create_scenario` | New clean head bound to current epoch, deterministic pin/allocation result, continuation | Choosing replacement from human selection state |
| `apply_scenario_changes` | Requested, changed, no-op, and blocked fields; atomic commit result; continuation | Incrementing revision for a semantic no-op or accepting phase-closed changes for later failure |
| `run_factory_simulation` | Compact receipt with five truth axes, exact constraints/slack, bottlenecks, audit, proof, source binding | Returning model-authored KPIs or hiding invalid operations behind feasibility |
| `compare_simulation_runs` | Explicit anchor, source-currentness validation, deltas, dominance, frontier, policy result, claim level | Selecting a historical/invalid run as current or implying global optimality |

Tool descriptions must tell the agent:

- when to call;
- what state changes;
- required preconditions;
- normal failure modes;
- what the result enables next.

## Minimal correct traces under the six-tool grammar

### Initial two-scenario decision

Exactly eight operational calls are sufficient and expected:

1. `get_factory_snapshot`;
2. `create_scenario` A;
3. `apply_scenario_changes` A;
4. `run_factory_simulation` A;
5. `create_scenario` B;
6. `apply_scenario_changes` B;
7. `run_factory_simulation` B;
8. `compare_simulation_runs` with baseline as anchor.

There should be no extra scenario read, factory read, validation error, stale error, duplicate simulation, or model-side arithmetic step.

### Human lock recovery

After the one intentional stale write, exactly four additional calls are sufficient and expected:

1. `get_factory_snapshot` to reacquire authority;
2. `create_scenario` under the new epoch;
3. `apply_scenario_changes` using only controls with `AVAILABLE` status;
4. `run_factory_simulation` to obtain the current lock-bound receipt.

A three-call budget would contradict the explicit create/apply/run boundaries unless a public tool contract were changed. Do not let an artificial metric pressure the design into hiding a meaningful step.

## Code-audit findings and required resolutions

| ID | Current seam | Agent failure mode | Required resolution | Priority |
| --- | --- | --- | --- | --- |
| S1 | WebMCP speed validation permits up to 15,000 bps while the evaluator accepts only up to 10,000 | A schema-valid action fails only during evaluation | Canonical range 5,000–10,000 everywhere; generate boundary tests | P0 |
| S2 | Speed schema copy says “basis points of baseline,” while evaluator semantics are basis points of nameplate | Agent forms the wrong physical model | Canonical unit `basis_points_of_nameplate`; update schema, UI help, and docs | P0 |
| S3 | Store/public contract treats calibration as Packaging; evaluator maps it to Quality Gate | Lock authority differs by layer | Make `packaging_calibration` Packaging-owned everywhere | P0 |
| S4 | Pre-shift controls can pass apply-time validation after tick 0 and fail later in simulation | Agent spends a write and evaluator run learning a hidden phase rule | Capability availability plus pre-evaluator command rejection; normalize unchanged values as no-ops | P0 |
| S5 | Packaging lock click is planning-time “now,” but proof assumes tick 16 | Agent and judge cannot explain where the bound comes from | One lock timing constant and explicit dual-clock projection | P0 |
| S6 | `create_scenario` replacement can depend on `selectedScenarioId` | Human UI selection silently changes tool outcome | Deterministic allocation independent of UI state or explicit capacity error | P0 |
| S7 | Existing scenario patches can retain pre-lock Packaging overrides after fresh unlocked fields are merged | “Replanned using only unlocked controls” can be false at input level | Freeze historical head and create clean post-lock scenario from current controls | P0 |
| S8 | Stored runs lack complete source-epoch binding in comparison | Historical feasible evidence can look current | Persist source identity/currentness and guard current selection | P0 |
| S9 | One `feasibilityStatus` conflates validity, feasibility, proof, and currentness | Invalid operations can be obscured by an attractive proof label | Five orthogonal truth axes with compatibility projection | P0 |
| S10 | Same-value applies increment revision and clear evidence | No-op calls create churn and repeated simulation | Normalize no-ops before commit and preserve revision/receipt | P1 |
| S11 | First comparison run is an implicit anchor in implementation but not explicit enough in schema | Agent may reverse comparison meaning | State anchor ordering in schema/title/output and test it | P1 |
| S12 | Errors stop at the first stale precondition and omit canonical recovery | Agent needs extra reads and inference | Complete precondition diff, `committed: false`, current continuation, one recovery directive | P1 |
| S13 | Evidence exists in run storage but is not a bounded recoverable index | Context loss causes duplicate work | Add evidence index with source, status, metrics, and handles | P1 |
| S14 | Quality Gate UI queue projection uses the downstream good queue rather than its packaged input queue | Human and agent projections can disagree about bottleneck evidence | Correct the UI projection and add view-model parity test | P1 |
| S15 | User-supplied labels and deterministic facts share one untyped output plane | Prompt-like labels can distract agent reasoning | Structural trust partition and adversarial-label evals | P1 |

## Implementation program

### Phase 0 — freeze and measure

- Preserve the production deployment and current six tool names.
- Snapshot descriptors, schemas, golden responses, call counts, and deterministic receipts.
- Record the current public replay as the rollback baseline.
- Do not mix an experimental tool profile into the challenge page.

### Phase 1 — semantic integrity foundation

Create the canonical control registry and derive schema/validation/evaluator mapping/lock scope from it.

Fix S1–S6 together because partial fixes create new disagreement:

- 5,000–10,000 bps range;
- nameplate unit semantics;
- Packaging calibration ownership;
- explicit phases and availability;
- one lock-effective-tick constant;
- UI-independent scenario allocation.

Acceptance:

- no value can pass public validation and fail because another layer uses a different range, owner, phase, unit, or lock scope;
- tool behavior is invariant under UI selection changes;
- current acceptance receipts remain byte-identical unless a deliberately corrected semantic input changes them.

### Phase 2 — authority, scenario, and currentness integrity

Fix S7–S9:

- decision epoch identity;
- clean scenario head after authority change;
- source binding for scenario and run evidence;
- structured currentness with invalidating event;
- five orthogonal receipt axes;
- current-selection guard.

Acceptance:

- no historical receipt can be presented as current;
- no blocked override survives a clean replan;
- proof, invalidity, and feasibility are independently visible.

### Phase 3 — copy-ready command protocol

Fix S10–S12:

- no-op normalization;
- `committed` on every operation;
- requested/changed/no-op/blocked fields;
- complete precondition diffs;
- one recovery object;
- continuations whose keys match the next input;
- explicit comparison anchor semantics.

Acceptance:

- the eight-call cold trace contains zero reconstructive reads;
- the four-call recovery trace contains zero guesswork or blocked fields;
- a same-value apply causes no revision or receipt churn.

### Phase 4 — accretive evidence and decision logic

Fix S13–S15:

- bounded evidence index;
- deterministic dominance and Pareto relations;
- declared selection policy and claim level;
- structural trust partition;
- corrected UI bottleneck projection;
- current/historical/invalid visual states.

Acceptance:

- a context-free agent can recover existing work without re-simulation;
- comparison never overclaims global optimality;
- adversarial labels cannot alter control or selection behavior.

### Phase 5 — resource optimization

Only after Phases 1–4 are green:

- optional `known_state_token` on `get_factory_snapshot`;
- `full`, `delta`, and `not_modified` response modes;
- compact default receipt projection with evidence handles;
- receipt reuse for equivalent canonical inputs;
- response-byte and token measurement.

Do not add new public tools for these optimizations before challenge judging.

### Phase 6 — visible challenge polish

- make the Packaging human-control affordance unmistakable at compressed video scale;
- show blocked controls and tick-16 / 240-minute effect;
- show why evidence is current or historical;
- expose the justified claim level;
- retain human-mode usability;
- preserve the exact stale rejection and proof sequence.

## Pull-request sequence

1. **semantic-kernel parity** — control definitions, range/unit/owner/phase/lock fixes, hidden-UI-state removal, generated tests;
2. **authority and currentness** — epoch identity, clean branches, source-bound receipts, orthogonal status axes;
3. **ergonomic envelopes** — no-op normalization, continuations, complete errors, explicit anchor;
4. **evidence accretion** — evidence index, dominance, policy claims, trust partition, UI parity;
5. **resource economy** — delta reads, compact projections, equivalent-input receipt reuse;
6. **live-host evidence** — model-in-the-loop traces, visual QA, public replay, and recording compatibility decision.

Each PR must be independently revertible. Do not bundle a public schema change with unrelated visual polish.

## Test and evaluation matrix

| Contract | Required automated evidence | Required live evidence |
| --- | --- | --- |
| Control domain parity | Generated boundary tests at 4,999 / 5,000 / 10,000 / 10,001 | Agent never attempts a schema-valid/evaluator-invalid speed |
| Ownership parity | One generated owner and lock-scope assertion per control | Packaging lock visibly blocks exactly its canonical fields |
| Phase availability | Pre-shift/runtime matrix and no-op cases | Locked recovery uses only `AVAILABLE` controls |
| Zero hidden state | Repeat tool trace under different UI selections and modal states | Identical tool outcomes and allocation |
| Clean authority branch | Source epoch and empty blocked override assertions | Historical old head plus current clean head |
| Source-bound currentness | Invalidation-event and comparison guard tests | Historical receipt cannot become current winner |
| Orthogonal truth axes | Invalid-operation, violated-constraint, and proven-bound fixtures | UI and tool result distinguish all axes |
| No-op normalization | Same-value apply leaves revisions and receipt unchanged | Agent sees no-op outcome without re-simulation |
| Recovery grammar | Error fixture contains complete diff and one next action | Four-call post-rejection recovery succeeds |
| Evidence accretion | Context-recovery test without simulation | Fresh agent turn reuses stored receipts |
| Trust partition | Prompt-like scenario-name tests | Labels render but never alter selection or tool routing |
| Claim discipline | Comparison fixtures for dominated, tied, best-evaluated, and proof cases | Agent never says “optimal” without completeness evidence |

## Resource budgets

Correctness and authority come first. Once semantic gates pass, target:

- exactly 8 tool calls for the initial two-scenario decision;
- exactly 1 intentional stale write and 0 accidental stale writes;
- exactly 4 calls after the stale response to a current post-lock receipt;
- 0 avoidable validation errors;
- 0 locked or phase-closed changed controls after an orientation read;
- 2 evaluator executions for the initial alternatives and 1 for the locked replan;
- 0 duplicate evaluator executions for an identical canonical input;
- 0 final numeric claims invented or recomputed from model intuition;
- 0 full re-reads after delta mode is implemented and a retained token is available.

Track response bytes, repeated stable bytes, and model tokens, but do not set a size cap until the complete authoritative context is measured. Shrinking an incomplete response is not an optimization.

## Challenge cut line

Before judging, merge runtime changes only when all of the following are true:

- backwards compatible with the recorded evaluator prompts;
- preserves exactly six public tools;
- preserves explicit create/apply/run boundaries;
- preserves the one intentional stale write;
- preserves human-only lock authority;
- preserves deterministic receipts and `9252 < 10937`;
- passes `npm run verify`;
- passes every applicable agent trajectory;
- passes visual QA at the recorded viewport and compressed video scale;
- passes a complete public ChatGPT Site Tools replay;
- does not make the existing video materially false.

A theoretically cleaner design that cannot clear this gate stays documented until after the challenge.

## File-level target map

| Concern | Primary target |
| --- | --- |
| Semantic kernel | `src/domain/control-definitions.ts` plus generated adapters |
| Lock timing and phases | `src/domain/constants.ts`, domain types, command availability service |
| Decision epoch | `src/app/decisionEpoch.ts` |
| Scenario lineage | dedicated scenario repository/service rather than UI-selected allocation inside the store |
| Evidence binding | run records containing source epoch and scenario version |
| Command responses | `src/app/commandBus.ts`, `src/webmcp/contracts.ts`, tool projections |
| Schema and validation | generated from canonical definitions with independent hostile-shape validation retained |
| Comparison | deterministic comparison service with currentness guard and policy result |
| UI projection | lock card, currentness reasons, status axes, corrected queue projection |
| Agent evals | current Vitest suites plus trace fixtures and public replay checklist |

Module names are proposals. Ownership boundaries are normative.

## Non-goals for the challenge build

- embedded chat;
- model-authored optimization or KPIs;
- a public frontier-search mega-tool;
- batch evaluation that hides hypothesis/mutation/simulation boundaries;
- agent-accessible lock, unlock, force, approve, or machine control;
- external plant integrations, authentication, or multi-factory administration;
- twelve overlapping v1/v2 tools on one page;
- global-optimality claims from a bounded two-scenario comparison;
- automatic stale-command replay.

## Final product thesis

Agentic Sandbox should feel less like an API over a dashboard and more like a small, coherent scientific instrument for shared decisions:

- the human defines intent and authority;
- the agent forms hypotheses and navigates evidence;
- the semantic kernel defines what actions mean;
- deterministic software computes consequences and proofs;
- immutable evidence preserves history;
- WebMCP makes that same system directly operable by the agent;
- the visible interface lets the human inspect and interrupt it.

The system is maximally agent-friendly not when it removes every step, but when every necessary step is obvious, every accidental step disappears, and every claim has an inspectable source.