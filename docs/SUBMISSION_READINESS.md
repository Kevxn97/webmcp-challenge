# Submission readiness

Status date: 2026-08-30

Agentic Sandbox is technically implemented, locally self-contained, publicly deployed, verified through ChatGPT Work's Cloud Browser against the live URL, documented with a public demo video, and submitted to the WebMCP Challenge on Devpost.

## Official challenge gate

The OpenAI WebMCP Challenge scores WebMCP Leverage, Execution, Potential Impact, and Creativity & Ambition. A submission also needs a project description, working public app, code repository, and demo video.

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Useful product problem | Ready | Factory debottlenecking and constrained what-if planning are explained in `README.md` and `docs/SUBMISSION.md`. |
| Original concept | Ready | Human locks invalidate stale agent plans; the deterministic engine can prove infeasibility instead of inventing an answer. |
| Thoughtful WebMCP use | Ready | Six narrow top-level tools share the same command bus as the visible UI. |
| Human-agent collaboration | Ready | Signature flow includes live human intervention, atomic stale-write rejection, re-read, and replanning. |
| Deterministic evidence | Ready | Versioned SHA-256 receipts, exact constraint operands, conservation checks, and a lock-bound upper-limit proof. |
| Automated verification | Ready | GitHub Actions runs `npm ci` followed by the complete `npm run verify` gate; the current checkout passes 84 Vitest tests and 5 Sites tests. |
| Public HTTPS deployment | Ready | `https://webmcp-challenge-seven.vercel.app` loads without authentication and serves the same hashed JS/CSS assets as the current `main` build. |
| Public demo video | Ready | The public 2:54 YouTube demo includes audio and visible Site Tool calls: `https://www.youtube.com/watch?v=3KwBtJU9fow`. |
| Judge access to source | Ready | The repository is public and GitHub detects the MIT license. |
| Final WebMCP host replay | Ready | The exact reset, two-scenario, human-lock, stale-write, re-read, and locked-replan flow passed against the public deployment in ChatGPT Work's Cloud Browser on 2026-08-29. |
| Devpost submission | Submitted | Devpost reports `Submitted` and `5/5 steps done`; the public entry is `https://devpost.com/software/agentic-sandbox`. |

## Verified live host replay

The 2026-08-29 acceptance replay used ChatGPT Work's Cloud Browser and the public deployment, not a local bridge or a mocked `modelContext`:

- ChatGPT discovered exactly six top-level Site Tools and the page reported `WebMCP ready`.
- **Reset demo** returned `locks: []`, Packaging was unlocked, and Scenario A and Scenario B were both `Not run`.
- Scenario A and Scenario B were created, revised, simulated for one shift, and compared through Site Tool calls. Both produced 11,114 good units; Scenario A failed the cost cap at EUR 47,670.51, while Scenario B passed all four constraints at EUR 45,170.51.
- The human Packaging lock advanced the live state and visibly marked the earlier Scenario B receipt stale.
- A fresh request using the exact pre-lock revisions returned `STALE_FACTORY` with `current_factory_revision: 5`. Scenario B remained at revision 2 with the same prior run ID, proving the rejected call mutated nothing.
- After a fresh factory read, the agent changed only unlocked controls (Mixer at 9,500 bps and standard supplier), simulated one shift, and received `PROVEN_INFEASIBLE_UNDER_LOCKS`.
- The live evidence dialog showed `9252 < 10937`, `factory-lock-upper-bound/v1`, a current proven source, and `factory-engine/1.0.0`.

## Release acceptance criteria

A release candidate is submission-ready only when all of the following are true:

- [x] `npm run verify` passes from a clean checkout.
- [x] The GitHub `Verify` workflow is green on `main`.
- [x] The public HTTPS deployment loads without authentication, redirects, or environment configuration.
- [x] The page reports `WebMCP ready` in ChatGPT's in-app browser.
- [x] All six Site Tools are discoverable from the top-level document.
- [x] Reset produces an unlocked factory with empty scenario slots.
- [x] The documented two-scenario flow reproduces the stored output and cost outcomes.
- [x] Locking Packaging increments the visible revision and marks prior scenarios stale.
- [x] Reusing pre-lock revisions with a fresh request ID returns `STALE_FACTORY` and mutates nothing.
- [x] A fresh locked replan preserves Packaging and produces the visible `9252 < 10937` infeasibility proof.
- [x] The demo video is public, under three minutes, and shows actual Site Tool calls.
- [x] The live application URL is present in `docs/SUBMISSION.md`.
- [x] The public YouTube URL replaces `ADD_PUBLIC_YOUTUBE_URL` in `docs/SUBMISSION.md`.
- [x] The repository is public and GitHub detects the MIT license.
- [x] The Devpost entry is submitted and publicly available at `https://devpost.com/software/agentic-sandbox`.

## Do not add to the submitted challenge build

Avoid scope that weakens the signature interaction: an embedded chatbot, generic multi-factory management, real machine writes, authentication, a model backend, or a large catalogue of weak tools. The challenge build wins by making one human-agent disagreement unusually clear and trustworthy.
