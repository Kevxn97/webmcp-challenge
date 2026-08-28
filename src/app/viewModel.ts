import {
  GearSix,
  Package,
  ShieldCheck,
  Truck,
  Warehouse,
} from "@phosphor-icons/react";

import type {
  ConstraintCode,
  ExactConstraint,
  FactoryResource,
  SimulationReceipt,
  TickSnapshot,
} from "../domain";
import type {
  BlueprintViewModel,
  ConstraintCheckView,
  ScenarioMetricView,
  ScenarioView,
  StationView,
} from "../ui/types";
import type { SandboxState, ScenarioRecord } from "./store";

const euroFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCost(microEur: string | undefined): string {
  if (!microEur) return "—";
  return euroFormatter.format(Number(BigInt(microEur)) / 1_000_000);
}

function formatCompactCost(microEur: string | undefined): string {
  if (!microEur) return "—";
  const eur = Number(BigInt(microEur)) / 1_000_000;
  return `€${(eur / 1_000).toFixed(1)}k`;
}

function signedPercent(numerator: number, denominator: number, digits = 1): string {
  if (denominator === 0) return "—";
  const value = (numerator / denominator) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function defectPercent(receipt: SimulationReceipt | null): string {
  if (!receipt || receipt.rawCounters.grossUnits === 0) return "—";
  return `${((receipt.rawCounters.badUnits / receipt.rawCounters.grossUnits) * 100).toFixed(2)}%`;
}

function costDelta(receipt: SimulationReceipt | null, baseline: SimulationReceipt | null): string {
  if (!receipt || !baseline) return "—";
  const left = Number(BigInt(receipt.totalCostMicroEur));
  const right = Number(BigInt(baseline.totalCostMicroEur));
  return signedPercent(left - right, right);
}

function outputDelta(receipt: SimulationReceipt | null, baseline: SimulationReceipt | null): string {
  if (!receipt || !baseline) return "—";
  return signedPercent(
    receipt.rawCounters.goodOutputUnits - baseline.rawCounters.goodOutputUnits,
    baseline.rawCounters.goodOutputUnits,
  );
}

function scenarioMetrics(receipt: SimulationReceipt | null, baseline: SimulationReceipt | null): ScenarioMetricView {
  return {
    output: receipt ? receipt.rawCounters.goodOutputUnits.toLocaleString("en-US") : "—",
    outputDelta: outputDelta(receipt, baseline),
    cost: formatCompactCost(receipt?.totalCostMicroEur),
    costDelta: costDelta(receipt, baseline),
    defectRate: defectPercent(receipt),
    defectDelta: receipt && baseline
      ? signedPercent(
        receipt.rawCounters.badUnits * baseline.rawCounters.grossUnits
          - baseline.rawCounters.badUnits * receipt.rawCounters.grossUnits,
        baseline.rawCounters.badUnits * receipt.rawCounters.grossUnits,
        2,
      )
      : "—",
    machineAdditions: receipt ? "0" : "—",
  };
}

function scenarioStatus(
  scenario: ScenarioRecord,
  lockRevision: number,
): ScenarioView["status"] {
  const receipt = scenario.receipt;
  if (!receipt) return "NOT RUN";
  if (scenario.receiptScenarioRevision !== scenario.revision || scenario.receiptLockRevision !== lockRevision) return "STALE";
  if (receipt.feasibilityStatus === "FEASIBLE") return "FEASIBLE";
  if (receipt.feasibilityStatus === "PROVEN_INFEASIBLE_UNDER_LOCKS") return "PROVEN INFEASIBLE";
  return "FAILED";
}

function toneForStatus(status: ScenarioView["status"]): ScenarioView["tone"] {
  if (status === "FEASIBLE") return "success";
  if (status === "STALE") return "stale";
  if (status === "FAILED" || status === "PROVEN INFEASIBLE") return "danger";
  return "primary";
}

function toScenarioView(scenario: ScenarioRecord, state: SandboxState): ScenarioView {
  const status = scenarioStatus(scenario, state.lockRevision);
  return {
    id: scenario.id,
    marker: scenario.marker,
    name: scenario.name,
    status,
    tone: toneForStatus(status),
    revision: scenario.receiptLockRevision ?? state.lockRevision,
    receiptId: scenario.receipt?.runId ?? null,
    engineVersion: scenario.receipt?.engineVersion ?? null,
    infeasibilityProof: scenario.receipt?.upperBoundProof ? {
      proofVersion: scenario.receipt.upperBoundProof.proofVersion,
      method: scenario.receipt.upperBoundProof.method,
      goodOutputUpperBound: scenario.receipt.upperBoundProof.goodOutputUpperBound,
      targetGoodOutputUnits: scenario.receipt.upperBoundProof.targetGoodOutputUnits,
      exactInequality: scenario.receipt.upperBoundProof.exactInequality,
      proven: scenario.receipt.upperBoundProof.proven,
      sourceCurrent: scenario.receiptScenarioRevision === scenario.revision
        && scenario.receiptLockRevision === state.lockRevision,
    } : null,
    runnable: !scenario.placeholder,
    branchable: !scenario.placeholder,
    metrics: scenarioMetrics(scenario.receipt, state.baselineReceipt),
    violations: scenario.receipt?.constraints.filter((constraint) => !constraint.pass).map((constraint) => constraint.code) ?? [],
  };
}

function sumTicks(receipt: SimulationReceipt, getter: (tick: TickSnapshot) => number): number {
  return receipt.ticks.reduce((sum, tick) => sum + getter(tick), 0);
}

function utilization(receipt: SimulationReceipt | null, getter: (tick: TickSnapshot) => { processed: number; capacity: number }): string {
  if (!receipt) return "—";
  let processed = 0;
  let capacity = 0;
  for (const tick of receipt.ticks) {
    const value = getter(tick);
    processed += value.processed;
    capacity += value.capacity;
  }
  return capacity > 0 ? `${Math.round((processed / capacity) * 100)}%` : "0%";
}

function throughputBand(receipt: SimulationReceipt | null, getter: (tick: TickSnapshot) => number, scale = 1): string {
  if (!receipt) return "— / — / —";
  const values = receipt.ticks.map((tick) => getter(tick) / scale);
  const min = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const max = Math.max(...values);
  return `${Math.round(min).toLocaleString("en-US")} / ${Math.round(avg).toLocaleString("en-US")} / ${Math.round(max).toLocaleString("en-US")}`;
}

function resourceTotal(receipt: SimulationReceipt | null, resource: FactoryResource): number {
  if (!receipt) return 0;
  switch (resource) {
    case "Supplier": return receipt.rawCounters.deliveredMaterialGrams;
    case "Mixer": return receipt.rawCounters.mixedMaterialGrams;
    case "Packaging": return receipt.rawCounters.grossUnits;
    case "Quality Gate": return receipt.rawCounters.inspectedUnits;
    case "Warehouse": return receipt.rawCounters.goodOutputUnits;
  }
}

function resourceDelta(receipt: SimulationReceipt | null, baseline: SimulationReceipt | null, resource: FactoryResource): string {
  if (!receipt || !baseline) return "—";
  return signedPercent(resourceTotal(receipt, resource) - resourceTotal(baseline, resource), resourceTotal(baseline, resource), 0);
}

function stationViews(state: SandboxState): StationView[] {
  const receipt = state.baselineReceipt;
  const scenarioA = state.scenarios.find((scenario) => scenario.marker === "A")?.receipt ?? null;
  const scenarioB = state.scenarios.find((scenario) => scenario.marker === "B")?.receipt ?? null;
  const bottlenecks = new Set(receipt?.bottlenecks.map((item) => item.stage) ?? []);
  const common = (resource: FactoryResource) => ({
    deltaA: resourceDelta(scenarioA, receipt, resource),
    deltaB: resourceDelta(scenarioB, receipt, resource),
    locked: resource === "Packaging" && state.packagingLocked,
    bottleneck: resource === "Packaging" || bottlenecks.has(resource),
  });

  return [
    {
      id: "supplier", ordinal: "01", name: "Supplier", subtitle: "Material intake", Icon: Truck,
      queue: receipt ? `${Math.round(receipt.rawCounters.endingRawMaterialGrams / 1_000).toLocaleString("en-US")} kg` : "—",
      utilization: receipt ? `${Math.round((receipt.rawCounters.deliveredMaterialGrams / 12_800_000) * 100)}%` : "—",
      throughputBand: throughputBand(receipt, (tick) => tick.deliveredMaterialGrams, 1_000),
      ...common("Supplier"),
    },
    {
      id: "mixer", ordinal: "02", name: "Mixer", subtitle: "Existing asset 01", Icon: GearSix,
      queue: receipt ? `${Math.round(receipt.rawCounters.endingMixedMaterialGrams / 1_000).toLocaleString("en-US")} kg` : "—",
      utilization: utilization(receipt, (tick) => ({ processed: tick.mixer.processedGrams, capacity: tick.mixer.capacity })),
      throughputBand: throughputBand(receipt, (tick) => tick.mixer.processedGrams, 1_000),
      ...common("Mixer"),
    },
    {
      id: "packaging", ordinal: "03", name: "Packaging", subtitle: "Line 01", Icon: Package,
      queue: receipt ? receipt.rawCounters.endingPackagedQueueUnits.toLocaleString("en-US") : "—",
      utilization: utilization(receipt, (tick) => ({ processed: tick.packaging.grossUnits, capacity: tick.packaging.capacity })),
      throughputBand: throughputBand(receipt, (tick) => tick.packaging.grossUnits),
      ...common("Packaging"),
    },
    {
      id: "quality", ordinal: "04", name: "Quality Gate", subtitle: "Inline inspection", Icon: ShieldCheck,
      queue: receipt ? receipt.rawCounters.endingGoodQueueUnits.toLocaleString("en-US") : "—",
      utilization: utilization(receipt, (tick) => ({ processed: tick.qualityGate.inspectedUnits, capacity: tick.qualityGate.capacity })),
      throughputBand: throughputBand(receipt, (tick) => tick.qualityGate.inspectedUnits),
      ...common("Quality Gate"),
    },
    {
      id: "warehouse", ordinal: "05", name: "Warehouse", subtitle: "Dock 01", Icon: Warehouse,
      queue: receipt ? receipt.rawCounters.endingGoodQueueUnits.toLocaleString("en-US") : "—",
      utilization: utilization(receipt, (tick) => ({ processed: tick.warehouse.goodOutputUnits, capacity: tick.warehouse.capacity })),
      throughputBand: throughputBand(receipt, (tick) => tick.warehouse.goodOutputUnits),
      ...common("Warehouse"),
    },
  ];
}

function constraint(receipt: SimulationReceipt | null, code: ConstraintCode): ExactConstraint | undefined {
  return receipt?.constraints.find((item) => item.code === code);
}

function evidence(value: ExactConstraint | undefined): string {
  if (!value) return "—";
  if (value.code === "OUTPUT_20") {
    return `${BigInt(value.lhs).toLocaleString("en-US")} ${value.operator} ${BigInt(value.rhs).toLocaleString("en-US")}`;
  }
  if (value.code === "COST_8") {
    const scenarioCost = value.exactEvidence.scenarioTotalMicroEur;
    const baselineCost = value.exactEvidence.baselineTotalMicroEur;
    if (scenarioCost && baselineCost) {
      const cap = ((BigInt(baselineCost) * 108n) / 100n).toString();
      return `${formatCost(scenarioCost)} ${value.pass ? "≤" : ">"} ${formatCost(cap)} cap`;
    }
  }
  if (value.code === "DEFECT_NO_INCREASE") {
    const { scenarioBadUnits, scenarioGrossUnits, baselineBadUnits, baselineGrossUnits } = value.exactEvidence;
    if (scenarioBadUnits && scenarioGrossUnits && baselineBadUnits && baselineGrossUnits) {
      return `${scenarioBadUnits}/${scenarioGrossUnits} ${value.pass ? "≤" : ">"} ${baselineBadUnits}/${baselineGrossUnits}`;
    }
  }
  if (value.code === "NO_NEW_MACHINE") return `${value.lhs} ${value.operator} ${value.rhs} assets`;
  return `${value.lhs} ${value.operator} ${value.rhs}`;
}

function scenarioMetricForCode(receipt: SimulationReceipt | null, code: ConstraintCode): string {
  if (!receipt) return "—";
  if (code === "OUTPUT_20") return receipt.rawCounters.goodOutputUnits.toLocaleString("en-US");
  if (code === "COST_8") return formatCost(receipt.totalCostMicroEur);
  if (code === "DEFECT_NO_INCREASE") return defectPercent(receipt);
  return receipt.assetInventoryUnchanged ? "0" : "Changed";
}

function checkRows(state: SandboxState): ConstraintCheckView[] {
  const a = state.scenarios.find((scenario) => scenario.marker === "A")?.receipt ?? null;
  const b = state.scenarios.find((scenario) => scenario.marker === "B")?.receipt ?? null;
  const baseline = state.baselineReceipt;
  const definitions: Array<{ code: ConstraintCode; label: string; rule: string; baseline: string }> = [
    { code: "OUTPUT_20", label: "Output", rule: ">= baseline +20%", baseline: baseline ? baseline.rawCounters.goodOutputUnits.toLocaleString("en-US") : "—" },
    { code: "COST_8", label: "Operating cost", rule: "<= baseline +8%", baseline: formatCost(baseline?.totalCostMicroEur) },
    { code: "DEFECT_NO_INCREASE", label: "Defect rate", rule: "<= baseline", baseline: defectPercent(baseline) },
    { code: "NO_NEW_MACHINE", label: "Machine additions", rule: "= 0", baseline: "0" },
  ];

  return definitions.map(({ code, label, rule, baseline: baselineValue }) => {
    const checkA = constraint(a, code);
    const checkB = constraint(b, code);
    return {
      id: code,
      label,
      rule,
      baseline: baselineValue,
      scenarioA: scenarioMetricForCode(a, code),
      scenarioB: scenarioMetricForCode(b, code),
      scenarioAPass: checkA?.pass ?? null,
      scenarioBPass: checkB?.pass ?? null,
      scenarioAEvidence: evidence(checkA),
      scenarioBEvidence: evidence(checkB),
    };
  });
}

export function createBlueprintViewModel(state: SandboxState): BlueprintViewModel {
  const baselineView: ScenarioView = {
    id: "baseline",
    marker: "BL",
    name: "Baseline",
    status: "BASELINE",
    tone: "baseline",
    revision: state.lockRevision,
    receiptId: state.baselineReceipt?.runId ?? null,
    engineVersion: state.baselineReceipt?.engineVersion ?? null,
    infeasibilityProof: null,
    runnable: false,
    branchable: false,
    metrics: scenarioMetrics(state.baselineReceipt, state.baselineReceipt),
    violations: [],
  };
  return {
    revision: state.factoryRevision,
    latestRevision: state.lockRevision,
    lockRevision: state.lockRevision,
    webMcpStatus: state.webMcpReady ? "ready" : "unavailable",
    busy: state.busy,
    selectedScenarioId: state.selectedScenarioId,
    constraints: [
      { id: "output", label: "+20% output", detail: "At least twenty percent more good output than baseline" },
      { id: "cost", label: "≤8% cost", detail: "Total operating cost may rise by no more than eight percent" },
      { id: "assets", label: "No new machine", detail: "Existing asset inventory must remain unchanged" },
      { id: "quality", label: "Defects may not rise", detail: "Exact defect-rate comparison must pass" },
    ],
    stations: stationViews(state),
    scenarios: [baselineView, ...state.scenarios.map((scenario) => toScenarioView(scenario, state))],
    ledger: state.ledger,
    checks: checkRows(state),
  };
}
