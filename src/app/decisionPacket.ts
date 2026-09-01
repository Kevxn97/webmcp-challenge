import type { SimulationReceipt } from "../domain";
import {
  PACKAGING_CONTROL_FIELDS,
  PACKAGING_LOCK_EFFECTIVE_MINUTES,
  PACKAGING_LOCK_EFFECTIVE_TICK,
} from "../shared/controlDefinitions";
import type { DecisionPacketExport } from "../ui/types";
import {
  runEvidenceIsCurrent,
  type SandboxState,
  type ScenarioRunEvidence,
} from "./store";

interface ScenarioEvidence {
  scenario_id: string;
  scenario_version_id: string;
  display_label: string;
  label_trust: "UNTRUSTED_DISPLAY_TEXT";
  source_is_current: boolean;
  source_factory_revision: number;
  source_lock_revision: number;
  run_id: string;
  input_hash: string;
  content_hash: string;
  engine_version: string;
  feasibility: string;
  all_constraints_pass: boolean;
  good_output_units: number;
  gross_units: number;
  bad_units: number;
  total_cost_micro_eur: string;
  changed_controls: string[];
  constraints: Array<{
    code: string;
    lhs: string;
    operator: string;
    rhs: string;
    unit: string;
    pass: boolean;
  }>;
  proof: null | {
    proof_version: string;
    method: string;
    exact_inequality: string;
    good_output_upper_bound: number;
    target_good_output_units: number;
    proven: boolean;
  };
}

function defectCompare(left: SimulationReceipt, right: SimulationReceipt): number {
  return left.rawCounters.badUnits * right.rawCounters.grossUnits
    - right.rawCounters.badUnits * left.rawCounters.grossUnits;
}

function policyCompare(
  left: ScenarioRunEvidence,
  right: ScenarioRunEvidence,
): number {
  const output = right.receipt.rawCounters.goodOutputUnits
    - left.receipt.rawCounters.goodOutputUnits;
  if (output !== 0) return output;
  const cost = BigInt(left.receipt.totalCostMicroEur)
    - BigInt(right.receipt.totalCostMicroEur);
  if (cost !== 0n) return cost < 0n ? -1 : 1;
  const defects = defectCompare(left.receipt, right.receipt);
  if (defects !== 0) return defects;
  const changedControls = Object.keys(left.patch).length
    - Object.keys(right.patch).length;
  return changedControls || left.runId.localeCompare(right.runId);
}

function scenarioEvidence(
  state: SandboxState,
  evidence: ScenarioRunEvidence,
): ScenarioEvidence {
  const receipt = evidence.receipt;
  return {
    scenario_id: evidence.scenarioId,
    scenario_version_id: evidence.scenarioVersionId,
    display_label: evidence.scenarioName,
    label_trust: "UNTRUSTED_DISPLAY_TEXT",
    source_is_current: runEvidenceIsCurrent(evidence, state),
    source_factory_revision: evidence.sourceFactoryRevision,
    source_lock_revision: evidence.sourceLockRevision,
    run_id: receipt.runId,
    input_hash: receipt.inputHash,
    content_hash: receipt.contentHash,
    engine_version: receipt.engineVersion,
    feasibility: receipt.feasibilityStatus,
    all_constraints_pass: receipt.constraints.every(
      (constraint) => constraint.pass,
    ),
    good_output_units: receipt.rawCounters.goodOutputUnits,
    gross_units: receipt.rawCounters.grossUnits,
    bad_units: receipt.rawCounters.badUnits,
    total_cost_micro_eur: receipt.totalCostMicroEur,
    changed_controls: Object.keys(evidence.patch).sort(),
    constraints: receipt.constraints.map(
      ({ code, lhs, operator, rhs, unit, pass }) => ({
        code,
        lhs,
        operator,
        rhs,
        unit,
        pass,
      }),
    ),
    proof: receipt.upperBoundProof ? {
      proof_version: receipt.upperBoundProof.proofVersion,
      method: receipt.upperBoundProof.method,
      exact_inequality: receipt.upperBoundProof.exactInequality,
      good_output_upper_bound: receipt.upperBoundProof.goodOutputUpperBound,
      target_good_output_units: receipt.upperBoundProof.targetGoodOutputUnits,
      proven: receipt.upperBoundProof.proven,
    } : null,
  };
}

function formatCost(microEur: string): string {
  const euros = Number(BigInt(microEur)) / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(euros);
}

export function buildDecisionPacket(state: SandboxState): DecisionPacketExport | null {
  const storedEvidence = Object.values(state.runEvidence);
  if (storedEvidence.length === 0 || !state.baselineReceipt) return null;

  const evidence = storedEvidence
    .sort((left, right) => left.runId.localeCompare(right.runId))
    .map((item) => scenarioEvidence(state, item));
  const feasibleCurrent = storedEvidence.filter((item) =>
    runEvidenceIsCurrent(item, state)
    && item.receipt.feasibilityStatus === "FEASIBLE"
    && item.receipt.constraints.every((constraint) => constraint.pass),
  );
  const best = [...feasibleCurrent].sort(policyCompare)[0];
  const currentProof = storedEvidence.find((item) =>
    runEvidenceIsCurrent(item, state)
    && item.receipt.feasibilityStatus === "PROVEN_INFEASIBLE_UNDER_LOCKS"
    && item.receipt.upperBoundProof?.proven,
  );

  const decision = best ? {
    status: "BEST_EVALUATED_UNDER_POLICY",
    scenario_id: best.scenarioId,
    scenario_version_id: best.scenarioVersionId,
    run_id: best.runId,
    statement: `${best.scenarioName} is the best evaluated current alternative under the declared policy. This is not a global optimality claim.`,
    proof: null,
  } : currentProof ? {
    status: "PROVEN_INFEASIBLE_UNDER_HUMAN_AUTHORITY",
    scenario_id: currentProof.scenarioId,
    scenario_version_id: currentProof.scenarioVersionId,
    run_id: currentProof.runId,
    statement: "The current mission is proven infeasible under the human Packaging authority boundary and modeled lock timing.",
    proof: currentProof.receipt.upperBoundProof?.exactInequality ?? null,
  } : {
    status: "NO_CURRENT_DECISION",
    scenario_id: null,
    scenario_version_id: null,
    run_id: null,
    statement: "Stored evidence exists, but no current feasible winner or current infeasibility proof is available.",
    proof: null,
  };

  const packet = {
    schema_version: "agentic-sandbox-decision-packet/v1",
    product: "Agentic Sandbox",
    scope_note: "Shared planning evidence only; no plant telemetry or machine-control path.",
    mission: {
      minimum_good_output_units: state.baselineReceipt.baselineComparison.targetGoodOutputUnits,
      output_gain_min_basis_points: 2_000,
      cost_increase_max_basis_points: 800,
      defect_rate_may_increase: false,
      new_machine_limit: 0,
      selection_policy: [
        "CURRENT_AND_VALID",
        "ALL_HARD_CONSTRAINTS_PASS",
        "MAX_GOOD_OUTPUT",
        "MIN_TOTAL_COST",
        "MIN_DEFECT_RATE",
        "MIN_CHANGED_CONTROLS",
        "CANONICAL_RUN_ID",
      ],
    },
    authority: {
      owner: "human",
      packaging_locked: state.packagingLocked,
      lock_revision: state.lockRevision,
      blocked_controls: state.packagingLocked ? [...PACKAGING_CONTROL_FIELDS] : [],
      simulation_effect: state.packagingLocked ? {
        effective_tick: PACKAGING_LOCK_EFFECTIVE_TICK,
        effective_elapsed_minutes: PACKAGING_LOCK_EFFECTIVE_MINUTES,
      } : null,
    },
    baseline: {
      run_id: state.baselineReceipt.runId,
      engine_version: state.baselineReceipt.engineVersion,
      good_output_units: state.baselineReceipt.rawCounters.goodOutputUnits,
      gross_units: state.baselineReceipt.rawCounters.grossUnits,
      bad_units: state.baselineReceipt.rawCounters.badUnits,
      total_cost_micro_eur: state.baselineReceipt.totalCostMicroEur,
    },
    evidence,
    decision,
  };

  const evidenceMarkdown = evidence.map((item) => {
  const constraints = item.constraints
    .map((constraint) => `  - ${constraint.code}: ${constraint.lhs} ${constraint.operator} ${constraint.rhs} ${constraint.unit} — ${constraint.pass ? "PASS" : "FAIL"}`)
    .join("\n");
  const proof = item.proof
    ? `\n- Proof: ${item.proof.exact_inequality} · ${item.proof.proof_version} · ${item.proof.proven ? "PROVEN" : "NOT PROVEN"}`
    : "";
  return `### ${item.display_label}\n\n- Source: ${item.source_is_current ? "CURRENT" : "HISTORICAL"}\n- Scenario version: \`${item.scenario_version_id}\`\n- Receipt: \`${item.run_id}\`\n- Engine: \`${item.engine_version}\`\n- Good output: ${item.good_output_units.toLocaleString("en-US")} units\n- Total cost: ${formatCost(item.total_cost_micro_eur)}\n- Feasibility: ${item.feasibility}\n- Constraints:\n${constraints}${proof}`;
}).join("\n\n");

const authorityMarkdown = state.packagingLocked
  ? `Packaging locked by human at lock revision ${state.lockRevision}. Modeled effect: tick ${PACKAGING_LOCK_EFFECTIVE_TICK}, T+${PACKAGING_LOCK_EFFECTIVE_MINUTES} minutes. Blocked controls: ${PACKAGING_CONTROL_FIELDS.join(", ")}.`
  : `Packaging is currently unlocked at lock revision ${state.lockRevision}.`;
const decisionMarkdown = decision.proof
  ? `${decision.statement}\n\n**Machine-checkable proof:** \`${decision.proof}\``
  : decision.statement;

const markdown = `# Agentic Sandbox decision packet\n\n> Deterministic, receipt-backed planning handoff. No model-generated operational metrics.\n\n## Mission\n\n- Good output: at least ${state.baselineReceipt.baselineComparison.targetGoodOutputUnits.toLocaleString("en-US")} units (+20% vs. baseline)\n- Total cost: no more than +8%\n- Defect rate: no increase\n- New machines: 0\n\n## Human authority\n\n${authorityMarkdown}\n\n## Baseline\n\n- Good output: ${state.baselineReceipt.rawCounters.goodOutputUnits.toLocaleString("en-US")} units\n- Total cost: ${formatCost(state.baselineReceipt.totalCostMicroEur)}\n- Receipt: \`${state.baselineReceipt.runId}\`\n\n## Evaluated evidence\n\n${evidenceMarkdown}\n\n## Decision\n\n**${decision.status}**\n\n${decisionMarkdown}\n\n## Trust boundary\n\nThe human owns intent and authority. The agent forms hypotheses and assembles evidence. Deterministic software owns operational facts. Display labels are untrusted text and do not affect evaluation or selection.\n`;

  return {
    markdown,
    json: JSON.stringify(packet, null, 2),
    fileName: "agentic-sandbox-decision-packet.json",
  };
}
