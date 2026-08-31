# Agentic Sandbox product brief

## Product promise

Agentic Sandbox is a deterministic operational decision lab where a human and a WebMCP-capable browser agent share one live, versioned **decision state**.

The agent can inspect the problem, form explicit alternatives, commit bounded settings, simulate exact consequences, and compare immutable evidence. The human can change the admissible decision space at any time through visible resource locks. A human decision immediately changes the agent’s authority: stale work fails closed, historical evidence remains inspectable, and the agent must re-read and create a clean plan under the new rules.

The product is not “AI controlling a factory,” and the word live does not imply live plant telemetry. It is a local decision protocol that makes intent, model state, authority, time, capabilities, evidence, conflict, and recovery legible to both participants before any real-world action occurs.

## Primary users and job

Initial users are plant planners, industrial engineers, and continuous-improvement teams making bounded what-if decisions across line balancing, changeovers, supplier modes, quality capacity, and warehouse flow.

Their job is not merely to obtain a recommendation. It is to answer:

- Which changes satisfy every operational constraint?
- Which controls are legally and temporally available now?
- Which alternatives are wasteful, dominated, historical, or invalid?
- Which exact facts support the decision?
- What changed after a human intervention?
- Is failure merely observed among attempted plans, or mathematically proven under the active assumptions?
- What claim is justified: feasible, best among evaluated candidates, or proven optimal?

## Core product thesis

Five system roles have distinct responsibilities:

- **Human:** owns mission, authority, and intervention.
- **Agent:** owns hypothesis formation, search strategy, and evidence assembly within the current authority boundary.
- **Semantic kernel:** owns what each resource and control means—its unit, domain, owner, phase, lock scope, and evaluator mapping.
- **Deterministic engine:** owns operational consequences, exact arithmetic, invariants, and proofs.
- **WebMCP and human interface:** expose two projections over the same command, authority, and evidence system.

No role may silently take over another role's responsibility. The model cannot author KPIs, the evaluator cannot invent business preferences, the UI cannot hide state that changes tool behavior, and the agent cannot override human authority.

WebMCP is essential because it gives the browser agent explicit capabilities over the same decision state the human sees. It avoids both pixel guessing and a separate chatbot/backend with a competing state model.

## System identities

The product distinguishes four identities even when the current compatibility contract represents them through several revisions:

1. **Model identity:** assets, factory assumptions, controls, deliveries, and physical constants.
2. **Authority identity:** human locks, blocked controls, effective time, and permission revision.
3. **Workspace identity:** scenario heads, display pins, comparisons, and ledger events.
4. **Evidence identity:** canonical scenario input plus source model, mission, authority, time, ontology, and evaluator versions.

A human lock changes authority without pretending that the physical model changed. A workspace selection changes presentation without changing legal tool behavior. A receipt may remain truthful for its source identity while becoming historical for the current decision.

## Agent experience principles

1. **Orient completely before acting.** One initial read exposes the mission, derived thresholds, current model and authority, control meanings, temporal availability, locks, baseline bottleneck, existing evidence, and write preconditions.
2. **Never teach a rule through failure.** Legal ranges, units, owners, phases, lock scopes, and comparison semantics are visible before the action that depends on them.
3. **Make state copyable.** Tool outputs return continuation objects whose field names match the next write input.
4. **Expose capability, not only schema.** A value can be valid in general while its control is currently `HUMAN_LOCKED`, `PHASE_CLOSED`, or `UNSUPPORTED`.
5. **Keep hypotheses explicit.** Scenarios are named, versioned branches bound to one decision epoch; A and B are display pins rather than durable identity.
6. **Remove hidden UI coupling.** Tool behavior does not depend on selected column, modal state, viewport, focus, render timing, or other unexposed presentation state.
7. **Normalize semantic no-ops.** Reapplying an already effective value does not increment revision, clear a valid receipt, or trigger another simulation.
8. **Accumulate evidence.** Receipts remain immutable and addressable when they become historical; new work adds to an evidence graph instead of overwriting history.
9. **Make errors navigational.** Expected failures state that nothing committed, show every mismatched precondition, and identify one correct recovery action.
10. **Compute exact facts in software.** Derived targets, constraint slack, dominance, selection order, and proof inequalities are not delegated to model prose.
11. **Keep truth dimensions separate.** Execution validity, source currentness, hard-constraint feasibility, proof state, and decision relation are orthogonal.
12. **Use progressive disclosure.** Default tool responses are decision-complete but compact; detailed tick evidence is available only when needed.
13. **Branch cleanly after human intervention.** A changed authority epoch freezes the old scenario. The agent creates a fresh scenario rather than carrying locked overrides forward.
14. **Preserve meaningful friction.** The challenge flow retains explicit read, branch, mutation, simulation, comparison, human conflict, recovery, and proof boundaries.

The normative architecture is documented in `docs/AGENT_SYSTEM_DESIGN.md`. The audited implementation sequence is documented in `docs/AGENT_SYSTEM_HARDENING_PLAN.md`. Trace-based acceptance is documented in `docs/AGENT_EVAL_PLAN.md`.

## Canonical control contract

One versioned semantic definition must drive schema, independent validation, resource ownership, units, phase availability, evaluator operations, human locks, UI labels, documentation, and tests.

For the current challenge vocabulary:

| Control | Meaning | Resource | Phase |
| --- | --- | --- | --- |
| `mixer_speed_bps` | basis points of Mixer nameplate | Mixer | runtime |
| `packaging_speed_bps` | basis points of Packaging nameplate | Packaging | runtime |
| `packaging_changeover_minutes` | selected Packaging changeover | Packaging | pre-shift |
| `packaging_calibration` | Packaging calibration mode | Packaging | pre-shift |
| `supplier_mode` | material-delivery service mode | Supplier | pre-shift |
| `quality_rate_units_per_hour` | inspection capacity | Quality Gate | runtime |
| `warehouse_dock_units_per_hour` | warehouse receiving capacity | Warehouse | runtime |

For speed controls, `10000` means 100% of nameplate. The canonical challenge range is 5,000–10,000 basis points.

## Time contract

The product exposes two distinct clocks:

- **planning time:** when the human or agent changes the shared decision workspace;
- **simulation time:** when an operation becomes effective inside the deterministic 64-tick counterfactual shift.

The visible Packaging lock is imposed in planning time. The current proof models its simulation effect at tick 16, four hours into the 16-hour shift. That timing is an explicit assumption, not an invisible implementation detail, and one constant must drive the command layer, simulator, proof, tool output, UI, tests, and documentation.

## Truth contract

- The baseline is immutable.
- Every control has one canonical unit, domain, owner, phase, operation mapping, and lock scope.
- Public validation and evaluator validation agree on every legal value.
- Every scenario head is bound to an explicit model and authority epoch.
- Human locks advance authority and make earlier scenario evidence historical.
- Agent mutations use request IDs and expected revisions and fail atomically on stale state or unavailable controls.
- Rejected writes mutate no operational or scenario state.
- Tool behavior is independent of unexposed UI selection or presentation state.
- A semantic no-op does not create a new scenario revision or invalidate a receipt.
- Every displayed operational metric comes from a stored deterministic receipt.
- Receipts carry exact constraints, hashes, operation audits, invariants, source binding, and optional proofs.
- A historical receipt remains auditable but cannot support a current recommendation.
- A current comparison cannot silently select historical or invalid evidence.
- Execution validity, currentness, feasibility, proof, and decision relation remain distinct.
- “Best among evaluated scenarios” and “proven optimal” are different claims.
- User and agent supplied labels are untrusted display text and never affect control behavior or selection.
- The system is a decision sandbox only. It has no ERP, PLC, SCADA, purchase, account, telemetry, or physical-machine side effect.

## Hero interaction

1. The human states a mission: at least 20% more good output, no more than 8% additional cost, no new machine, and no defect-rate increase.
2. The agent reads the decision state, exact mission contract, control capabilities, existing evidence, and current authority.
3. It creates and simulates two explicit hypotheses.
4. Deterministic comparison shows that both produce the same output, but the expedited-supplier plan is cost-dominated while the standard-supplier plan satisfies all four constraints.
5. The human locks Packaging in the visible interface.
6. One intentionally stale agent write is rejected atomically; the prior receipt remains visible but becomes historical.
7. The agent re-reads the new authority epoch and creates a clean scenario using only controls whose availability is `AVAILABLE`.
8. The engine returns a current lock-bound proof: `9252 < 10937`.
9. Human and agent inspect the same source-bound receipt, revisions, and proof before making any real-world decision.

The disagreement is the product. It demonstrates that the human can change the rules without the agent silently rebasing, overriding, or fabricating certainty.

## Visual source of truth

`docs/visual-target-precision-blueprint.png` is the selected visual direction. The implementation should preserve its:

- warm technical-blueprint language;
- dominant left-to-right factory flow;
- revision ledger and visible evidence trail;
- spatial scenario overlays;
- dense, precise comparison table;
- IBM Plex-style typography;
- ultramarine, vermilion, and green semantic colors.

Visual hierarchy must make the human authority action unmistakable. The Packaging lock should be readable in a compressed demo view and show its blocked controls and tick-16 / 240-minute effect wherever the proof depends on them.

The visible product must also distinguish:

- current, historical, and invalid evidence;
- execution validity from feasibility and proof;
- durable scenario identity from A/B display pins;
- authoritative facts from untrusted display labels.

## Challenge-specific scope

The OpenAI WebMCP Challenge rewards usefulness, originality, execution, thoughtful WebMCP use, and the quality of the human-agent experience. The challenge build therefore optimizes for one exceptionally clear shared workflow rather than breadth.

### Must remain

- exactly six narrow, top-level imperative Site Tools;
- the same application-owned command bus for UI and WebMCP;
- visible human-only Packaging lock/unlock;
- an intentional stale-write failure before recovery;
- immutable deterministic receipts;
- currentness labels and revision ledger;
- exact feasible, dominated, and proven-infeasible outcomes;
- normal human operation when WebMCP is absent.

### Deliberate exclusions

- embedded chatbot;
- opaque `optimize_factory`, frontier-search, or batch-evaluation mega-tool in the submitted profile;
- agent-accessible lock, unlock, force, approve, or machine-control tool;
- generic multi-factory administration;
- authentication and real plant integration;
- model-generated KPIs or proof prose;
- large catalogues of weak tools;
- automatic stale-command replay that hides the human-agent conflict;
- global-optimality claims from the two demonstrated scenarios.

## Product success criteria

The product succeeds when a capable agent can:

- choose `get_factory_snapshot` first without special prompting;
- extract the exact mission and selection policy;
- understand every control's unit, domain, resource, phase, and current availability before writing;
- complete the initial two-scenario decision in exactly eight calls with no avoidable validation, read, or stale error;
- carry exact revisions through copy-ready continuations;
- produce identical tool outcomes regardless of selected UI column or open modal;
- recover from the one intentional stale write through a clearly indicated read;
- create a clean post-lock scenario in four additional calls with zero blocked or phase-closed changed controls;
- distinguish current from historical evidence and valid execution from constraint feasibility;
- explain every number from a source-bound receipt;
- say “best evaluated under the declared policy” rather than “optimal” unless completeness is proven;
- reach the same conclusion when conversation memory is lost but application evidence remains;
- do all of this while the human can see and understand every consequential transition on the page.