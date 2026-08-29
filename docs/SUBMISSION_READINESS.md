# Submission readiness

Status date: 2026-08-29

Agentic Sandbox is technically implemented and locally self-contained. The remaining blockers are operational submission assets, not core product behavior.

## Official challenge gate

The OpenAI WebMCP Challenge evaluates usefulness, originality, execution quality, thoughtful WebMCP use, and the quality of the human-agent experience. A submission also needs a project description, working public app, code repository, and demo video.

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Useful product problem | Ready | Factory debottlenecking and constrained what-if planning are explained in `README.md` and `docs/SUBMISSION.md`. |
| Original concept | Ready | Human locks invalidate stale agent plans; the deterministic engine can prove infeasibility instead of inventing an answer. |
| Thoughtful WebMCP use | Ready | Six narrow top-level tools share the same command bus as the visible UI. |
| Human-agent collaboration | Ready | Signature flow includes live human intervention, atomic stale-write rejection, re-read, and replanning. |
| Deterministic evidence | Ready | Versioned SHA-256 receipts, exact constraint operands, conservation checks, and a lock-bound upper-limit proof. |
| Automated verification | Ready | GitHub Actions runs `npm ci` followed by the complete `npm run verify` gate. |
| Public HTTPS deployment | Pending | Deploy the repository without authentication and replace `ADD_PUBLIC_HTTPS_URL` in `docs/SUBMISSION.md`. |
| Public demo video | Pending | Record the flow in `docs/DEMO_SCRIPT.md`, upload it publicly, and replace `ADD_PUBLIC_YOUTUBE_URL`. |
| Judge access to source | Pending decision | The repository is currently private. Make it public or confirm the submission grants judges access before the deadline. |
| Final WebMCP host replay | Pending | Replay the exact evaluator prompts in ChatGPT's in-app browser against the public deployment. |

## Release acceptance criteria

A release candidate is submission-ready only when all of the following are true:

- [ ] `npm run verify` passes from a clean checkout.
- [ ] The GitHub `Verify` workflow is green on `main`.
- [ ] The public HTTPS deployment loads without authentication, redirects, or environment configuration.
- [ ] The page reports `WebMCP ready` in ChatGPT's in-app browser.
- [ ] All six Site Tools are discoverable from the top-level document.
- [ ] Reset produces an unlocked factory with empty scenario slots.
- [ ] The documented two-scenario flow reproduces the stored output and cost outcomes.
- [ ] Locking Packaging increments the visible revision and marks prior scenarios stale.
- [ ] Reusing pre-lock revisions with a fresh request ID returns `STALE_FACTORY` and mutates nothing.
- [ ] A fresh locked replan preserves Packaging and produces the visible `9252 < 10937` infeasibility proof.
- [ ] The demo video is public, under three minutes, and shows actual Site Tool calls.
- [ ] Live URL and video URL replace both placeholders in `docs/SUBMISSION.md`.
- [ ] Repository access is sufficient for judges.

## Do not add before submission

Avoid scope that weakens the signature interaction: an embedded chatbot, generic multi-factory management, real machine writes, authentication, a model backend, or a large catalogue of weak tools. The challenge build wins by making one human-agent disagreement unusually clear and trustworthy.
