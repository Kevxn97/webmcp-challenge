# Demo script — 2:35 target

The video should be one continuous, narrated story. Keep the Site Tools or Recently Used panel visible whenever a WebMCP call runs so the implementation is undeniable.

## 0:00–0:18 — The problem

**Visual:** Full factory blueprint and mission brief.

**Narration:**

“Factory planning is usually a handoff between a dashboard and an assistant that cannot safely change it. Agentic Sandbox gives the human and the browser agent one live, versioned decision space. Our mission is twenty percent more good output, no more than eight percent extra cost, no new machine, and no quality regression.”

## 0:18–0:38 — Why WebMCP

**Visual:** Open Site Tools and show the six tool names.

**Narration:**

“This is not DOM automation and there is no embedded chatbot. The top-level page exposes six narrow WebMCP tools. They read and mutate the same command bus as the visible UI, with bounded schemas, optimistic revisions, idempotency, and cancellation.”

## 0:38–1:18 — Agent creates evidence

**Prompt:**

> Inspect the factory. Create two approaches to the mission, simulate them, and compare their exact receipts. Do not add machines.

**Visual:** Show tool calls and the UI changing live. Land on the comparison: expedited supplier plan fails cost; constrained mixer/Packaging plan passes.

**Narration:**

“The agent reads the current factory, creates immutable scenarios, applies absolute settings, and invokes the local simulator. Scenario A buys speed that adds no output and breaks the cost cap. Scenario B reaches 11,114 good units with all four constraints passing. Every number on screen came from the stored simulator receipt, not from the language model.”

## 1:18–1:42 — Human interrupts

**Visual:** Click Packaging → **Lock resource**. Show revision increment and Scenario B become stale.

**Narration:**

“Now the part normal agent demos avoid: the human changes the rules mid-flow. I lock Packaging. The lock revision advances, the prior receipt remains visible as historical evidence, and the old plan is explicitly stale.”

## 1:42–2:13 — Fail closed and replan

**Prompt:**

> Packaging may not be changed. Re-read the factory and still try to meet the mission. Explain the result from simulation evidence.

**Visual:** Show an old/stale or Packaging mutation return `LOCK_CHANGED`/`HUMAN_LOCKED`; agent re-reads; run new simulation; open evidence.

**Narration:**

“A stale or locked write applies nothing. The agent must re-read and replan. The deterministic engine now proves a conservative maximum of 9,252 good units under the Packaging lock, below the 10,937 target. It can say ‘infeasible’ because it has a machine-checkable bound, not because it ran out of ideas.”

## 2:13–2:35 — Close

**Visual:** Receipt hash, exact constraints, revision ledger, then full blueprint.

**Narration:**

“Agentic Sandbox is a picture of the agent-native web I want: humans set intent and can intervene at any moment; agents operate through explicit capabilities; deterministic software supplies the evidence; and the interface makes every revision inspectable. Same page, same state, clear authority.”

## Recording checklist

- Public YouTube link, under three minutes, with clear audio.
- Deployed HTTPS URL loaded in ChatGPT's built-in browser.
- Site Tools list visible once; Recently Used visible during calls.
- Capture the human lock, stale receipt, rejected write, re-read, and proof.
- Keep browser zoom and viewport fixed; avoid cuts that hide state changes.
- End on the product, not a slide.
