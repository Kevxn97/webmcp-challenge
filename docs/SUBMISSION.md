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
