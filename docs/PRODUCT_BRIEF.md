# Agentic Sandbox product brief

## Product promise

Agentic Sandbox is a shared, deterministic decision substrate for a human and a browser agent.

The human defines intent and can change authority boundaries directly in the visible product. The agent explores bounded alternatives through explicit capabilities. Deterministic software computes operational consequences, exact constraints, and proofs. Both participants see projections of the same versioned state, scenario history, and evidence.

The signature interaction is a safe disagreement: a human changes a rule, the agent's previous authority becomes stale, the system rejects the old write atomically, and the agent adapts from a precise state delta. When the goal is no longer reachable, the system proves that with a machine-checkable bound rather than unsupported model prose.

## Product thesis

The agent-native web should not make agents scrape pixels or force every product to embed a separate chatbot. A site should expose a small intent-level interface over the same state and permissions as its human interface.

Agentic Sandbox demonstrates that pattern for high-consequence planning:

- one live operational state;
- one canonical resource and control ontology;
- explicit time, phase, locks, and authority;
- immutable scenario and evidence history;
- deterministic evaluation and content-addressed receipts;
- compact planning context, bounded evaluation, comparison, recovery, and progressive evidence;
- no agent override of human constraints;
- no real machine or external-system action.

## Participants and ownership

### Human

- states the mission and business preferences;
- changes locks and other authority boundaries;
- can inspect every scenario, revision, receipt, and proof;
- remains in direct control of any future operational approval.

### Agent

- reads an authoritative planning context;
- generates or searches bounded candidate plans;
- evaluates several alternatives transactionally;
- compares feasibility, Pareto relationships, and policy rank;
- recovers from human intervention through typed deltas;
- explains a recommendation from immutable evidence.

### Deterministic system

- owns state identity and currentness;
- validates controls, phases, locks, and preconditions;
- normalizes no-ops and deduplicates equivalent plans;
- computes counters, costs, constraints, invariants, and proofs;
- preserves append-only provenance;
- never accepts model-generated operational metrics as truth.

## Experience principles

1. **Orient once.** The initial context should be sufficient to understand what is true, mutable, locked, phase-closed, and already known.
2. **Expose intent, not storage mechanics.** Public tools map to planning, evaluation, comparison, recovery, and evidence—not low-level CRUD.
3. **Make illegal work impossible early.** Reject unavailable changes before simulation and before visible mutation.
4. **Return read-your-write results.** A successful write includes effective controls, created IDs, evidence summary, currentness, and the next precondition.
5. **Make every failure recoverable.** Structured errors state whether anything committed and name the cheapest legal next action.
6. **Accrete knowledge.** Scenarios, receipts, comparisons, interventions, and decisions form an immutable graph; A/B are only visual pins.
7. **Spend context deliberately.** Use compact context, delta reads, batch evaluation, receipt reuse, and progressive evidence.
8. **Be honest about optimality.** Distinguish feasible, non-dominated, policy winner, best evaluated, and proven optimal.
9. **Keep authority visible.** Human locks and their effective time are identical in the UI and agent contract.
10. **Preserve normal human use.** The page remains fully usable without WebMCP.

## Current challenge profile

The submitted `factory-tools/v1` build demonstrates the core interaction with six top-level tools:

- read factory;
- read scenario;
- create scenario;
- apply bounded changes;
- run deterministic simulation;
- compare receipts.

It is intentionally frozen as the verified challenge profile while the agent-native target is developed and replay-tested separately.

## Agent-native target profile

The target `factory-tools/v2` profile keeps exactly six public tools, but raises the abstraction level:

- `get_planning_context`;
- `get_state_delta`;
- `search_plan_frontier`;
- `evaluate_scenarios`;
- `compare_scenarios`;
- `get_scenario_evidence`.

The detailed architecture, normative contract, implementation sequence, and trajectory evaluation are defined in:

- `docs/AGENT_SYSTEM_DESIGN.md`;
- `docs/AGENT_CONTRACT.md`;
- `docs/AGENT_ERGONOMICS_IMPLEMENTATION_PLAN.md`;
- `docs/AGENT_TRAJECTORY_EVALS.md`.

## Truth contract

- The baseline and stored receipts are immutable.
- Every visible metric comes from deterministic software.
- Every control has one canonical owner, unit, domain, phase, and lock scope across all layers.
- Planning time, event time, and simulation time are explicit and separate.
- Agent writes are bound to the operational state the agent observed.
- Writes are atomic and idempotent; rejected writes commit nothing.
- Historical evidence remains auditable but cannot silently support a current recommendation.
- Equivalent normalized plans reuse evidence.
- Scenario history is append-only and traversable.
- No tool can lock, unlock, force, add a machine, or affect a real plant.

## Hero trajectory

1. The agent reads one compact planning context.
2. It understands the mission, exact policy, current tick, available controls, locks, baseline, bottlenecks, and reusable evidence.
3. It evaluates a bounded set of alternatives in one transaction.
4. The system normalizes no-ops, reuses equivalent receipts, computes exact outcomes, and returns current scenario nodes.
5. The comparison identifies feasibility, dominance, and the policy winner without overclaiming optimality.
6. The human locks Packaging in the live interface.
7. A stale agent write is rejected with `committed: false` and an exact delta-recovery route.
8. The agent reads only the changed state, replans around available controls, and receives a current proof when the mission is infeasible.
9. The human and agent can inspect the same state identity, lineage, receipt, constraint operands, and proof.

## Initial users and impact

The initial users are plant planners, industrial engineers, and continuous-improvement teams who currently move one decision across dashboards, spreadsheets, specialists, and approval meetings. The product reduces lost context and makes authority changes explicit while preserving deterministic operational truth.

The pattern generalizes to any planning interface where agents should explore alternatives but humans retain authority: logistics, supplier decisions, workforce planning, energy scheduling, configuration, and other bounded what-if systems.

## Visual source of truth

`docs/visual-target-precision-blueprint.png` remains the selected visual direction. The implementation should preserve its:

- warm technical-blueprint language;
- dominant left-to-right factory flow;
- revision/event ledger and visible evidence trail;
- spatial scenario overlays;
- dense but inspectable comparison surface;
- IBM Plex-style typography;
- ultramarine, vermilion, green, and amber semantic colors.

Future UI changes must project the same canonical time, locks, currentness, policy, graph, and evidence returned to the agent. Visual labels may simplify; semantics may not diverge.

## Deliberate exclusions

The system does not need an embedded chatbot, model API backend, generic workflow builder, multi-factory administration, authentication, real plant integration, PLC/SCADA writes, open-ended arbitrary patches, or a catalogue of weak tools.

The product wins by making one shared decision loop unusually legible, economical, trustworthy, and reusable.
