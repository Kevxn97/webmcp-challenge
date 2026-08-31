# Agentic Sandbox agent-system design

Status: normative target design for challenge-safe evolution of the Agentic Sandbox WebMCP interface.

`docs/PRODUCT_BRIEF.md` defines the product promise. This document defines the agent-facing system contract. `docs/AGENT_EVAL_PLAN.md` defines how that contract is tested. No target behavior in this document should be described as implemented until its code, tests, live replay, and visible UI evidence all agree.

## North star

Agentic Sandbox is not a dashboard with tools attached. It is a shared, versioned decision protocol with two projections over one application state:

- a human projection that makes intent, authority, evidence, and intervention visible;
- an agent projection that makes the same state legible, actionable, and verifiable through six narrow WebMCP tools.

Before every write, an agent should be able to answer seven questions without guessing:

1. What outcome is the human asking for, and what counts as success?
2. What factory state and authority epoch am I acting on?
3. Which controls exist, what do their values mean, and which are currently writable?
4. What evidence already exists, and which evidence is still current?
5. Which exact preconditions can I copy into the next call?
6. Did the last operation commit, and what changed because of it?
7. What is the cheapest safe next action that reduces uncertainty or advances the decision?

The system is agent-intuitive when those answers are obvious from tool metadata and results. It is agent-ergonomic when the answers require little memory, arithmetic, payload reconstruction, or redundant reading. It is agent-accretive when every successful interaction leaves durable state or evidence that future calls can reuse.

## Preserve essential friction; remove accidental friction

The challenge build should not collapse the workflow into an opaque `optimize_factory` tool. Some friction is the product because it preserves human authority and inspectable reasoning.

| Preserve: essential decision friction | Remove: accidental interface friction |
| --- | --- |
| Read current state before acquiring authority to write | Renaming returned revisions before they can be reused |
| Explicit scenario branches | Hidden control ranges, timing rules, and resource ownership |
| Optimistic concurrency and stale-write rejection | Repeating an unchanged baseline on every recovery read |
| Human-only locks | Ambiguous lock scope or effective time |
| Deterministic simulation rather than model-authored KPIs | Errors that identify only the first mismatch and omit recovery guidance |
| Immutable receipts and currentness checks | Recomputing exact targets, cost caps, or comparison dominance in model prose |
| A visible human interruption | Carrying stale scenario overrides into a supposedly clean replan |

The design goal is therefore not “fewest possible calls at any cost.” It is **fewest avoidable calls while retaining every meaningful state, authority, and evidence boundary**.

## The linked abstraction tower

```text
Human intent
    │
    ▼
1. Mission contract
   Exact objective, hard constraints, tie-breakers, derived thresholds
    │
    ▼
2. Decision context
   Current factory state, operational clock, bottleneck, evidence index
    │
    ▼
3. Authority epoch
   Factory version + factory revision + lock revision + human lock contract
    │
    ▼
4. Capability map
   Controls, units, legal values, timing, resource ownership, writability
    │
    ▼
5. Scenario lineage
   Immutable hypothesis head bound to one authority epoch
    │
    ▼
6. Idempotent command
   Narrow mutation + exact preconditions + atomic commit result
    │
    ▼
7. Deterministic receipt
   Content-addressed consequences, constraints, invariants, diagnostics, proof
    │
    ▼
8. Evidence graph
   Historical and current receipts, comparisons, dominance, provenance
    │
    ▼
9. Shared decision projection
   The same revisions and evidence rendered to human and agent
```

Human locks cut vertically through layers 3–9. They change the authority epoch, narrow the capability map, make prior scenario evidence historical, and force a new branch. They never rewrite old evidence.

## The agent operating loop

### 1. Orient once

Call `get_factory_snapshot` first. One response should be enough to understand:

- the exact mission and derived success thresholds;
- the current state/authority token;
- the current controls and legal action space;
- active human locks, including blocked fields and effective time;
- the baseline, binding bottleneck, and existing evidence;
- copy-ready preconditions for the next write.

The agent should not need to inspect the visible DOM to recover any operational fact already owned by the application.

### 2. Form an explicit hypothesis

Create a scenario for one coherent causal idea, not a bag of unrelated changes. The scenario is a named, versioned hypothesis bound to the current factory version and lock revision.

Examples:

- “Remove Packaging bottleneck within cost cap.”
- “Test whether supplier expedite adds output or only cost.”
- “Replan around human-locked Packaging using only upstream controls.”

### 3. Apply bounded controls

Apply absolute settings through `apply_scenario_changes`. The tool should make three things unambiguous:

- which fields were requested;
- which fields actually committed;
- which continuation object can be copied into simulation.

A write response should never be a bare acknowledgement.

### 4. Produce evidence

Run `run_factory_simulation`. The response should expose the smallest complete decision receipt:

- immutable run and input identifiers;
- source currentness;
- exact mission constraints and slack;
- output, cost, defect, and asset results;
- remaining bottlenecks;
- accepted and rejected operations;
- an infeasibility proof when one exists;
- continuation metadata for any safe follow-up.

Detailed tick evidence remains stored and inspectable, but the default response should not force the agent to ingest 64 ticks when a compact receipt proves the decision.

### 5. Discriminate, do not merely list

Call `compare_simulation_runs` with the baseline as the first, explicitly documented anchor and candidate receipts after it. The deterministic comparison layer should identify:

- feasible and infeasible runs;
- exact deltas from the anchor;
- dominated alternatives;
- the Pareto frontier;
- the lowest-cost feasible run under a declared tie-break rule.

The model then explains the decision. It should not be responsible for silently performing exact arithmetic that the application can compute deterministically.

### 6. Treat conflict as information

When the human changes a lock, the next stale write should fail visibly and atomically. The system must not auto-refresh and silently replay the command because that would erase the challenge’s signature interaction.

The error should say:

- `committed: false`;
- which expected and current preconditions differ;
- which evidence became historical;
- which read tool restores authority;
- whether a fresh scenario branch is required.

### 7. Re-read incrementally and branch cleanly

After an authority change, the agent should re-read the factory and create a new scenario bound to the new epoch. It should not mutate a scenario whose base factory version predates the human decision.

The old scenario remains part of the evidence graph. The new scenario may cite it as a parent hypothesis, but it starts from current controls and contains only currently admissible overrides.

### 8. Explain only from current evidence

A final recommendation must name the receipt used, state whether its source is current, quote exact constraint operands, and distinguish:

- feasible;
- not feasible among attempted scenarios;
- mathematically proven infeasible under the active lock.

Those are different epistemic states and must never be collapsed into one label.

## Agent-facing contracts

### Decision context contract

The target `get_factory_snapshot` result should add a compact decision context without removing the current fields:

```json
{
  "state_token": "factory-v5:f5:l3:e12",
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
    "tie_breakers": [
      "fewest_constraint_violations",
      "lowest_total_cost",
      "fewest_changed_controls"
    ]
  },
  "authority": {
    "locks": [],
    "writable_fields": [
      "mixer_speed_bps",
      "packaging_speed_bps",
      "packaging_changeover_minutes",
      "packaging_calibration",
      "supplier_mode",
      "quality_rate_units_per_hour",
      "warehouse_dock_units_per_hour"
    ]
  },
  "control_catalog": [],
  "evidence_index": []
}
```

The continuation keys deliberately match write-input keys. The agent should be able to copy the object rather than translate names from memory.

### State token contract

`state_token` is a compact cache and comparison key, not a replacement for visible revisions. It should encode or deterministically derive from:

- factory version;
- factory revision;
- lock revision;
- event revision.

Every tool result should return the current state token. A stale token is evidence that the world changed, not permission to auto-retry.

A later additive enhancement may let `get_factory_snapshot` accept `known_state_token`. The response can then return either:

- `snapshot_mode: "not_modified"` with fresh continuation metadata; or
- `snapshot_mode: "delta"` with changed authority, scenario heads, and evidence entries; or
- `snapshot_mode: "full"` when the prior state cannot be safely reconstructed.

This is the main resource-efficiency mechanism. It avoids hiding state transitions inside a mega-tool.

### Capability-map contract

Every mutable field should have one canonical definition shared by schema generation, runtime validation, simulation, lock enforcement, and documentation:

```json
{
  "field": "packaging_speed_bps",
  "resource": "Packaging",
  "unit": "basis_points_of_nameplate",
  "current_value": 7500,
  "allowed": { "minimum": 5000, "maximum": 10000 },
  "timing": "effective_at_command_tick",
  "locked": false,
  "lock_revision": 3
}
```

The current implementation has one semantic seam that must be removed before claiming this contract: the public field is named `packaging_calibration`, while the engine currently assigns calibration to the Quality Gate resource. One canonical ownership model must drive both layers.

### Human-lock contract

A human lock is not a boolean UI decoration. It is an authority object:

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
  "effective_tick": 16,
  "effective_elapsed_minutes": 240,
  "lock_revision": 3
}
```

The effective tick must come from one domain constant used by the store, simulator, proof, tool output, UI, and documentation. “Locked now” in the planning interface and “effective four hours into the simulated shift” are not interchangeable claims; both must be visible when that is the intended model.

### Scenario contract

A scenario is an immutable lineage of hypothesis heads:

```json
{
  "scenario_id": "scenario-b",
  "scenario_version_id": "scenario-b-v2",
  "scenario_revision": 2,
  "base_factory_version_id": "factory-v4",
  "base_lock_revision": 2,
  "parent_scenario_version_id": null,
  "declared_overrides": {},
  "effective_overrides": {},
  "suppressed_overrides": [],
  "source_is_current": true
}
```

Rules:

- UI markers `A` and `B` are display slots, not durable identities.
- A scenario head is writable only while its base authority epoch is current.
- A human authority change freezes the old head as historical evidence.
- Recovery creates a fresh branch from the new epoch instead of carrying inadmissible overrides forward.
- The tool surface remains at six tools; clean recovery is expressed through the existing `create_scenario` capability, not a new `rebase` tool.

### Continuation contract

Every successful read or write should return a `continuation` object containing the exact fields required by the most likely next call:

```json
{
  "factory_version_id": "factory-v5",
  "expected_factory_revision": 5,
  "expected_lock_revision": 3,
  "scenario_id": "scenario-b",
  "expected_scenario_revision": 2
}
```

The continuation is advisory and inspectable. The command bus still verifies each field independently. It reduces transcription failures without weakening optimistic concurrency.

### Error and recovery contract

Expected errors are part of the protocol, not generic exceptions:

```json
{
  "schema_version": "factory-tools/v1",
  "status": "error",
  "code": "STALE_FACTORY",
  "request_id": "scenario-b-retry-02",
  "message": "The factory authority epoch changed. No changes were applied.",
  "data": {
    "committed": false,
    "precondition_diff": {
      "expected_factory_revision": 4,
      "current_factory_revision": 5,
      "expected_lock_revision": 2,
      "current_lock_revision": 3
    },
    "recovery": {
      "read_tool": "get_factory_snapshot",
      "fresh_scenario_required": true,
      "reuse_request_id": false
    }
  }
}
```

All expected write failures must state `committed: false`. If a command committed before a presentation-layer wait failed, the committed outcome remains authoritative and must not be rewritten as an error.

### Receipt contract

A receipt is the evidence unit of the system. Its compact agent projection should include:

- `run_id`, `content_hash`, `input_hash`, `simulator_version`;
- source factory/scenario/lock revisions and `source_is_current`;
- exact metrics and baseline deltas;
- each hard constraint with `lhs`, `operator`, `rhs`, `unit`, `pass`, and exact slack;
- remaining bottlenecks;
- operation audit counts and blocked fields;
- invariant status;
- proof metadata and exact inequality when present.

No model-authored interpretation belongs inside the receipt. Human-readable explanations are downstream views over receipt facts.

### Comparison contract

The first `run_id` is the anchor and order is meaningful. The result should add a deterministic decision summary:

```json
{
  "anchor_run_id": "factory-run-baseline",
  "feasible_run_ids": ["factory-run-b"],
  "pareto_frontier_run_ids": ["factory-run-b"],
  "dominated": [
    {
      "run_id": "factory-run-a",
      "dominated_by": "factory-run-b",
      "reasons": ["same_good_output", "higher_total_cost"]
    }
  ],
  "lowest_cost_feasible_run_id": "factory-run-b"
}
```

The selection rule must be declared, stable, and tested. It is not permission for the engine to invent business preferences that were not in the mission contract.

## Tool ergonomics while retaining exactly six tools

| Tool | Agent question it answers | Required ergonomic behavior |
| --- | --- | --- |
| `get_factory_snapshot` | “What world, objective, authority, action space, and evidence do I have?” | Call first and after human intervention; return derived targets, capability map, state token, evidence index, and copy-ready continuation. |
| `get_scenario_snapshot` | “What exactly is this hypothesis head, and is it still usable?” | Use for resume or recovery; distinguish declared, effective, and suppressed overrides; return lineage, currentness, receipt summary, and continuation. |
| `create_scenario` | “Create a clean hypothesis under the authority I currently hold.” | Bind the scenario to the supplied factory and lock revision; return a copy-ready continuation; expose any archived display slot without deleting evidence. |
| `apply_scenario_changes` | “Commit these bounded absolute controls to this current hypothesis.” | Include only intended fields; reject the entire batch on any stale or locked condition; return committed fields, cleared receipt state, and next continuation. |
| `run_factory_simulation` | “What deterministically happens if this exact hypothesis runs?” | Return a compact content-addressed receipt, exact slack, remaining bottlenecks, audit status, proof, and currentness. |
| `compare_simulation_runs` | “Which evidence is feasible, dominated, or preferred under the declared rule?” | State that the first run is the anchor; return exact deltas, feasibility, dominance, Pareto frontier, and deterministic selection. |

Tool descriptions should include **when to call**, **what side effect occurs**, **what can make the call fail**, and **what the result enables next**. Descriptions should not contain instructions unrelated to the application or claims that the browser should trust merely because the website says so.

## Accretion model

A useful agent system should become easier to operate as evidence accumulates.

Every call must produce at least one durable artifact:

- a fresher decision context;
- a new immutable scenario head;
- a committed state transition;
- a content-addressed simulation receipt;
- a deterministic comparison;
- or a structured recovery state.

Nothing important is silently overwritten:

- stale receipts become historical rather than disappearing;
- scenario replacement affects a display slot, not the evidence graph;
- currentness is computed, not inferred from recency;
- comparisons reference receipt IDs, not mutable scenario labels;
- the revision ledger is a human projection of the same event history used by the agent.

The factory snapshot should expose a bounded `evidence_index` containing enough metadata to recover from context loss without re-running simulations. Full receipt detail remains on demand.

## Resource-efficiency principles

1. **One complete orientation read.** The first snapshot contains the mission, action space, authority, baseline, and existing evidence.
2. **Copy, do not translate.** Continuation field names match the next tool input.
3. **Progressive disclosure.** Default responses contain decision-complete summaries; deep tick evidence is requested only when needed.
4. **Delta recovery.** A known state token allows compact re-reads after a human change.
5. **No duplicate arithmetic.** Derived thresholds, slack, dominance, and exact comparisons are computed by deterministic software.
6. **No speculative retries.** Errors say whether anything committed and what read restores authority.
7. **No mega-tool.** Planning, mutation, simulation, and comparison remain separate because those boundaries are visible evidence in the challenge.
8. **No agent-only shadow state.** Important state lives in the application and is visible to the human, not only in the model’s conversation memory.

## Weaknesses and required responses

| Current weakness | Why it matters to an agent | Target response | Priority |
| --- | --- | --- | --- |
| Read outputs and write preconditions use different field names | Increases transcription and stale-call errors | Add copy-ready `continuation` objects to every result | P0 |
| Legal controls are distributed across schemas and engine code | Agent must infer ownership, timing, and lockability | Generate schema, validation, lock enforcement, and `control_catalog` from one canonical definition | P0 |
| Lock output omits effective tick and blocked fields | The agent cannot model the actual simulated authority boundary | Introduce one typed lock contract rendered identically in tools, UI, proof, and docs | P0 |
| Calibration ownership differs between public field naming and engine resource mapping | Tool and simulator can disagree about which human lock governs a control | Choose one owner and derive every layer from it | P0 |
| A post-lock replan can retain old Packaging overrides in a merged patch | “Use only unlocked controls” can be false at the scenario-input level | Freeze old scenario on authority change and require a clean scenario branch | P0 |
| Stale errors report only the first failed precondition | Recovery requires another read and inference | Return complete `precondition_diff`, `committed: false`, and a recovery directive | P0 |
| Compare output lists deltas but leaves dominance arithmetic to the model | Wastes tokens and risks incorrect recommendation logic | Add deterministic feasibility, dominance, Pareto, and tie-break summary | P1 |
| Re-reading returns the full baseline even when only the lock changed | Repeats stable context | Add optional `known_state_token` and full/delta/not-modified modes | P1 |
| Historical runs are stored but not exposed as a recoverable index | Evidence does not fully compound across context loss | Add bounded `evidence_index` with stable receipt metadata | P1 |
| Tool descriptions explain purpose but not the expected control loop | Tool selection depends more on model improvisation | Rewrite descriptions around when/side effect/failure/next | P1 |
| The visual lock affordance is small relative to its narrative importance | Human intervention can be missed by judges and agents inspecting the page | Increase visual salience and state the effective time and blocked controls | P1 |

## Challenge-safe implementation sequence

The submitted build already proves the safety spine. Changes to the live challenge entry must be additive, backwards compatible with the recorded evaluator prompts, and followed by a complete live replay.

### Phase 0 — freeze the signature interaction

Do not change:

- exactly six top-level imperative tools;
- human-only lock/unlock controls;
- stale-write rejection before recovery;
- deterministic receipts and `9252 < 10937` proof;
- the lack of external side effects;
- the visible revision ledger and scenario evidence.

### Phase 1 — coherence fixes

1. Define a canonical control catalog and lock contract.
2. Unify calibration ownership.
3. Define one lock-effective-tick constant and expose it everywhere.
4. Make authority changes freeze old scenario heads and require a clean branch.
5. Add regression tests before changing submission copy.

### Phase 2 — copy-ready protocol

1. Add state tokens and continuation objects to all successful results.
2. Add complete precondition diffs and explicit commit status to expected errors.
3. Rewrite tool descriptions around the operating loop.
4. Keep all existing fields for recorded-demo compatibility.

### Phase 3 — accretive evidence

1. Add a bounded evidence index.
2. Add exact constraint slack and remaining bottlenecks to compact receipt projections.
3. Add deterministic dominance and Pareto summaries to comparison.
4. Add lineage metadata for fresh post-lock branches.

### Phase 4 — resource optimization

1. Add optional known-state delta reads.
2. Measure response bytes and tool-call count in live traces.
3. Tune default detail only after accuracy and recovery evals stay green.

### Required release gate after any code change

- `npm run verify` passes from a clean checkout.
- The deployed page still registers exactly six top-level tools.
- The existing reset → two scenarios → compare flow still works.
- The intentional stale write still fails once and mutates nothing.
- Recovery requires a fresh read and respects the human lock.
- The locked replan still exposes a current, deterministic proof.
- Submission copy, demo prompt, tool metadata, UI labels, and actual payloads agree.

## Non-goals for the challenge build

- an embedded chatbot;
- a model-driven optimizer that hides scenario formation;
- agent-accessible lock, unlock, force, approve, or machine-control capabilities;
- a broad catalogue of low-value tools;
- authentication or external plant integration;
- multi-factory administration;
- replacing exact receipts with generated explanations;
- automatic stale-command replay that bypasses the visible human-agent disagreement.

## Product thesis

The deepest product idea is not factory simulation. It is **shared epistemic and operational control**:

- the human owns intent and may narrow authority at any moment;
- the agent owns search, hypothesis formation, and evidence assembly inside that authority;
- deterministic software owns operational facts;
- immutable artifacts preserve what was known, attempted, rejected, and proven;
- WebMCP is the protocol that lets all four occupy the same live interface.

That is the system the challenge entry should make legible in under three minutes.
