# Submission copy

## Project name

Agentic Sandbox

## Tagline

A deterministic factory decision lab where a human and a browser agent safely replan the same live system together.

## What it does

Agentic Sandbox turns factory planning into a shared, inspectable human-agent workflow. A browser agent can read the current line, branch alternatives, apply bounded operating settings, run a deterministic shift simulation, and compare exact receipts. The human sees each action live in a precision-blueprint interface and can intervene at any time by locking Packaging.

When that happens, old plans are not silently rebased. Their evidence remains visible but becomes stale, agent writes with old revisions fail atomically, and Packaging changes are rejected. After re-reading the new state, the agent can explore the remaining controls. If the goal cannot be met, the engine returns a conservative mathematical upper bound instead of an unsupported explanation.

## Why WebMCP is essential

Without WebMCP, the agent would have to infer state from pixels and manipulate controls by coordinates, or the product would need its own separate chatbot and backend. Here, the website itself exposes exactly six typed capabilities over the same state and permissions as the human interface. That lets the agent perform multi-step planning accurately while the human keeps direct, visible control.

The best moment in the demo is not a successful tool call; it is a safe disagreement. The human changes a constraint, the agent's prior revision loses authority, the page refuses the stale write, and the agent adapts through a fresh read. That interaction is difficult to make coherent without a browser-native tool protocol.

## Audience and potential impact

The primary users are plant planners, industrial engineers, and continuous-improvement teams. Today, a debottlenecking decision often crosses a dashboard, a spreadsheet, a simulation specialist, and an approval meeting. Context and authority are lost at every handoff; a generic assistant can make that worse by recommending controls it is no longer allowed to change.

Agentic Sandbox turns the existing decision page into the collaboration surface. The browser agent can explore more alternatives in minutes, while deterministic software—not model prose—owns the operational numbers and the human can change the admissible search space at any time. The first adoption wedge is bounded what-if analysis for line balancing, shift planning, and supplier decisions. A production implementation could connect the same tool and receipt pattern to a validated digital twin, while ERP, PLC, SCADA, and physical-machine changes remain behind existing approvals.

The pattern generalizes beyond factories: any high-consequence planning UI can expose narrow capabilities, bind work to a version, preserve human vetoes, and return machine-checkable evidence.

## How it was built

The React/Vite page registers six top-level imperative WebMCP tools with `document.modelContext.registerTool`: two snapshot tools, scenario creation and mutation, deterministic simulation, and receipt comparison. Schemas are closed and narrow; handlers independently validate input, propagate abort signals, sanitize errors, and return a versioned JSON envelope.

The visible UI and WebMCP handlers share one application-owned command bus. Mutations use request IDs plus expected factory, scenario, and human-lock revisions. Human locks have no agent-accessible override. Simulation runs on immutable scenario inputs with integer/fixed-point arithmetic and actual SHA-256 content hashes. Stored receipts contain tick-level state, cost categories, exact constraint operands, conservation checks, asset hashes, and optional infeasibility proofs. No API key, model backend, or production equipment is involved.

## What people and agents can do together

- A person states a high-level operational mission in natural language.
- The agent translates it into bounded scenarios and tests them through website tools.
- The interface visualizes each action, revision, conflict, and receipt as it happens.
- The person can change a rule directly in the product without restarting the conversation.
- The agent detects that its knowledge is stale, re-reads, and adapts without overriding the human.
- Both can distinguish a feasible recommendation, a failed scenario, and a proven infeasible mission from the same deterministic evidence.

## Built with

WebMCP / OpenAI Site Tools, React 19, TypeScript, Vite, Vitest, Web Crypto SHA-256, Phosphor Icons, and IBM Plex typography.

## Evaluator links and reset

- Live application: `https://webmcp-challenge-seven.vercel.app`
- Source repository: https://github.com/Kevxn97/webmcp-challenge
- Public demo video: https://www.youtube.com/watch?v=3KwBtJU9fow

The landing page intentionally opens on the completed showcase. To replay the signature flow, click **Reset demo** once and confirm that Packaging is unlocked, Scenario A and Scenario B are both **Not run**, and the header says **WebMCP ready**.

Evaluator prompt:

> Read the current factory. Create and simulate two one-shift scenarios using the revisions returned by each call. Scenario A: mixer 9500 bps, Packaging 9000 bps, 15-minute changeover, enhanced calibration, expedited supplier. Scenario B: the same line settings with the standard supplier. Do not add machines. Compare the stored receipts.

Then click **Lock resource** on Packaging and tell the agent:

> Retry the last Scenario B write once with a fresh request ID but the exact revisions you held before my click. Do not re-read first. Report the structured error. Then re-read the factory, keep Packaging unchanged, replan using only unlocked controls, simulate one shift, and explain the deterministic evidence.
