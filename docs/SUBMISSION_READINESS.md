# Submission readiness

Status date: 2026-08-31

Agentic Sandbox is technically implemented, locally self-contained, publicly deployed, verified through ChatGPT Work's Cloud Browser against the live URL, documented with a public demo video, and submitted to the OpenAI WebMCP Challenge on Devpost.

The submitted runtime remains the verified release baseline. A subsequent agent-system design pass now defines how the interface can become more legible, copyable, evidence-accretive, and resource-efficient without weakening the challenge's signature human-agent interaction. Target design statements are not implementation claims.

## Official challenge gate

The challenge evaluates usefulness, originality, execution, thoughtful WebMCP use, and the quality of the human-agent experience. A submission also needs a project description, working public app, source repository, and demo video.

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Useful product problem | Ready | Factory debottlenecking and constrained what-if planning are explained in `README.md` and `docs/SUBMISSION.md`. |
| Original concept | Ready | Human locks invalidate stale agent plans; the deterministic engine can prove infeasibility instead of inventing an answer. |
| Thoughtful WebMCP use | Ready | Exactly six narrow top-level tools share the same command bus and authority model as the visible UI. |
| Human-agent collaboration | Ready | The signature flow includes live human intervention, one intentional stale-write rejection, a fresh read, replanning, and shared proof. |
| Deterministic evidence | Ready | Versioned SHA-256 receipts, exact constraint operands, conservation checks, operation audits, and a lock-bound upper-limit proof. |
| Agent-system design | Specified | `docs/AGENT_SYSTEM_DESIGN.md` defines the linked abstraction tower, canonical contracts, recovery behavior, evidence graph, and challenge-safe roadmap. |
| Agent evaluation | Specified | `docs/AGENT_EVAL_PLAN.md` defines golden traces, correctness, recovery, explanation, and resource-efficiency gates. |
| Automated verification | Ready | GitHub Actions runs `npm ci` followed by `npm run verify`; the recorded baseline passes 84 Vitest tests and 5 Sites tests. |
| Public HTTPS deployment | Ready | `https://webmcp-challenge-seven.vercel.app` loads without authentication and serves the current production build. |
| Public demo video | Ready | The public 2:54 YouTube demo includes audio and visible Site Tool calls: `https://www.youtube.com/watch?v=3KwBtJU9fow`. |
| Judge access to source | Ready | The repository is public and GitHub detects the MIT license. |
| Final WebMCP host replay | Ready | The exact reset, two-scenario, human-lock, stale-write, fresh-read, and locked-replan flow passed against the public deployment in ChatGPT Work's Cloud Browser on 2026-08-29. |
| Devpost submission | Submitted | Devpost reports `Submitted` and `5/5 steps done`; the public entry is `https://devpost.com/software/agentic-sandbox`. |

## Verified live host replay

The 2026-08-29 acceptance replay used ChatGPT Work's Cloud Browser and the public deployment, not a local bridge or mocked `modelContext`.

- ChatGPT discovered exactly six top-level Site Tools and the page reported `WebMCP ready`.
- **Reset demo** returned no active locks, Packaging was unlocked, and Scenario A and Scenario B were both `Not run`.
- Scenario A and Scenario B were created, revised, simulated for one shift, and compared through Site Tool calls.
- Both produced 11,114 good units. Scenario A failed the cost cap at EUR 47,670.51; Scenario B passed all four constraints at EUR 45,170.51.
- The human Packaging lock advanced the live state and visibly marked the earlier Scenario B receipt stale.
- A fresh request carrying the exact pre-lock revisions returned `STALE_FACTORY` with `current_factory_revision: 5`.
- Scenario B remained at revision 2 with the same prior run ID, proving the rejected call mutated nothing.
- After a fresh factory read, the agent changed only unlocked controls, simulated one shift, and received `PROVEN_INFEASIBLE_UNDER_LOCKS`.
- The live evidence dialog showed `9252 < 10937`, `factory-lock-upper-bound/v1`, a current proven source, and `factory-engine/1.0.0`.

## Current release contract

The following behaviors are implemented and may be claimed for the public challenge build:

- exactly six top-level imperative Site Tools;
- one application-owned command bus shared by UI and tools;
- closed schemas plus independent runtime validation;
- request IDs and optimistic factory/scenario/lock revisions;
- human-only Packaging lock with no agent override;
- atomic stale and locked-write rejection;
- immutable deterministic receipts and explicit currentness;
- exact output, cost, defect, asset, invariant, and proof evidence;
- normal human operation when WebMCP is unavailable;
- one complete public challenge replay and recording.

## Target agent-system contract

The following improvements are specified but must not be described as implemented until they pass code review, automated tests, UI evidence, and a fresh public WebMCP replay:

- copy-ready continuation objects whose keys match the next tool input;
- a compact state token and optional incremental snapshot mode;
- canonical control metadata shared by schema, validation, simulation, locks, UI, and documentation;
- active-lock objects containing blocked fields and effective time;
- exact derived mission thresholds and declared tie-break rules;
- an evidence index for recovering prior receipts without rerunning them;
- complete precondition diffs plus `committed: false` and recovery guidance on expected errors;
- clean scenario branches after a human authority change;
- deterministic constraint slack, dominance, Pareto frontier, and lowest-cost feasible selection;
- trace-level agent ergonomics and context-loss recovery evaluation.

The target contract must remain additive and keep exactly six tools. It must reduce accidental interface friction without removing the explicit read, branch, simulation, comparison, conflict, recovery, and proof boundaries that make the challenge interaction meaningful.

## Known semantic seams to resolve before claiming the target contract

| Seam | Risk | Required resolution |
| --- | --- | --- |
| `packaging_calibration` is blocked by the store's Packaging lock, while the engine currently attributes calibration to Quality Gate | Tool authority and simulation authority can describe the same control differently | Establish one canonical control definition and generate ownership and lock behavior from it. |
| Lock is visually “now,” while the proof models it at tick 16 / 240 elapsed minutes | The source of the 9,252 upper bound is not self-evident | Define one lock-timing constant and expose it consistently in tool output, UI, proof, and docs. |
| Post-lock mutation can merge unlocked fields into a pre-lock scenario patch | A supposedly clean replan can retain historical Packaging overrides | Freeze stale heads and create a fresh scenario bound to the new authority epoch. |
| Snapshot and write field names require manual reconstruction | Avoidable model memory and transcription load | Return copy-ready continuation metadata using exact write-input keys. |
| Expected errors expose only partial recovery state | Agents may over-read, guess, or retry unnecessarily | Return complete precondition diffs, commit status, and the exact recovery read. |
| Comparison reports candidates but not dominance | The model must repeat deterministic arithmetic | Add declared and tested dominance and selection summaries. |

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
- [x] Reusing pre-lock revisions with a fresh request ID returns `STALE_FACTORY` and mutates nothing.
- [x] A fresh locked replan preserves Packaging and produces the visible `9252 < 10937` proof.
- [x] The demo video is public, under three minutes, and shows actual Site Tool calls.
- [x] The live application URL, source repository, and public video are present in the submission copy.
- [x] The repository is public and GitHub detects the MIT license.
- [x] The Devpost entry is submitted and publicly available.
- [ ] Any future target-contract implementation passes every applicable golden trace in `docs/AGENT_EVAL_PLAN.md`.
- [ ] Any changed public contract is replayed against the production deployment in ChatGPT's built-in browser.
- [ ] Documentation, schemas, runtime behavior, visible UI, and recorded evaluator prompts agree exactly.

## Change-control rule before judging

Do not merge a live-code change merely because it is architecturally cleaner. Merge only when it is additive, backwards compatible with the evaluator prompts, demonstrably clearer to an agent and a judge, and fully replayed.

Documentation-only changes may clarify the system, but must preserve a bright line between current behavior and target design. A code change to WebMCP registration, schemas, validation, store semantics, engine semantics, lock timing, receipt structure, scenario lineage, or visible evidence triggers:

1. the complete automated gate;
2. all applicable agent golden traces;
3. visual inspection at the recorded viewport and compressed demo scale;
4. a clean public deployment;
5. a full live Site Tool replay;
6. a recording compatibility decision.

## Do not add to the submitted challenge build

Avoid scope that weakens the signature interaction: an embedded chatbot, opaque optimizer, generic multi-factory management, authentication, a model backend, real machine writes, agent-accessible locks, or a large catalogue of weak tools.

The challenge build wins by making one human-agent disagreement unusually clear, safe, inspectable, and evidence-backed.
