# Agentic Sandbox product brief

## Product promise

Agentic Sandbox is a deterministic operational decision lab where a human and a WebMCP-capable browser agent share one live, versioned factory state.

The agent can inspect the problem, form explicit alternatives, commit bounded settings, simulate exact consequences, and compare immutable evidence. The human can change the admissible decision space at any time through visible resource locks. A human decision immediately changes the agent’s authority: stale work fails closed, historical evidence remains inspectable, and the agent must re-read and create a clean plan under the new rules.

The product is therefore not “AI controlling a factory.” It is a shared decision protocol that makes intent, authority, state, evidence, conflict, and recovery legible to both participants.

## Primary users and job

Initial users are plant planners, industrial engineers, and continuous-improvement teams making bounded what-if decisions across line balancing, changeovers, supplier modes, quality capacity, and warehouse flow.

Their job is not merely to obtain a recommendation. It is to answer:

- Which changes satisfy every operational constraint?
- Which alternatives are wasteful or dominated?
- Which facts support the decision?
- What changed after a human intervention?
- Is failure merely observed among attempted plans, or mathematically proven under the active constraints?

## Core product thesis

Four actors have distinct responsibilities:

- **Human:** owns mission, authority, and intervention.
- **Agent:** owns hypothesis formation, search, and evidence assembly within the current authority boundary.
- **Deterministic engine:** owns operational consequences, exact arithmetic, invariants, and proofs.
- **Interface:** owns shared visibility of state, revisions, evidence, and disagreement.

WebMCP connects those responsibilities on the same live page. The human UI and the six Site Tools are two projections over one command path, not separate products.

## Agent experience principles

1. **Orient completely before acting.** One initial read should expose the mission, derived thresholds, current controls, legal action space, locks, baseline bottleneck, existing evidence, and write preconditions.
2. **Make state copyable.** Tool outputs should return continuation objects whose field names match the next write input.
3. **Expose authority, not just state.** Locks include ownership, blocked controls, revision, and effective time.
4. **Keep hypotheses explicit.** Scenarios are named, versioned branches bound to one factory and lock epoch.
5. **Accumulate evidence.** Receipts remain immutable and addressable when they become stale; new work adds to an evidence graph instead of overwriting history.
6. **Make errors navigational.** Expected failures state that nothing committed, show every mismatched precondition, and identify the read required for recovery.
7. **Compute exact facts in software.** Derived targets, constraint slack, dominance, and proof inequalities are not delegated to model prose.
8. **Use progressive disclosure.** Default tool responses are decision-complete but compact; detailed tick evidence is available only when needed.
9. **Branch cleanly after human intervention.** A changed authority epoch freezes the old scenario. The agent creates a fresh scenario rather than carrying locked overrides forward.
10. **Preserve meaningful friction.** The challenge flow retains explicit read, branch, mutation, simulation, comparison, human conflict, recovery, and proof boundaries.

The normative agent-facing design is documented in `docs/AGENT_SYSTEM_DESIGN.md`; trace-based acceptance is documented in `docs/AGENT_EVAL_PLAN.md`.

## Truth contract

- The baseline is immutable.
- Every scenario head is bound to an explicit factory version and human-lock revision.
- Human locks increment the authority epoch and make earlier scenario evidence historical.
- Agent mutations use request IDs and expected revisions and fail atomically on stale state or locked resources.
- Rejected writes mutate nothing.
- Every displayed operational metric comes from a stored deterministic receipt.
- Receipts carry exact constraints, hashes, operation audits, invariants, and optional proofs.
- A stale receipt remains auditable but cannot support a current recommendation.
- “Feasible,” “not feasible among attempted plans,” and “proven infeasible under active locks” are distinct states.
- The system is a decision sandbox only. It has no ERP, PLC, SCADA, purchase, account, or physical-machine side effect.

## Hero interaction

1. The human states a mission: at least 20% more good output, no more than 8% additional cost, no new machine, and no defect-rate increase.
2. The agent reads the factory, exact decision contract, action space, and current authority.
3. It creates and simulates two explicit hypotheses.
4. Deterministic comparison shows that both produce the same output, but the expedited-supplier plan is cost-dominated while the standard-supplier plan satisfies all four constraints.
5. The human locks Packaging in the visible interface.
6. One intentionally stale agent write is rejected atomically; the prior receipt remains visible but becomes historical.
7. The agent re-reads the new authority epoch and creates a clean scenario using only unlocked controls.
8. The engine returns a current lock-bound proof: `9252 < 10937`.
9. Human and agent can inspect the same receipt, revisions, and proof before making any real-world decision.

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

Visual hierarchy must make the human authority action unmistakable. The Packaging lock should be readable in a compressed demo view and should show its blocked controls and effective time wherever the proof depends on them.

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
- opaque `optimize_factory` mega-tool;
- agent-accessible lock, unlock, force, approve, or machine-control tool;
- generic multi-factory administration;
- authentication and real plant integration;
- model-generated KPIs or proof prose;
- large catalogues of weak tools;
- automatic stale-command replay that hides the human-agent conflict.

## Product success criteria

The product succeeds when a capable agent can:

- choose the correct first tool without special prompting;
- complete the initial two-scenario decision with no avoidable validation or stale errors;
- carry exact revisions without manual name translation;
- recover from the one intentional stale write through a clearly indicated read;
- create a clean post-lock scenario with zero blocked controls;
- distinguish current from historical evidence;
- explain every number from a receipt;
- reach the same conclusion when conversation memory is lost but application evidence remains;
- do all of this while the human can see and understand every consequential transition on the page.
