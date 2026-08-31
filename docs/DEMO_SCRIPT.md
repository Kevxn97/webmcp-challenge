# Demo script — recorded challenge flow

Target duration: 2:50. Public recording: 2:54.

This is the frozen story contract for the submitted OpenAI WebMCP Challenge build. Keep the Site Tools or Recently Used panel visible whenever a WebMCP call runs so the implementation is undeniable. Do not replace the explicit control loop with an opaque optimizer or hide the one intentional stale-state failure.

## Pre-roll — establish the deterministic start state

Before recording or replaying, load the public HTTPS deployment in a supported WebMCP host and click **Reset demo** once.

Confirm visibly:

- Packaging says **Lock resource**;
- Scenario A and Scenario B both say **Not run**;
- only the baseline receipt remains;
- the header says **WebMCP ready**;
- exactly six top-level Site Tools are discoverable.

Do not start the replay from the seeded completed-showcase state.

## 0:00–0:10 — The problem and mission

**Visual:** Full factory blueprint and mission brief.

**Narration:**

“Factory planning usually separates the person who changes the rules from the assistant proposing the plan. Agentic Sandbox gives both one live, versioned decision state. The mission is twenty percent more good output, no more than eight percent extra cost, no new machine, and no quality regression.”

**Truth note:** “Live” means the shared planning state on this page, not live plant telemetry or machine control.

## 0:10–0:22 — Why WebMCP

**Visual:** Open Site Tools and show all six names.

**Narration:**

“The page exposes six narrow WebMCP tools over the exact same decision state as the visible interface. There is no DOM guessing, no separate chatbot, and no agent-only shadow state.”

**Judge-visible proof:** The Site Tools list contains exactly:

1. `get_factory_snapshot`
2. `get_scenario_snapshot`
3. `create_scenario`
4. `apply_scenario_changes`
5. `run_factory_simulation`
6. `compare_simulation_runs`

## 0:22–1:10 — Agent creates decision evidence

**Prompt:**

> Read the current factory. Create and simulate two one-shift scenarios using the revisions returned by each call. Scenario A: mixer 9500 bps, Packaging 9000 bps, 15-minute changeover, enhanced calibration, expedited supplier. Scenario B: the same line settings with the standard supplier. Do not add machines. Compare the stored receipts.

**Visual:** Keep recent Site Tool calls visible while the factory, scenario table, and revision ledger update. Land on the comparison.

**Narration:**

“The agent reads the current decision context, branches two hypotheses, applies bounded absolute settings, and invokes the local simulator. Both alternatives reach 11,114 good units. The expedited supplier adds no output, so Scenario A breaks the cost cap. Scenario B passes all four constraints. Every number comes from a stored simulator receipt, not from the language model.”

**Operational call contract:** The minimal six-tool trace is one orientation call, then create/apply/run for each scenario, then compare: eight Site Tool calls total. Do not insert reconstructive reads between successful writes.

## 1:10–1:23 — Compare exact outcomes

**Visual:** Hold on both scenarios at 11,114 good units, Scenario A's cost failure, Scenario B's four passing constraints, and the receipt-backed evidence cells.

**Narration:**

“This is a decision, not a list of options. The deterministic evidence shows that Scenario B produces the same output without the expedite premium.”

**Claim discipline:** This makes Scenario B the better of the two evaluated current alternatives under the demonstrated policy. It does not prove global optimality.

## 1:23–1:36 — Human changes authority

**Visual:** Click Packaging → **Lock resource**. Show the factory and lock revisions advance and the previous receipt become stale.

**Narration:**

“Now the human changes the rules in the shared planning state. I lock Packaging. The authority revision advances, the prior receipt remains as auditable history, and the old plan loses current authority.”

**Time semantics:** The click is a planning-time event. The deterministic proof models its effect inside the counterfactual shift at tick 16—240 minutes into the 16-hour simulation. Once implemented, the lock card, Site Tool output, proof, and narration must expose that same assumption from one domain constant.

## 1:36–1:49 — Fail closed, visibly

**Prompt:**

> Retry the last Scenario B write once with a fresh request ID but the exact revisions you held before my click. Do not re-read first. Report the structured error and confirm that nothing mutated.

**Visual:** Hold on the truthful `STALE_FACTORY` result and the unchanged Scenario B revision and run ID.

**Narration:**

“The agent intentionally retries with the authority it actually held. The page returns `STALE_FACTORY`. The batch commits nothing, and the prior scenario and receipt remain unchanged.”

This failure must occur once. Do not auto-refresh and silently replay the write; that would erase the challenge's human-agent disagreement.

“Nothing mutated” refers to operational and scenario state. A future separate audit plane may record the rejected attempt only if it is explicitly labeled as audit evidence rather than a committed plan change.

## 1:49–2:17 — Re-read and replan

**Prompt:**

> Now re-read the factory. Create a fresh scenario under the new human authority. Packaging may not be changed. Apply only controls reported as AVAILABLE, simulate one shift, and explain the result from the deterministic evidence.

**Visual:** Show the fresh factory snapshot, the new/current plan under the lock, and the stored simulation result.

**Narration:**

“The agent must reacquire the current authority and replan around the human constraint. It may change only controls that are still available at the modeled time. Packaging remains outside its authority.”

**Capability semantics:** In the hardened target, the fresh snapshot marks every control as `AVAILABLE`, `HUMAN_LOCKED`, `PHASE_CLOSED`, or `UNSUPPORTED`. At tick 16, Packaging controls are human-locked and pre-shift controls such as supplier mode are phase-closed. The meaningful runtime replan uses only available controls such as Mixer, Quality Gate, or Warehouse capacity.

**Implemented recovery:** The fresh snapshot exposes `AVAILABLE`, `HUMAN_LOCKED`, and `PHASE_CLOSED` capability states. The agent creates a clean scenario head bound to the post-lock authority epoch, so no pre-lock Packaging override can leak into the new hypothesis.

**Operational call contract:** After the intentional stale response, the explicit current grammar requires four calls: refresh, create, apply, simulate. Do not force a three-call target unless the public grammar is deliberately changed after the challenge.

## 2:17–2:36 — Prove infeasibility

**Visual:** Open **Why this result?** and hold on:

- `9252 < 10937`;
- `factory-lock-upper-bound/v1`;
- `CURRENT SOURCE`;
- `PROVEN`;
- the receipt identifier;
- `factory-engine/1.0.0`.

**Narration:**

“The deterministic engine proves a conservative maximum of 9,252 good units while Packaging remains locked under the modeled timing, below the 10,937-unit target. It can say ‘infeasible’ because it has a machine-checkable bound, not because the agent ran out of ideas.”

**Truth-axis requirement:** A future hardened receipt must show execution validity, source currentness, hard-constraint feasibility, and proof state separately. A proof label must never hide invalid operations or stale assumptions.

## 2:36–2:50 — Close on the system

**Visual:** Copy or download the deterministic decision packet, then show its receipt hashes, human authority, exact constraints, proof, revision ledger, and the complete blueprint.

**Narration:**

“This is the agent-native web I want: the human sets intent and can change authority at any moment; the agent operates through explicit capabilities; deterministic software supplies the evidence; and the same page makes every consequential revision inspectable. Same decision state, clear authority, shared proof.”

## Recording checklist

- Public link, under three minutes, with clear audio.
- Start with **Reset demo** and verify the unlocked, empty scenario workspace.
- Use the deployed HTTPS URL in ChatGPT's built-in browser.
- Show exactly six Site Tools once; keep Recently Used visible during calls.
- Capture the two explicit hypotheses and exact comparison.
- Capture the human Packaging lock and visible authority change.
- Capture one intentional stale write, `STALE_FACTORY`, and unchanged operational/scenario state.
- Capture the fresh read and locked replan.
- Do not claim a post-lock supplier, changeover, or calibration change at tick 16.
- Capture `9252 < 10937`, current source, proof version, receipt, and engine version.
- Describe Scenario B as better among evaluated alternatives, not globally optimal.
- Use fixed browser zoom; editorial crops are fine, but do not hide the Site Tool evidence.
- End on the product, not a slide.

## Post-change replay rule

Any code or visible-contract change before judging requires a full public replay of this script. A new recording is required if the previous video would materially misrepresent tool names, prompt compatibility, control domains, resource ownership, phase availability, lock timing, scenario lineage, response fields, currentness, truth axes, deterministic outcomes, or UI evidence.