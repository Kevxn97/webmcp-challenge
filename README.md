# Agentic Sandbox

**A deterministic factory decision lab where a human and a browser agent replan the same live system together.**

[Open the live application →](https://webmcp-challenge-seven.vercel.app)

![Agentic Sandbox precision-blueprint interface](docs/agentic-sandbox-desktop.png)

Agentic Sandbox is built for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/). It is not a chatbot pasted onto a dashboard. The page exposes a small, typed tool surface over the same versioned command path used by the visible interface. An agent can inspect the line, create alternatives, apply bounded settings, run the deterministic simulator, and compare receipts. A human can change the rules mid-flow by locking Packaging; stale agent work then fails closed and the new constraint is visible to both sides.

## The signature interaction

The landing state shows the completed showcase so the result is immediately inspectable. For a live agent run, click **Reset demo** once first. Confirm Packaging now says **Lock resource**, both scenario slots say **Not run**, and the Site Tools status says **WebMCP ready** in a supported host.

Give the browser agent this mission:

> Increase good output by at least 20%. Total cost may rise by at most 8%. Do not add a machine, and do not increase the defect rate. Inspect the factory, build alternatives, simulate them, and compare the evidence.

Then, while it works, click **Lock resource** on Packaging and add:

> Packaging may not be changed. Re-read the factory and replan.

The prior scenario becomes stale. A write using the old lock revision is rejected atomically. After re-reading, the agent can try changes elsewhere and the simulator can issue a conservative proof that the target is infeasible under the active Packaging lock.

That interruption is the product: the human is not approving opaque agent prose, and the agent is not scraping pixels. Both collaborate through one inspectable state and one evidence model.

## Audience and potential impact

The initial users are plant planners, industrial engineers, and continuous-improvement teams who currently move a single decision across dashboards, spreadsheets, simulation specialists, and approval meetings. That handoff is slow, and an unconstrained assistant makes the authority boundary worse: it can recommend a change without knowing which resources the operator has just taken off the table.

Agentic Sandbox demonstrates a practical adoption wedge for debottlenecking, shift planning, and supplier what-if analysis. In a production version, the embedded deterministic model would be replaced or supplemented by a validated digital twin while the WebMCP contract, receipt trail, and human locks remain. The system would still stop at decision support—ERP, PLC, SCADA, and physical-machine changes stay behind their existing approval paths.

## Six browser-native Site Tools

The app registers exactly six imperative tools at the top-level page through `document.modelContext.registerTool(...)`.

| Tool | Kind | Purpose |
| --- | --- | --- |
| `get_factory_snapshot` | Read | Read the current factory version, mission, locks, baseline, and scenario heads. |
| `get_scenario_snapshot` | Read | Read one immutable scenario head, its bounded settings, staleness, and latest receipt. |
| `create_scenario` | Write | Branch local planning state from an expected factory and lock revision. |
| `apply_scenario_changes` | Write | Atomically apply absolute, typed operating settings. Human locks always win. |
| `run_factory_simulation` | Write | Run and store one deterministic 16-hour/64-tick shift receipt. |
| `compare_simulation_runs` | Read | Compare two to four stored receipts and their exact constraint outcomes. |

The registration layer feature-detects WebMCP, remains stable across React Strict Mode/HMR, validates arguments independently of JSON Schema, propagates cancellation, sanitizes unexpected errors, and returns a closed `factory-tools/v1` JSON envelope. There is deliberately no `lock`, `unlock`, `force`, or arbitrary-patch tool.

## Why the evidence is trustworthy

The model never supplies a displayed KPI. The local engine computes every claim with integer or fixed-point arithmetic and produces a content-addressed SHA-256 receipt containing:

- immutable input and engine hashes;
- accepted and rejected operations;
- 64 deterministic tick snapshots;
- exact good-output, defect, energy, and cost counters;
- a category-level cost ledger;
- four constraint checks with exact operands;
- conservation and asset-inventory invariants;
- bottleneck evidence;
- a lock-bound upper-bound proof when applicable.

The seeded acceptance cases are intentionally easy to audit:

| Case | Good output | Result |
| --- | ---: | --- |
| Baseline | 9,114 | Reference receipt |
| Constrained plan | 11,114 | All four constraints pass |
| Expedite plan | 11,114 | Fails the 8% cost cap |
| Packaging locked at tick 16 | ≤9,252 upper bound | Target 10,937 is proven unreachable under the lock |

## Local development

Requirements: a current Node.js release and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The human interface works in browsers without WebMCP. In ChatGPT's built-in browser, Site Tools are discovered from the top-level document. In a compatible Chrome build, enable the WebMCP testing flag or use the relevant origin trial.

Run the complete local gate:

```bash
npm run verify
```

Useful focused commands:

```bash
npm run typecheck
npm test
npm run build
```

## Deployment

The repository is self-contained and needs no environment variables or backend. `vercel.json` pins the Vite output directory to `dist/client`, so a Vercel project can build it without a dashboard-only output override. Before sharing with judges, confirm the deployment is public, HTTPS, and not protected by a login wall.

## Architecture

```text
Human controls ─┐
                ├─> versioned SandboxStore / command bus ─> deterministic engine
WebMCP tools ───┘                    │                            │
                                    ├─> immutable scenario heads │
                                    ├─> human lock ledger         │
                                    └─> visible revision ledger <─┘
```

- `src/domain/` contains the pure simulator, fixtures, hashes, constraints, and receipts.
- `src/app/` owns versioned scenario state, idempotency, optimistic concurrency, human locks, and the shared command bus.
- `src/webmcp/` owns registration, schemas, runtime validation, tool envelopes, and browser lifecycle handling.
- `src/ui/` renders the precision-blueprint factory, comparison evidence, and append-only revision ledger.

Everything runs locally in the page. There is no model API key, backend, account, purchase, PLC, SCADA, or physical-machine integration.

## Safety boundaries

- This is a decision sandbox, not a production-control surface.
- Tool arguments, names, and results are treated as untrusted input.
- Every mutation uses a request ID plus expected factory/scenario/lock revisions.
- Same request ID + same payload returns the original result; reuse with a different payload fails.
- A stale or locked batch applies nothing.
- Human locks are created and removed only through the visible human UI.
- The baseline and stored simulation receipts are immutable.
- Normal human controls remain available when WebMCP is absent.

## Challenge material

- [Product and truth brief](docs/PRODUCT_BRIEF.md)
- [Three-minute demo script](docs/DEMO_SCRIPT.md)
- [Submission copy](docs/SUBMISSION.md)
- [Asset provenance](docs/ASSET_PROVENANCE.md)
- [Visual QA report](design-qa.md)
- [Selected visual target](docs/visual-target-precision-blueprint.png)

Built against the current [OpenAI Site Tools guide](https://learn.chatgpt.com/docs/webmcp) and [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/).

## License

[MIT](LICENSE)
