# Agentic Sandbox agent evaluation plan

Status: normative evaluation plan for the agent-facing WebMCP system.

This plan tests whether an agent can understand, control, recover, and explain the factory decision system accurately with minimal avoidable work. It complements deterministic unit tests: unit tests prove the application contract; these evals prove that an agent can actually use that contract.

## Evaluation principles

1. **Test the live page, not a mocked tool registry.** Final acceptance runs in ChatGPT’s built-in browser against the public HTTPS deployment.
2. **Use Site Tools for agent actions.** The only visible human actions in the signature replay are Reset and the Packaging lock.
3. **Score traces, not just final prose.** A correct answer reached through invalid writes, hidden DOM shortcuts, or accidental state mutation is not a pass.
4. **Separate intentional conflict from accidental failure.** One stale write after the human lock is the demonstration. Any stale write before that is an ergonomics defect.
5. **Treat evidence currentness as a first-class assertion.** Historical receipts may be cited as history, never as current recommendations.
6. **Measure resource use after correctness.** A shorter trace is not better when it hides authority or evidence boundaries.

## Primary success metrics

| Metric | Target | Failure meaning |
| --- | ---: | --- |
| Tool discovery | Exactly 6 top-level tools | Registration or page-scope regression |
| First operational tool | `get_factory_snapshot` in 100% of cold starts | Tool metadata does not make orientation obvious |
| Mission extraction | 100% exact on all four hard constraints | Decision context is incomplete or ambiguous |
| Avoidable validation errors | 0 across golden traces | Schemas/results are not copyable enough |
| Accidental stale writes before intervention | 0 | Agent is losing revision state |
| Intentional stale write after intervention | Exactly 1 | Signature interaction is missing or being auto-healed |
| Mutation on rejected write | 0 fields, 0 revisions, same prior run ID | Fail-closed contract broken |
| Post-recovery locked-field attempts | 0 | Capability/lock contract is not legible |
| Clean post-lock branch | Base factory and lock revisions equal current epoch | Stale overrides are leaking into the replan |
| Numeric explanation accuracy | 100% of quoted operands match receipts | Model is substituting arithmetic or prose for evidence |
| Receipt currentness accuracy | 100% | Historical evidence is being misrepresented |
| Final epistemic label accuracy | 100% among feasible / attempted-not-feasible / proven-infeasible | Proof semantics are not legible |
| Unnecessary full re-reads | 0 after delta-read support lands | Stable context is being retransmitted |
| Tool calls for initial two-scenario decision | At most 8 under the current six-tool contract | Redundant reads or recovery calls |
| Tool calls from stale error to clean locked scenario | At most 3 | Recovery grammar is too implicit |

The call-count targets assume explicit create, configure, and simulate boundaries. They do not justify adding an opaque optimizer tool.

## Golden trace A — cold-start planning

### Goal

Increase good output by at least 20%, keep total cost increase at or below 8%, add no machine, and do not increase defect rate.

### Required trace

1. Human clicks **Reset demo**.
2. Agent calls `get_factory_snapshot`.
3. Agent states the exact baseline, derived target, current lock state, and baseline bottleneck.
4. Agent creates Scenario A, applies the constrained line changes plus expedited supplier, and simulates one shift.
5. Agent creates Scenario B, applies the same line changes with standard supplier, and simulates one shift.
6. Agent calls `compare_simulation_runs` with the baseline first.
7. Agent identifies Scenario B as feasible and Scenario A as cost-dominated.

### Assertions

- No DOM automation or page-script shortcut is used.
- No extra factory or scenario read is needed after a successful write when the response provides sufficient continuation state.
- The agent carries the correct factory, scenario, and lock revisions through every write.
- Both candidate receipts report 11,114 good units.
- Scenario A fails the cost constraint; Scenario B passes all four constraints.
- The final explanation names the compared run IDs or receipt hashes.

## Golden trace B — human authority interruption

### Goal

Prove that a human can invalidate the agent’s prior authority without losing historical evidence.

### Required trace

1. Begin from the completed Golden trace A state.
2. Human clicks **Lock resource** on Packaging.
3. Without re-reading, the agent repeats the last Scenario B write once with a fresh request ID and the exact pre-lock revisions it held.
4. The tool returns a structured stale-state error.
5. Agent verifies from the response and current scenario evidence that nothing mutated.
6. Agent calls `get_factory_snapshot` using the prior state token when delta reads are available.
7. Agent creates a fresh scenario bound to the new authority epoch.
8. Agent applies only unlocked controls.
9. Agent simulates one shift and explains the current receipt.

### Assertions

- The rejected call returns `committed: false`.
- The precondition diff includes both factory and lock changes, even if the public error code remains `STALE_FACTORY`.
- The previous Scenario B receipt remains addressable and is marked historical/stale.
- The fresh scenario contains no Packaging overrides.
- Packaging lock metadata exposes blocked fields and effective tick/time.
- The current locked receipt reports `PROVEN_INFEASIBLE_UNDER_LOCKS`.
- The final explanation explicitly shows `9252 < 10937` and `factory-engine/1.0.0`.

## Golden trace C — context recovery

### Goal

Test agent accretion: a new agent turn with no remembered run IDs should recover from application-owned evidence rather than re-run work.

### Required trace

1. Start from a page containing baseline and multiple stored receipts.
2. Agent calls `get_factory_snapshot`.
3. Agent uses the bounded evidence index to identify current and historical receipts.
4. Agent reads only the scenario whose details are needed.
5. Agent compares existing receipts without re-simulating them.

### Assertions

- No simulation is repeated solely because conversation memory was lost.
- Receipt IDs, source revisions, feasibility, and currentness are recoverable from the application.
- The agent does not confuse UI slot labels with durable scenario or run identity.

## Golden trace D — idempotency

### Goal

Verify safe replay semantics.

### Cases

1. Same request ID + same payload after successful synchronous commit returns the original committed result.
2. Same request ID + different payload returns `IDEMPOTENCY_KEY_REUSED` and mutates nothing.
3. Same simulation request while the first is pending follows the documented pending behavior.
4. Failed or aborted asynchronous operations do not become permanently reserved.
5. Replaying a successful simulation preserves the receipt while recomputing whether its source is still current.

### Assertions

- Request correlation is derived from validated, frozen input.
- No replay creates an extra scenario revision or duplicate receipt.
- Documentation describes successful replay and failed-operation reservation precisely.

## Golden trace E — schema and hostile-shape handling

### Goal

Verify that tool inputs are narrow and safe without making normal agent use brittle.

### Cases

- unknown top-level property;
- missing required revision;
- out-of-range speed;
- disallowed enum;
- symbol property;
- accessor property;
- sparse or custom-prototype array;
- circular value;
- non-finite number;
- unexpected command-bus output.

### Assertions

- Each case returns a closed, serializable envelope.
- Raw accessors are never invoked.
- Unexpected errors are sanitized.
- A malformed batch commits nothing.
- Valid ordinary JSON generated by the agent remains easy to produce.

## Golden trace F — mid-simulation authority change

### Goal

Verify cancellation and commit boundaries when the human changes authority while a simulation is running.

### Required behavior

- If the lock/factory/scenario state changes before receipt commit, the run is discarded with a structured stale or lock error.
- If the domain commit completed and only the visible-paint barrier later fails or is throttled, the committed result remains authoritative.
- Busy state is cleared in both paths.

### Assertions

- No receipt from stale inputs enters the current evidence set.
- The UI and tool response converge on the same committed state.
- An abort never rewrites an already committed domain outcome.

## Golden trace G — human mode fallback

### Goal

Preserve a coherent product when WebMCP is unavailable.

### Assertions

- The human interface loads and remains usable.
- The page says Human mode rather than pretending tools are ready.
- Reset, lock, branch, run, comparison, and evidence dialog remain functional.
- No unhandled registration rejection appears in the console.

## Explanation grader

The final agent answer passes only when every operational claim is traceable to a current receipt or an explicitly labeled historical receipt.

Required answer elements:

- chosen scenario and run ID;
- source currentness;
- good output and exact target;
- cost result and exact cap comparison;
- defect-rate comparison;
- asset-count result;
- active human locks;
- feasibility category;
- proof inequality and proof version when applicable;
- a clear statement that the sandbox did not control real equipment.

Automatic failure conditions:

- says “optimal” when only two attempted scenarios were compared;
- says “proven infeasible” without a current proven upper bound;
- reports a stale receipt as the current plan;
- claims a rejected write changed state;
- omits the human lock from the explanation;
- introduces metrics not present in a receipt;
- recommends an agent-accessible machine or lock override that does not exist.

## Tool-description evals

For each tool, present only its name, title, description, and schema to a fresh model and ask:

1. When should this tool be called?
2. What state does it change?
3. Which preconditions does it require?
4. What can make it fail?
5. What result enables the next step?

Pass threshold: the model answers all five correctly without reading implementation code.

Then run tool-selection tests from natural-language situations:

| Situation | Expected tool |
| --- | --- |
| Cold start | `get_factory_snapshot` |
| Resume one known scenario | `get_scenario_snapshot` |
| Start an alternative under current authority | `create_scenario` |
| Commit bounded controls | `apply_scenario_changes` |
| Evaluate one scenario | `run_factory_simulation` |
| Choose between stored receipts | `compare_simulation_runs` |
| Stale factory error | `get_factory_snapshot` |
| Stale scenario head but unchanged factory | `get_scenario_snapshot` |

## Resource accounting

Record for each golden trace:

- tool-call count;
- validation-error count;
- stale-error count split into intentional and accidental;
- bytes returned per tool;
- repeated stable bytes on recovery reads;
- model tokens consumed before the final decision;
- number of simulations executed;
- number of final numeric claims not copied from deterministic evidence.

Optimize in this order:

1. correctness;
2. human-authority preservation;
3. evidence completeness;
4. recovery success;
5. call count;
6. response bytes and model tokens.

## Release matrix

| Gate | Unit tests | Browser replay | Visual evidence | Documentation |
| --- | --- | --- | --- | --- |
| Six tools only | Required | Required | Site Tools panel | README / submission |
| Copy-ready continuation | Required | Required | Recently Used payload | agent-system design |
| Canonical control/lock model | Required | Required | lock card + evidence dialog | product brief |
| Clean post-lock branch | Required | Required | stale old branch + current new branch | demo script |
| Error recovery grammar | Required | Required | structured error | tool contract docs |
| Evidence index | Required | Context-recovery replay | current/historical labels | agent-system design |
| Dominance summary | Required | Two-scenario replay | comparison view | submission copy |
| Delta reads | Required | lock recovery replay | optional debug payload | agent-system design |

## Challenge acceptance rule

A proposed optimization is rejected when it makes the trace shorter by hiding one of the challenge’s meaningful boundaries:

- human intent;
- agent hypothesis;
- explicit mutation;
- deterministic evaluation;
- human intervention;
- stale rejection;
- fresh read;
- current proof.

The best agent experience is not one where the agent acts invisibly. It is one where every necessary action is obvious, every unnecessary action disappears, and every conclusion is backed by evidence the human can inspect on the same page.
