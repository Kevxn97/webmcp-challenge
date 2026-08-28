# Agentic Sandbox product brief

## Product promise

Agentic Sandbox is a deterministic operational decision lab. A human and a WebMCP-capable agent inspect the same live factory state, branch alternatives, simulate them, and respond safely when a human changes a constraint during the run.

## Visual source of truth

`docs/visual-target-precision-blueprint.png` is the selected direction. The implementation should preserve its:

- warm technical-blueprint language;
- dominant left-to-right factory flow;
- revision ledger and visible evidence trail;
- spatial scenario overlays;
- dense, precise comparison table;
- IBM Plex-style typography;
- ultramarine, vermilion, and green semantic colors.

## Truth contract

- The baseline is immutable.
- Scenarios are versioned branches.
- Human locks increment the factory revision and invalidate stale branches.
- Agent mutations fail closed on stale revisions or locked resources.
- Every visible metric comes from a deterministic, stored simulation receipt.
- The system is a sandbox only. It has no machine-control or external side effects.

## Hero demo

1. The agent reads the current factory and its constraints.
2. It creates and simulates competing scenarios.
3. The human locks Packaging in the live interface.
4. The prior plan becomes stale and cannot be silently applied.
5. The agent re-reads the factory and either produces a valid alternative or proves the goal infeasible under the new lock.

## Deliberate exclusions

No embedded chatbot, multi-factory scope, authentication, real plant integration, physics simulation, or generic dashboard inventory belongs in the challenge build.
