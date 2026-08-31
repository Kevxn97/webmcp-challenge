# Submission copy

## Project name

Agentic Sandbox

## Tagline

A human changes one rule. The agent's previous plan immediately loses authority.

## What it does

Agentic Sandbox is a deterministic factory decision lab where a human and a browser agent plan against the same live, versioned **decision state**.

The agent can inspect the production-line model, create explicit planning hypotheses, apply bounded operating settings, run a deterministic 16-hour shift simulation, and compare immutable receipts. The human sees the same consequential revisions and evidence in a precision-blueprint interface and can intervene at any time by locking Packaging.

That intervention is the signature interaction. Earlier evidence remains visible but becomes historical. An agent write carrying pre-lock revisions is rejected atomically and mutates no scenario state. The agent must re-read the new authority state and replan around the human constraint. When the target is no longer achievable under the modeled lock, deterministic software returns a conservative upper-bound proof instead of letting the model improvise an explanation.

“Live” refers to the shared planning state on the page. The challenge build has no live plant telemetry and no machine-control path.

## Why WebMCP is essential

Without WebMCP, the browser agent would have to infer state from pixels and manipulate controls through DOM or coordinate automation, or the product would need a separate chatbot and backend with its own shadow state.

Here, the website itself exposes exactly six narrow top-level Site Tools over the same application-owned command bus used by the visible interface. The agent operates on typed capabilities; the human operates on visible controls; both observe the same consequential revisions, locks, scenario heads, receipts, and outcomes.

The best moment is not a successful tool call. It is a safe disagreement:

1. the human changes the admissible action space;
2. the agent's previous authority becomes stale;
3. the page refuses the stale write;
4. no scenario state is silently mutated or rebased;
5. the agent re-reads and adapts;
6. both participants inspect deterministic evidence for the new conclusion.

That shared authority-and-evidence loop is difficult to make coherent without browser-native tools attached to the live decision page.

## Agent experience

The tool surface follows an explicit control loop rather than exposing a catalogue of unrelated functions:

```text
orient → branch a hypothesis → apply bounded controls → simulate → compare
                                      │
                                      ▼
                         human changes authority
                                      │
                                      ▼
                 stale write rejected → re-read → replan → prove
```

The six tools answer six concrete agent questions:

| Site Tool | Agent question |
| --- | --- |
| `get_factory_snapshot` | What decision context, mission, locks, baseline, bottlenecks, and scenario heads exist now? |
| `get_scenario_snapshot` | What exact hypothesis head and receipt exist, and is the source still current? |
| `create_scenario` | Create a named planning branch from the authority state I observed. |
| `apply_scenario_changes` | Atomically commit these bounded absolute settings to the expected scenario head. |
| `run_factory_simulation` | What deterministically happens if this exact hypothesis runs for one shift? |
| `compare_simulation_runs` | How do two to four stored receipts differ against exact constraints? |

There is deliberately no agent-accessible lock, unlock, force, approve, arbitrary patch, optimizer, or machine-control tool. Human authority stays human.

The initial two-scenario path takes eight Site Tool calls: orient, create/apply/run twice, and compare. The hardened target adds a clean post-lock scenario head; while retaining the public grammar, that target recovery is refresh/create/apply/simulate after the intentional stale response. Resource efficiency should remove reconstructive reads, duplicate arithmetic, same-value writes, and repeated simulations—not hide meaningful evidence steps.

## Why the evidence is trustworthy

The model proposes settings but never supplies an operational KPI. The local engine computes every displayed result with integer or fixed-point arithmetic and stores a content-addressed SHA-256 receipt containing:

- immutable input and engine hashes;
- 64 deterministic tick snapshots;
- exact output, defect, energy, and cost counters;
- a category-level cost ledger;
- accepted and rejected operations;
- four hard constraints with exact operands;
- conservation and asset-inventory invariants;
- bottleneck evidence;
- currentness relative to scenario and lock revisions;
- an optional lock-bound upper-limit proof.

The seeded decision is intentionally easy to audit:

| Case | Good output | Decision |
| --- | ---: | --- |
| Baseline | 9,114 | Reference receipt |
| Scenario A · expedited supplier | 11,114 | Output target passes; 8% cost cap fails |
| Scenario B · standard supplier | 11,114 | All four constraints pass |
| Packaging locked at tick 16 | at most 9,252 | Target 10,937 is proven unreachable under the modeled lock |

Scenario A and Scenario B produce the same output. The expedite premium therefore adds cost without adding output. Scenario B is better among those evaluated alternatives; the demo does not claim a globally optimal factory plan.

The Packaging click occurs in the shared planning workflow. The proof models its simulation effect at tick 16, 240 minutes into the counterfactual shift. After the lock, the engine exposes the exact current proof `9252 < 10937` using `factory-engine/1.0.0`.

## Human-agent experience

- The person states a high-level mission in natural language.
- The agent translates the mission into explicit, inspectable hypotheses.
- The interface changes as Site Tool calls commit.
- Every consequential mutation is tied to expected revisions and a request ID.
- The person can narrow the agent's authority directly in the product without restarting the conversation.
- The agent receives a structured stale-state error rather than silent recovery.
- Historical evidence remains available, but currentness is explicit.
- The system distinguishes feasible, failed, stale, and mathematically proven-infeasible outcomes.
- Both participants end on the same receipt, not competing narratives.

The target architecture strengthens this further by making control units, legal domains, resource ownership, phase availability, source-bound currentness, semantic no-ops, and comparison claim levels explicit before the agent depends on them.

## Audience and potential impact

The primary users are plant planners, industrial engineers, and continuous-improvement teams. Today, a debottlenecking decision often moves across a dashboard, spreadsheet, simulation specialist, and approval meeting. Context and authority are lost at each handoff, and a generic assistant can make that worse by recommending controls the operator has just taken off the table.

Agentic Sandbox turns the existing decision interface into the collaboration surface. A browser agent can test alternatives quickly, while deterministic software owns the operational consequences and the human can change the admissible search space at any time.

The first adoption wedge is bounded what-if analysis for line balancing, shift planning, and supplier decisions. A production implementation could connect the same version, capability, lock, and receipt pattern to a validated digital twin. ERP, PLC, SCADA, purchase, and physical-machine changes would remain behind existing approval paths.

The pattern generalizes beyond factories: any high-consequence planning interface can expose narrow capabilities, bind work to an authority epoch, preserve human vetoes, retain immutable evidence, and return machine-checkable decisions.

## How it was built

The React/Vite page registers six top-level imperative WebMCP tools through `document.modelContext.registerTool(...)`. Schemas are closed and narrow. Handlers independently validate input, propagate abort signals, sanitize unexpected errors, and return a versioned `factory-tools/v1` JSON envelope.

The visible UI and WebMCP handlers share one application-owned command bus. Mutations use request IDs plus expected factory, scenario, and human-lock revisions. A stale or locked batch applies nothing. Successful simulation inputs are immutable, use real SHA-256 content hashes, and produce stored receipts with exact constraints, operation audits, invariants, and optional proofs.

The submitted build is intentionally self-contained. It has no model API key, backend, account, purchase, production data, telemetry, or machine integration.

## Built with

WebMCP / OpenAI Site Tools, React 19, TypeScript, Vite, Vitest, Web Crypto SHA-256, Phosphor Icons, and IBM Plex typography.

## Evaluator links and reset

- Live application: `https://webmcp-challenge-seven.vercel.app`
- Source repository: `https://github.com/Kevxn97/webmcp-challenge`
- Public demo video: `https://www.youtube.com/watch?v=3KwBtJU9fow`

The landing page intentionally opens on the completed showcase so the result is immediately inspectable. To replay the signature flow, click **Reset demo** once and confirm that Packaging is unlocked, Scenario A and Scenario B are both **Not run**, and the header says **WebMCP ready**.

Evaluator prompt:

> Read the current factory. Create and simulate two one-shift scenarios using the revisions returned by each call. Scenario A: mixer 9500 bps, Packaging 9000 bps, 15-minute changeover, enhanced calibration, expedited supplier. Scenario B: the same line settings with the standard supplier. Do not add machines. Compare the stored receipts.

Then click **Lock resource** on Packaging and tell the agent:

> Retry the last Scenario B write once with a fresh request ID but the exact revisions you held before my click. Do not re-read first. Report the structured error and confirm that nothing mutated. Then re-read the factory, keep Packaging unchanged, replan using only unlocked controls, simulate one shift, and explain the result from the deterministic evidence.

## Challenge-safe evolution

The submitted and recorded interaction remains the release contract. The repository documents an additive agent-system architecture and a code-audited hardening plan for canonical control semantics, temporal capability, zero-hidden-state behavior, copy-ready continuations, source-bound evidence, complete recovery errors, clean post-lock branches, orthogonal receipt truth, and deterministic comparison claims.

These are target improvements, not claims about the current deployment, until implementation, tests, visible UI evidence, and a fresh live WebMCP replay all agree.
