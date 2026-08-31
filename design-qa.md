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
- Copy and data: all scenario metrics, constraint evidence, receipt IDs, revision warnings, locks, and ledger events are tied to application state.
- Interaction: evidence dialog opens/closes and renders the receipt's actual engine identifier; Packaging lock toggles and increments revision; branching clears the receipt; re-simulation under the lock returns `PROVEN INFEASIBLE` and visibly renders its exact upper-bound proof; Reset clears scenarios and disables unavailable actions.
- Accessibility basics: semantic landmark regions, headings, table headers, native modal focus containment with Escape dismissal and trigger-focus restoration, labeled icon buttons, `aria-pressed` lock state, visible focus treatment, and native disabled states are present.
- Runtime: browser inspection after the complete interaction flow reported zero console errors and zero warnings.

## Responsive checks

- 1488 × 1058: exact reference comparison, no horizontal or vertical document overflow.
- 1024 × 900: no horizontal document overflow; ledger follows the primary decision surface; table scroll remains contained.
- 768 × 900: document width remains 768 px; wide factory and evidence canvases use contained horizontal scrolling.
- 390 × 844: document width remains 390 px; mission, state, tools, controls, and evidence remain usable while the industrial blueprint can be deliberately panned horizontally.

## Agent-system visual target

The current design passes against its selected visual target and recorded challenge flow. The hardened agent-system architecture adds a second acceptance target: the human and agent must be able to identify the same authority, temporal capability, evidence eligibility, and claim level when the app is compressed beside ChatGPT's Site Tools panel or shown briefly in a judge video.

This is not a request for more dashboard chrome. It is a request for **higher semantic signal per pixel**.

### 1. Human authority must dominate at the right moment

The Packaging control must:

- remain visible in both unlocked and locked states;
- use a comfortably readable control target and label at compressed demo scale;
- identify **Human control**, not merely show a lock icon;
- show the resulting authority revision;
- expose the canonical blocked controls;
- expose the modeled simulation effect at tick 16 / 240 elapsed minutes;
- avoid implying that the page controls live equipment.

Planning-time event and simulation-time effect must be visibly distinguishable.

### 2. Capability must be legible before action

Where current control availability is shown, use explicit text states:

- `Available`
- `Human locked`
- `Pre-shift only / phase closed`
- `Unsupported`

Do not rely on a disabled-looking control alone. The reason should be inspectable without forcing the human to infer it from a failed simulation.

### 3. Evidence eligibility must be unmistakable

Current, historical, and invalid evidence need distinct labels and reasons.

- `Current` means usable for the present decision epoch.
- `Historical` means truthful for an earlier source state but not eligible as the current recommendation.
- `Invalid` means operation or invariant failure and cannot win a comparison.

A historical receipt may retain its original pass/fail facts, but the UI must not visually read as though it is still the active plan.

### 4. Truth axes must not collapse into one badge

The UI should progressively expose:

- execution validity;
- source currentness;
- hard-constraint feasibility;
- proof state;
- decision relation such as dominated or best evaluated.

The compact surface may summarize, but the evidence view must let a judge verify that a current proof is not hiding invalid operations and that “best evaluated” is not “proven optimal.”

### 5. Durable identity and display pins must differ

Scenario A and B remain useful visual pins. They must not imply that those letters are the durable scenario identity or replacement policy.

The evidence view should make the stable scenario version and receipt identity available without flooding the main canvas.

### 6. Authoritative facts and display labels must differ

User or agent supplied scenario names are display labels. They should render as inert text and be visually subordinate to canonical IDs, status, and evidence when ambiguity exists.

A prompt-like or metric-like label must never look like a system instruction or verified fact.

### 7. Agent-adjacent compressed layout

Add a dedicated QA viewport representing the app beside an open Site Tools or Recently Used panel. At that width, verify that a judge can still read without zooming:

- the mission;
- WebMCP readiness;
- the human lock state;
- current versus historical evidence;
- the comparison outcome;
- the exact proof inequality.

The lock action and the `9252 < 10937` proof are the two highest-priority focal moments.

### 8. Zero-hidden-state interaction QA

Visual selection may change emphasis, but no selected column, open dialog, focus state, scroll state, or responsive layout may change Site Tool allocation or command semantics.

Run the same tool trace under varied presentation states and confirm identical scenario IDs, revisions, run IDs, and results.

## Target visual release gate

Before claiming the hardened agent-system contract:

1. capture the unlocked orientation state;
2. capture the two-scenario current comparison;
3. capture the human Packaging lock with blocked controls and effective time;
4. capture the intentional stale rejection while scenario state remains unchanged;
5. capture historical old evidence beside a clean current post-lock scenario;
6. capture independent validity/currentness/constraint/proof information;
7. capture the exact proof and engine identity;
8. repeat at the reference viewport, compressed agent-adjacent viewport, tablet, and mobile widths;
9. verify keyboard operation, focus restoration, screen-reader labels, and non-color status cues;
10. complete the full public WebMCP replay.

This remains a future agent-ergonomics criterion, not a claim that the verified challenge screenshot is broken. Any implementation change requires new comparison captures and a fresh pass of this report.

final result: passed for the submitted baseline; hardened shared-authority and evidence target specified
