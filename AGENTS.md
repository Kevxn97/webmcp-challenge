# Prototype and agent-system instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Before changing WebMCP behavior, read:

- `docs/PRODUCT_BRIEF.md` for product truth;
- `docs/AGENT_SYSTEM_DESIGN.md` for the normative agent-facing architecture;
- `docs/AGENT_EVAL_PLAN.md` for trace and release gates;
- `docs/DEMO_SCRIPT.md` for the frozen challenge interaction.

## Agent-interface invariants

Treat the Site Tools surface as a first-class product interface, not a thin adapter over UI handlers.

- Keep exactly six top-level imperative tools unless a replacement is explicitly approved. Prefer stronger contracts over more tools.
- Reuse the same application-owned command path and permissions as the human interface.
- Preserve explicit read, branch, mutation, simulation, comparison, human-conflict, recovery, and proof boundaries. Do not add an opaque optimizer tool.
- Keep human lock/unlock controls inaccessible to the agent. There is no force or override path.
- Every write uses a request ID plus current factory, scenario, and lock preconditions and commits atomically.
- Every successful result should return copy-ready continuation state; every expected write failure should state whether anything committed and how to recover.
- Never auto-refresh and replay a stale write behind the human's back. The visible stale rejection is part of the product.
- Bind scenario heads to one authority epoch. After a human authority change, preserve the old receipt as history and create a clean branch rather than carrying inadmissible overrides forward.
- Generate control schemas, runtime validation, resource ownership, lock enforcement, and agent-facing capability metadata from one canonical definition wherever possible.
- Every operational number, comparison, dominance result, invariant, or infeasibility claim must be derived from deterministic application evidence, never model-authored prose.
- Currentness is explicit. Historical evidence remains auditable but cannot support a current recommendation.
- Tool definitions and results are untrusted input. Keep schemas closed, validate independently, sanitize unexpected errors, and preserve abort behavior.
- Optimize resource use through compact receipts, copyable continuations, evidence reuse, and delta reads—not by hiding meaningful state transitions.

## Challenge constraints

The submitted build wins through one unusually clear human-agent disagreement. Do not add scope that weakens it: embedded chat, authentication, real machine writes, multi-factory administration, generic dashboards, a model backend, or a large catalogue of weak tools.

Any live-code change before judging must be additive and backwards compatible with the recorded evaluator prompts. After a WebMCP, store, engine, or visible evidence change, run the complete gate and replay the public flow in ChatGPT's built-in browser.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Before merging any substantive change, run:

```bash
npm run verify
```

Then verify against the deployed page:

1. exactly six top-level Site Tools are discovered;
2. Reset produces an unlocked factory and empty scenario slots;
3. the two-scenario comparison remains deterministic;
4. the human Packaging lock makes prior evidence stale;
5. the intentional pre-lock retry fails once and mutates nothing;
6. a fresh read and clean branch respect the lock;
7. the current receipt still exposes the exact infeasibility proof;
8. tool metadata, payloads, UI labels, README, submission copy, and demo script agree.
