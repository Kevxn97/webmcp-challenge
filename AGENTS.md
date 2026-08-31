# Prototype and system instructions

## Working behavior

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy. Product semantics and truth contracts still override decorative mock content.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Canonical design documents

Read these before changing architecture, WebMCP contracts, state semantics, simulation behavior, or agent-facing UX:

1. `docs/PRODUCT_BRIEF.md` — product promise, participants, truth contract, and scope.
2. `docs/AGENT_SYSTEM_DESIGN.md` — target architecture and linked abstractions.
3. `docs/AGENT_CONTRACT.md` — normative `factory-tools/v2` agent contract.
4. `docs/AGENT_ERGONOMICS_IMPLEMENTATION_PLAN.md` — migration sequence and acceptance gates.
5. `docs/AGENT_TRAJECTORY_EVALS.md` — model-in-the-loop evaluation requirements.
6. `docs/SUBMISSION_READINESS.md` — frozen challenge evidence and release record.

When documents conflict, preserve the verified submitted `factory-tools/v1` behavior and open an explicit architecture decision before changing it. Do not silently reinterpret an existing contract.

## System thesis

Agentic Sandbox is one shared decision substrate, not a dashboard plus a tool adapter. The human UI and WebMCP interface are projections of the same canonical operational state, event history, immutable scenario graph, and deterministic evidence.

The human owns intent and authority boundaries. The agent owns bounded exploration and explanation. Deterministic software owns operational truth, exact arithmetic, currentness, and proofs.

## Non-negotiable invariants

1. One canonical ID has one meaning across schema, runtime validation, command handling, evaluator, UI, tests, and docs.
2. Every control has one owner, unit, domain, application phase, operation mapping, and lock scope.
3. Planning time, operational event time, and simulation time are explicit and separate.
4. Reads provide knowledge; a state token binds write authority.
5. Writes are atomic and idempotent. A rejected write commits nothing.
6. Successful writes return a read-your-write projection.
7. Recoverable errors include `committed: false`, changed state, and one legal recovery route.
8. Evidence is immutable. Currentness is contextual and must include invalidation reasons.
9. Scenario history is append-only. A/B labels are UI pins, not storage slots.
10. Impossible or unavailable controls are rejected before evaluator execution.
11. Equivalent normalized evaluator inputs reuse content-addressed receipts.
12. Feasibility, Pareto dominance, policy rank, best-evaluated, and proven-optimal are distinct claims.
13. Detail is progressive; do not return full tick traces or ledgers by default.
14. Human locks have no agent-accessible override.
15. No challenge tool performs external or physical-machine side effects.

## Canonical control ontology

Do not duplicate control semantics in independent constants or switch statements. The target implementation uses one versioned `CONTROL_DEFINITIONS` registry to derive:

- TypeScript contract helpers;
- JSON Schema;
- runtime validation;
- command availability and no-op normalization;
- evaluator operation mapping;
- lock coverage;
- planning-context projections;
- UI labels and formatting;
- documentation and boundary tests.

Until that registry exists, any change to a control requires a parity review across all of those layers.

Known semantic defects to eliminate in the first implementation PR:

- public speed bounds currently extend beyond the evaluator's accepted maximum;
- calibration ownership/lock semantics currently differ between the agent layer and evaluator;
- phase-constrained controls are not explicit enough in planning context;
- the current Packaging lock implicitly carries tick-16 semantics.

## WebMCP profile discipline

The repository has two conceptual profiles:

- `challenge-v1` — the submitted and live-replay-verified six-tool challenge build;
- `agent-native-v2` — the target six intent-level tools described in `docs/AGENT_CONTRACT.md`.

Never register both profiles in the same top-level page. A compatible host must discover exactly one coherent six-tool surface.

Do not mutate the production challenge profile merely to prototype v2. Develop v2 behind explicit profile isolation and verify it on a separate preview deployment before cutover.

Tool descriptions must state intent, side effects, preconditions, verification data, and recovery. Schemas remain closed and narrow. Runtime validation remains independent from schema. Unexpected errors remain sanitized.

## State and evidence ownership

Keep these abstractions separate:

- operational state and typed event log;
- canonical control ontology;
- deterministic evaluator;
- command/authority layer;
- immutable scenario/evidence graph;
- WebMCP projections;
- human UI projections.

Do not collapse them into an oversized store or let UI labels become domain identifiers.

A scenario version records requested changes, normalized no-op-free changes, complete effective controls, source operational state token, lineage, evaluator input hash, and receipt ID.

A receipt remains content-addressed and immutable. Reuse may change the currentness projection, never the receipt contents.

## Agent ergonomics budgets

Design and test toward:

- no more than four tool calls from cold start to a ranked recommendation;
- no more than three calls in the complete stale-write/recovery path;
- zero duplicate evaluator executions for an identical canonical input hash;
- zero routine read-after-write calls;
- zero hidden scenario deletion;
- no full receipt transfer unless requested.

Do not reduce calls by hiding state, authority, currentness, or evidence assumptions.

## Testing requirements

Before merging behavior changes, run the complete local gate:

```bash
npm run verify
```

Add tests at the layer that owns the invariant and at the cross-layer boundary that could drift.

Required categories for agent-native work:

- generated control parity and exact boundaries;
- lock and phase availability;
- no-op normalization;
- operational state-token properties;
- atomic batch behavior and idempotency;
- receipt-cache identity;
- immutable scenario lineage;
- comparison order invariance and Pareto correctness;
- structured currentness and recovery;
- profile discovery count;
- agent trajectory call, byte, and evaluator budgets;
- live WebMCP host replay.

Unit tests do not replace trajectory evaluation. Do not declare the v2 surface agent-intuitive until unfamiliar-agent trajectories pass the gates in `docs/AGENT_TRAJECTORY_EVALS.md`.

## Change protocol

For a substantial system change:

1. Name the invariant or agent failure being addressed.
2. Identify the abstraction layer that owns the fix.
3. Update the canonical definition first.
4. Derive or update dependent projections without introducing alternate semantics.
5. Add negative and boundary tests.
6. Measure tool calls, bytes, evaluator executions, and recovery behavior where relevant.
7. Update the linked design document if the architecture decision changed.
8. Verify the normal human interface still works without WebMCP.
9. Verify no agent lock override or external side effect was introduced.
10. Keep the challenge profile frozen until the replacement profile passes its isolated live replay.

Prefer root-cause fixes. Do not paper over ontology, temporal, state, or provenance defects with longer tool descriptions or model instructions.
