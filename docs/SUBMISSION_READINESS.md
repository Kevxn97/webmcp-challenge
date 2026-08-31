# Submission readiness

Status date: 2026-08-31

Agentic Sandbox is technically implemented, locally self-contained, publicly deployed, verified through ChatGPT Work's Cloud Browser against the live URL, documented with a public demo video, and submitted to the OpenAI WebMCP Challenge on Devpost.

The submitted runtime remains the verified release baseline. A subsequent agent-system review now defines how the interface can become semantically coherent, more legible, copyable, evidence-accretive, and resource-efficient without weakening the challenge's signature human-agent interaction. Target design statements are not implementation claims.

## Official challenge gate

The challenge evaluates usefulness, originality, execution, thoughtful WebMCP use, and the quality of the human-agent experience. A submission also needs a project description, working public app, source repository, and demo video.

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Useful product problem | Ready | Factory debottlenecking and constrained what-if planning are explained in `README.md` and `docs/SUBMISSION.md`. |
| Original concept | Ready | Human locks invalidate stale agent plans; the deterministic engine can prove infeasibility instead of inventing an answer. |
| Thoughtful WebMCP use | Ready | Exactly six narrow top-level tools share the same command path and human lock boundary as the visible UI. |
| Human-agent collaboration | Ready | The signature flow includes live human intervention, one intentional stale-write rejection, a fresh read, replanning, and shared proof. |
| Deterministic evidence | Ready | Versioned SHA-256 receipts, exact constraint operands, conservation checks, operation audits, and a lock-bound upper-limit proof. |
| Agent-system design | Specified | `docs/AGENT_SYSTEM_DESIGN.md` defines the linked abstraction tower and target contracts. |
| Agent hardening program | Specified | `docs/AGENT_SYSTEM_HARDENING_PLAN.md` records the code-audited semantic seams, ordered implementation program, and challenge cut line. |
| Agent evaluation | Specified | `docs/AGENT_EVAL_PLAN.md` defines golden traces, semantic parity, hidden-state, currentness, explanation, and resource-efficiency gates. |
| Automated verification | Ready | GitHub Actions runs `npm ci` followed by `npm run verify`; the recorded baseline passes 84 Vitest tests and 5 Sites tests. |
| Public HTTPS deployment | Ready | `https://webmcp-challenge-seven.vercel.app` loads without authentication and serves the current production build. |
| Public demo video | Ready | The public 2:54 YouTube demo includes audio and visible Site Tool calls: `https://www.youtube.com/watch?v=3KwBtJU9fow`. |
| Judge access to source | Ready | The repository is public and GitHub detects the MIT license. |
| Final WebMCP host replay | Ready | The reset, two-scenario, human-lock, stale-write, fresh-read, and locked-replan flow passed against the public deployment in ChatGPT Work's Cloud Browser on 2026-08-29. |
| Devpost submission | Submitted | Devpost reports `Submitted` and `5/5 steps done`; the public entry is `https://devpost.com/software/agentic-sandbox`. |

## Verified live host replay

The 2026-08-29 acceptance replay used ChatGPT Work's Cloud Browser and the public deployment, not a local bridge or mocked `modelContext`.

- ChatGPT discovered exactly six top-level Site Tools and the page reported `WebMCP ready`.
- **Reset demo** returned no active locks, Packaging was unlocked, and Scenario A and Scenario B were both `Not run`.
- Scenario A and Scenario B were created, revised, simulated for one shift, and compared through Site Tool calls.
- Both produced 11,114 good units. Scenario A failed the cost cap at EUR 47,670.51; Scenario B passed all four constraints at EUR 45,170.51.
- The human Packaging lock advanced the decision state and visibly marked the earlier Scenario B receipt stale.
- A fresh request carrying the exact pre-lock revisions returned `STALE_FACTORY` with `current_factory_revision: 5`.
- Scenario B remained at revision 2 with the same prior run ID, proving the rejected call mutated no scenario state.
- After a fresh factory read, the agent changed only unlocked controls, simulated one shift, and received `PROVEN_INFEASIBLE_UNDER_LOCKS`.
- The live evidence dialog showed `9252 < 10937`, `factory-lock-upper-bound/v1`, a current proven source, and `factory-engine/1.0.0`.

## Current release contract

The following behaviors are implemented and may be claimed for the public challenge build:

- exactly six top-level imperative Site Tools;
- one application-owned command bus shared by UI and tools;
- closed schemas plus independent runtime input validation;
- request IDs and optimistic factory/scenario/lock revisions;
- human-only Packaging lock with no agent override;
- atomic stale and locked-write rejection;
- immutable deterministic receipts and currentness indicators;
- exact output, cost, defect, asset, invariant, and proof evidence;
- normal human operation when WebMCP is unavailable;
- one complete public challenge replay and recording.

The current release contract does **not** yet claim the full target semantic kernel, phase-aware capability map, clean post-lock scenario lineage, source-bound comparison guard, no-op normalization, or orthogonal receipt truth model.

## Target agent-system contract

The following improvements are specified but must not be described as implemented until they pass code review, generated tests, UI evidence, and a fresh public WebMCP replay:

- one canonical control definition driving schema, validation, unit, range, owner, phase, evaluator mapping, lock scope, UI, and docs;
- the canonical 5,000–10,000 speed range and `basis_points_of_nameplate` meaning;
- Packaging ownership of `packaging_calibration` across every layer;
- explicit `AVAILABLE`, `HUMAN_LOCKED`, `PHASE_CLOSED`, and `UNSUPPORTED` capability states;
- explicit separation of planning-time lock events from tick-16 / 240-minute simulation effect;
- tool semantics independent of selected UI column, modal, focus, viewport, and rendering state;
- deterministic scenario allocation or explicit capacity handling;
- copy-ready continuation objects whose keys match the next tool input;
- a compact decision-epoch token and optional incremental snapshot mode;
- exact derived mission thresholds and declared selection policy;
- complete source binding and reasoned currentness for scenarios and receipts;
- an evidence index for recovering prior receipts without rerunning them;
- complete precondition diffs plus `committed: false` and one recovery directive on expected errors;
- clean scenario branches after a human authority change;
- semantic no-op normalization with no revision or receipt churn;
- separate execution-validity, currentness, hard-constraint, proof, and decision-relation axes;
- current-selection rejection of historical or invalid evidence;
- deterministic constraint slack, dominance, Pareto frontier, and justified claim level;
- structural separation of authoritative facts from untrusted display labels;
- trace-level agent ergonomics and context-loss recovery evaluation.

The target contract remains additive and retains exactly six public tools. It reduces accidental interface friction without removing the explicit read, branch, mutation, simulation, comparison, conflict, recovery, and proof boundaries that make the challenge interaction meaningful.

## Code-audited semantic seams

The full evidence and implementation response is in `docs/AGENT_SYSTEM_HARDENING_PLAN.md`. The release-blocking foundation is:

| Seam | Agent risk | Required resolution |
| --- | --- | --- |
| Public speed validation currently permits 15,000 bps while the evaluator accepts no more than 10,000 | A schema-valid action fails only during evaluation | Canonical 5,000–10,000 range generated into all layers. |
| Speed schema copy describes basis points of baseline while evaluator semantics use nameplate | Agent builds the wrong physical model | Canonical unit `basis_points_of_nameplate`; update schema, UI, and docs. |
| `packaging_calibration` is Packaging-owned in public/store behavior but Quality-Gate-owned in evaluator attribution | Tool and evaluator disagree on human lock scope | Make the current public control Packaging-owned everywhere. |
| Pre-shift controls can be accepted after their effective phase and fail later in simulation | Agent learns a rule through an avoidable evaluator failure | Phase-aware capability projection and pre-evaluator command rejection; normalize unchanged values as no-ops. |
| Lock is imposed “now” in planning state while the proof models tick 16 / 240 elapsed minutes | The origin of the 9,252 bound is not self-evident | One timing constant and explicit dual-clock projection. |
| `create_scenario` replacement can depend on `selectedScenarioId` | An unexposed human UI choice changes tool behavior | Deterministic allocation independent of UI state or explicit capacity error. |
| Post-lock mutation can retain historical Packaging overrides in a merged patch | “Replanned using only unlocked controls” can be false at input level | Freeze the old head and create a clean scenario from the new authority epoch. |
| Stored runs do not yet carry complete source-epoch binding through comparison | Historical feasible evidence can look usable for the current decision | Persist source identity and guard current selection. |
| One compatibility feasibility status carries validity, constraint, proof, and currentness meaning | Invalid operations can be obscured by an attractive proof label | Expose orthogonal truth axes and derive the summary. |
| Same-value applies create revision and evidence churn | Agent work does not accrete efficiently | Normalize semantic no-ops before commit. |

## Minimal challenge traces

Under the existing public grammar:

- the initial two-scenario decision requires exactly **8 Site Tool calls**: orient, create/apply/run twice, compare;
- after the one intentional stale response, a clean current locked receipt requires exactly **4 calls**: refresh, create, apply, simulate.

A three-call recovery target would contradict the explicit create/apply/run boundaries unless the public grammar changed. The challenge plan does not hide one of those steps merely to improve a call-count metric.

## Release acceptance criteria

A release candidate is challenge-ready only when all of the following are true:

- [x] `npm run verify` passes from a clean checkout for the submitted baseline.
- [x] The GitHub `Verify` workflow is green on the submitted `main` commit.
- [x] The public HTTPS deployment loads without authentication, redirects, or environment configuration.
- [x] The page reports `WebMCP ready` in ChatGPT's in-app browser.
- [x] Exactly six Site Tools are discoverable from the top-level document.
- [x] Reset produces an unlocked factory with empty scenario slots.
- [x] The documented two-scenario flow reproduces the stored output and cost outcomes.
- [x] Locking Packaging increments visible authority and marks prior scenarios stale.
- [x] Reusing pre-lock revisions with a fresh request ID returns `STALE_FACTORY` and mutates no scenario state.
- [x] A fresh locked replan produces the visible `9252 < 10937` proof.
- [x] The demo video is public, under three minutes, and shows actual Site Tool calls.
- [x] The live application URL, source repository, and public video are present in the submission copy.
- [x] The repository is public and GitHub detects the MIT license.
- [x] The Devpost entry is submitted and publicly available.
- [ ] Any future target implementation passes every applicable golden trace in `docs/AGENT_EVAL_PLAN.md`.
- [ ] Generated tests prove range, unit, ownership, phase, operation, and lock parity for every control.
- [ ] Tool outcomes remain invariant under unrelated UI selection and modal state.
- [ ] A post-lock current scenario contains no inherited Packaging override.
- [ ] Historical or invalid evidence cannot become the current comparison winner.
- [ ] No-op-only applies preserve revision and receipt identity.
- [ ] Any changed public contract is replayed against production in ChatGPT's built-in browser.
- [ ] Documentation, schemas, command behavior, evaluator behavior, visible UI, and evaluator prompts agree exactly.

## Change-control rule before judging

Do not merge a live-code change merely because it is architecturally cleaner. Merge only when it is additive, backwards compatible with the evaluator prompts, demonstrably clearer to both agent and judge, and fully replayed.

Documentation-only changes may clarify the system, but preserve a bright line between current behavior and target design. A code change to WebMCP registration, schemas, validation, semantic control definitions, store behavior, evaluator semantics, lock timing, receipt structure, scenario lineage, comparison currentness, or visible evidence triggers:

1. the complete automated gate;
2. all applicable agent golden traces;
3. generated cross-layer parity tests;
4. visual inspection at the recorded viewport and compressed demo scale;
5. a clean public deployment;
6. a full live Site Tool replay;
7. a recording compatibility decision.

## Do not add to the submitted challenge build

Avoid scope that weakens the signature interaction: embedded chat, opaque optimizer, public frontier-search or batch-evaluation tool, generic multi-factory management, authentication, a model backend, real machine writes, agent-accessible locks, twelve overlapping v1/v2 tools, or a large catalogue of weak capabilities.

The challenge build wins by making one human-agent disagreement unusually clear, safe, inspectable, and evidence-backed.