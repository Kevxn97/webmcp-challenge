# Prototype and agent-system instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Before changing WebMCP behavior, read:

- `docs/PRODUCT_BRIEF.md` for product truth;
- `docs/AGENT_SYSTEM_DESIGN.md` for the normative agent-facing architecture;
- `docs/AGENT_SYSTEM_HARDENING_PLAN.md` for the audited implementation order and current semantic seams;
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

### Semantic integrity

- Define every control exactly once. Generate or derive its public schema, runtime validation, TypeScript type, unit, range or enum, resource ownership, application phase, evaluator operation mapping, lock scope, agent capability metadata, UI label, documentation, and parity tests from the same canonical definition.
- A value that passes public validation must not fail later because another layer uses a different range, unit, owner, phase, or lock scope.
- Speeds use `basis_points_of_nameplate`; `10000` means 100% of equipment nameplate.
- For the current public vocabulary, `packaging_calibration` belongs to Packaging and is covered by the Packaging lock.
- Distinguish collaborative planning time from simulated operational time. The current lock-bound proof models Packaging as effective at tick 16 / 240 elapsed minutes; one constant must drive store, evaluator, proof, tools, UI, tests, and docs.
- Availability is explicit and separate from value validity. A control may be `AVAILABLE`, `HUMAN_LOCKED`, `PHASE_CLOSED`, or `UNSUPPORTED`.
- Reject unavailable changed controls before evaluator execution. Normalize an unavailable requested value that already equals the effective value as a no-op.

### Zero hidden state

- Site Tool behavior must not depend on selected scenario column, open modal, focus, viewport, scroll position, hover, React render order, Strict Mode, HMR, or any other unexposed UI state.
- UI markers A and B are display pins, not durable scenario identity and not an implicit replacement policy.
- Scenario allocation must be deterministic and documented, or return an explicit capacity response. It must never depend on `selectedScenarioId`.
- Every human action that changes legal agent behavior advances an exposed revision or decision-epoch identity.

### Authority, lineage, and evidence

- Keep model identity, human authority, workspace revision, and evidence identity conceptually separate even when compatibility fields remain.
- Bind scenario heads to one authority epoch. After a human authority change, preserve the old receipt as history and create a clean branch rather than carrying inadmissible overrides forward.
- Store source model, scenario, lock/authority, mission, and evaluator identity with every receipt used for currentness or comparison.
- Currentness is explicit and reasoned. Historical evidence remains auditable but cannot support a current recommendation.
- A comparison may not silently select a historical or invalid receipt as the current winner.
- Make the first-run anchor semantics of `compare_simulation_runs` explicit in schema, result, tests, and documentation.
- Normalize same-value applies before commit. A semantic no-op must not increment scenario revision, clear a receipt, or trigger a duplicate simulation.

### Truth and claim discipline

- Every operational number, comparison, dominance result, invariant, or infeasibility claim must be derived from deterministic application evidence, never model-authored prose.
- Keep execution validity, source currentness, hard-constraint feasibility, proof state, and decision relation as separate axes. A compatibility summary may be derived from them, but must not hide invalid operations behind an attractive feasibility or proof label.
- Distinguish `DOMINATED`, `NON_DOMINATED`, `BEST_EVALUATED_UNDER_POLICY`, and `PROVEN_OPTIMAL`. Two compared scenarios do not establish global optimality.
- Structurally separate authoritative deterministic facts from untrusted user/agent display labels. Labels never affect routing, validation, evaluator behavior, currentness, or selection.
- Tool definitions and results are untrusted input. Keep schemas closed, validate independently, sanitize unexpected errors, and preserve abort behavior.

### Resource economy

- Optimize resource use through compact receipts, copyable continuations, evidence reuse, no-op normalization, source-bound caching, and delta reads—not by hiding meaningful state transitions.
- The minimal current two-scenario trace is eight calls: one orientation, then create/apply/run twice, then compare.
- After the one intentional stale write, a clean post-lock result requires four calls under the present grammar: refresh, create, apply, simulate.
- A shorter trace is not an improvement if it removes an inspectable hypothesis, mutation, evaluation, conflict, or recovery boundary.

## Challenge constraints

The submitted build wins through one unusually clear human-agent disagreement. Do not add scope that weakens it: embedded chat, authentication, real machine writes, multi-factory administration, generic dashboards, a model backend, public frontier-search or batch-optimizer tools, or a large catalogue of weak tools.

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
4. the human Packaging lock makes prior evidence historical;
5. the intentional pre-lock retry fails once and mutates no operational or scenario state;
6. a fresh read and clean branch respect the lock and temporal availability;
7. the current receipt still exposes the exact infeasibility proof;
8. tool behavior is unchanged by UI selection or modal state;
9. historical or invalid evidence cannot win a current comparison;
10. tool metadata, payloads, UI labels, README, submission copy, and demo script agree.