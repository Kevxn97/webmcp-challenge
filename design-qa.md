# Design QA — Agentic Sandbox

## Reference and implementation

- Reference: `docs/visual-target-precision-blueprint.png`
- Verified implementation: `docs/agentic-sandbox-desktop.png`
- Side-by-side evidence: `docs/design-comparison.png`
- Focused factory/ledger evidence: `docs/design-comparison-top.png`
- Focused table/decision-bar evidence: `docs/design-comparison-bottom.png`
- Reference pixels: 1487 × 1058, normalized to 1488 × 1058 for comparison
- Implementation viewport: 1488 × 1058 CSS pixels at device scale factor 1
- Compared state: hydrated baseline, failed Scenario A, feasible Scenario B, then a human Packaging lock that makes prior receipts stale

## Visual comparison

The implementation preserves the reference's precision-blueprint composition: warm drafting-paper surface, ruled technical grid, condensed uppercase labels, five-stage factory line, red/blue scenario traces, exact comparison table, right-hand revision ledger, and bottom decision controls. The full view fits the reference viewport with no document scroll or clipping.

Intentional product-truth differences from the concept image:

- Metrics come from the deterministic simulator rather than the concept image's placeholder values.
- The header exposes current Site Tools capability (`Human mode` when `document.modelContext` is unavailable) instead of a decorative date.
- Scenario B is shown as stale after the human lock because its receipt was produced under the prior lock revision; the reference communicates the same revision-mismatch idea while still labeling B feasible.
- Constraint feasibility is summarized in the selected-scenario bar and per-row status/evidence cells rather than repeated as a decorative table row.

No visible P0, P1, or P2 mismatch remains against the selected visual target in the verified challenge state.

## Iteration record

1. The first matched build compressed the decision table and left too much unused space in the blueprint region. Increased evidence-cell padding and a stronger decision bar restored the source hierarchy.
2. The second build grouped the scenario traces too tightly. The trace stack now distributes Baseline, Scenario A, and Scenario B evenly through the available factory canvas.
3. The final pass replaced the domestic-looking mixer symbol with an industrial gear icon, kept the Packaging lock discoverable in both states, tied state/trace labels to live revisions and receipts, and disabled Run/Branch/Explain for empty scenario slots.
4. The recording-readiness pass surfaced the real receipt engine version and added a dedicated lock-bound proof panel. The exact `9252 < 10937` inequality is now visible in the product rather than only inside a tool response.

## Required surface checks

- Typography: condensed technical display face for labels and humanist sans for values; weights, letter spacing, and hierarchy remain legible at all tested widths.
- Spacing and alignment: factory cards, flow arrows, trace nodes, ledger rows, table rules, and decision controls align to a shared drafting grid.
- Color: off-white paper, graphite rules, safety red, blueprint blue, and receipt green match the reference's restrained technical palette. Status is never communicated by color alone.
- Imagery and texture: the project-specific generated drafting-grid asset creates paper depth without reducing text contrast.
- Icons: Phosphor icons provide coherent truck, gear, package, shield, warehouse, lock, receipt, agent, branch, and warning symbols; there are no emoji, inline SVG approximations, or placeholder boxes.
- Copy and data: all scenario metrics, constraint evidence, receipt IDs, revision warnings, locks, and ledger events are tied to live application state.
- Interaction: evidence dialog opens/closes and renders the receipt's actual engine identifier; Packaging lock toggles and increments revision; branching clears the receipt; re-simulation under the lock returns `PROVEN INFEASIBLE` and visibly renders its exact upper-bound proof; Reset clears scenarios and disables unavailable actions.
- Accessibility basics: semantic landmark regions, headings, table headers, native modal focus containment with Escape dismissal and trigger-focus restoration, labeled icon buttons, `aria-pressed` lock state, visible focus treatment, and native disabled states are present.
- Runtime: browser inspection after the complete interaction flow reported zero console errors and zero warnings.

## Responsive checks

- 1488 × 1058: exact reference comparison, no horizontal or vertical document overflow.
- 1024 × 900: no horizontal document overflow; ledger follows the primary decision surface; table scroll remains contained.
- 768 × 900: document width remains 768 px; wide factory and evidence canvases use contained horizontal scrolling.
- 390 × 844: document width remains 390 px; mission, state, tools, controls, and evidence remain usable while the industrial blueprint can be deliberately panned horizontally.

## Agent-system visual follow-up

The current design passes against its selected visual target and recorded challenge flow. The subsequent agent-system review adds a separate product requirement: the human authority change must remain unmistakable when the app is compressed beside ChatGPT's Site Tools panel or shown in a short judge video.

Before claiming the target agent-system contract, evaluate an additive lock-state treatment that:

- keeps the Packaging control visible in both unlocked and locked states;
- makes **Human control** and the resulting authority revision legible without relying on color;
- exposes the blocked control set and the modeled effective time used by the proof;
- visually distinguishes current evidence from historical evidence after the lock;
- does not turn the page into a tutorial or add a second interaction surface.

This is a future agent-ergonomics criterion, not a claim that the verified screenshot is broken. Any implementation change requires a new side-by-side capture, responsive QA, accessibility check, and full live WebMCP replay before this report can be marked passed again.

final result: passed for the submitted baseline; target-contract visual follow-up specified
