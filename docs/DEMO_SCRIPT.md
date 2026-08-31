# Demo script — 2:50 target

The video should be one continuous, narrated story. Keep the Site Tools or Recently Used panel visible whenever a WebMCP call runs so the implementation is undeniable.

## Pre-roll — establish the deterministic start state

Before recording, load the deployed HTTPS URL in a supported WebMCP host and click **Reset demo** once. Confirm that Packaging says **Lock resource**, Scenario A and Scenario B both say **Not run**, only the baseline receipt remains, and the header says **WebMCP ready**. Do not start from the seeded completed-showcase state.

## 0:00–0:10 — The problem

**Visual:** Full factory blueprint and mission brief.

**Narration:**

“Factory planning is usually a handoff between a dashboard and an assistant that cannot safely change it. Agentic Sandbox gives the human and the browser agent one live, versioned decision space. Our mission is twenty percent more good output, no more than eight percent extra cost, no new machine, and no quality regression.”

## 0:10–0:23 — Why WebMCP

**Visual:** Open Site Tools and show the six tool names.

**Narration:**

“This is not DOM automation and there is no embedded chatbot. The top-level page exposes six narrow WebMCP tools over the exact same live state as the visible interface. Every write is bounded, versioned, and visible.”

## 0:23–1:13 — Agent creates evidence

**Prompt:**

> Read the current factory. Create and simulate two one-shift scenarios using the revisions returned by each call. Scenario A: mixer 9500 bps, Packaging 9000 bps, 15-minute changeover, enhanced calibration, expedited supplier. Scenario B: the same line settings with the standard supplier. Do not add machines. Compare the stored receipts.

**Visual:** Show tool calls and the UI changing live. Land on the comparison: expedited supplier plan fails cost; constrained mixer/Packaging plan passes.

**Narration:**

“The agent reads the current factory, creates immutable scenarios, applies absolute settings, and invokes the local simulator. Scenario A adds an expedite premium but produces no more output than Scenario B, so it breaks the cost cap. Scenario B reaches 11,114 good units with all four constraints passing. Every number on screen came from the stored simulator receipt, not from the language model.”

## 1:13–1:24 — Compare exact outcomes

**Visual:** Punch in on the comparison table. Hold on both scenarios at 11,114 good units, Scenario A's cost failure, and Scenario B's four passing constraints.

**Narration:**

“Both alternatives reach the same output. The receipt shows exactly why the expedited option fails and the standard-supplier option passes.”

## 1:24–1:36 — Human interrupts

**Visual:** Click Packaging → **Lock resource**. Show revision increment and Scenario B become stale.

**Narration:**

“Now the part normal agent demos avoid: the human changes the rules mid-flow. I lock Packaging. The lock revision advances, the prior receipt remains visible as historical evidence, and the old plan is explicitly stale.”

## 1:36–1:49 — Fail closed

**Prompt 1 — prove the stale write fails closed:**

> Retry the last Scenario B write once with a fresh request ID but the exact revisions you held before my click. Do not re-read first. Report the structured error.

**Visual:** Hold on the truthful `STALE_FACTORY` response and the unchanged scenario state.

**Narration:**

“The retry carries the revision the agent actually held. The page returns `STALE_FACTORY`, and nothing is applied.”

## 1:49–2:18 — Re-read and replan

**Prompt:**

> Now re-read the factory. Packaging is human-locked from tick 16. Preserve Packaging and every pre-shift choice unchanged. Apply only `mixer_speed_bps: 9500`, simulate one shift, and explain the result from the deterministic evidence.

**Visual:** Show the fresh snapshot, the new plan, and the simulation result.

**Narration:**

“The agent must re-read and replan around the human constraint. It can still change a genuinely available runtime control such as Mixer, while Packaging and phase-closed pre-shift choices remain unchanged.”

## 2:18–2:35 — Prove infeasibility

**Visual:** Open the evidence dialog and hold on `9252 < 10937`, the receipt hash, and `factory-engine/1.0.0`. Then show the `PROVEN INFEASIBLE` state.

**Narration:**

“The deterministic engine proves a conservative maximum of 9,252 good units under the Packaging lock, below the 10,937 target. It can say ‘infeasible’ because it has a machine-checkable bound, not because it ran out of ideas.”

## 2:35–2:50 — Close

**Visual:** Receipt hash, exact constraints, revision ledger, then full blueprint.

**Narration:**

“Agentic Sandbox is a picture of the agent-native web I want: humans set intent and can intervene at any moment; agents operate through explicit capabilities; deterministic software supplies the evidence; and the interface makes every revision inspectable. Same page, same state, clear authority.”

## Recording checklist

- Public YouTube link, under three minutes, with clear audio.
- Start with **Reset demo** and verify the unlocked, empty workspace before recording.
- Deployed HTTPS URL loaded in ChatGPT's built-in browser.
- Site Tools list visible once; Recently Used visible during calls.
- Capture the human lock, stale receipt, `STALE_FACTORY` rejection, re-read, and exact `9252 < 10937` proof.
- In the locked replan, change only Mixer; do not re-submit Supplier, changeover, or calibration as if they were still phase-available.
- Keep browser zoom fixed, but use editorial crops for the full blueprint, split app/Site Tools view, comparison, structured error, inequality, receipt, and ledger.
- End on the product, not a slide.
