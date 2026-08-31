import type { Icon } from "@phosphor-icons/react";

export type ScenarioTone = "baseline" | "danger" | "primary" | "success" | "stale";

export interface MissionConstraintView {
  id: string;
  label: string;
  detail: string;
}

export interface StationView {
  id: string;
  ordinal: string;
  name: string;
  subtitle: string;
  Icon: Icon;
  queue: string;
  utilization: string;
  throughputBand: string;
  deltaA: string;
  deltaB: string;
  locked: boolean;
  bottleneck: boolean;
}

export interface ScenarioMetricView {
  output: string;
  outputDelta: string;
  cost: string;
  costDelta: string;
  defectRate: string;
  defectDelta: string;
  machineAdditions: string;
}

export interface InfeasibilityProofView {
  proofVersion: string;
  method: string;
  goodOutputUpperBound: number;
  targetGoodOutputUnits: number;
  exactInequality: string;
  proven: boolean;
  sourceCurrent: boolean;
}

export interface ScenarioView {
  id: string;
  marker: string;
  name: string;
  status: "BASELINE" | "FEASIBLE" | "FAILED" | "STALE" | "PROVEN INFEASIBLE" | "NOT RUN";
  tone: ScenarioTone;
  revision: number;
  receiptId: string | null;
  engineVersion: string | null;
  infeasibilityProof: InfeasibilityProofView | null;
  sourceCurrent: boolean;
  historicalReason: string | null;
  runnable: boolean;
  branchable: boolean;
  metrics: ScenarioMetricView;
  violations: string[];
}

export interface LedgerEventView {
  id: string;
  kind: "human" | "tool" | "agent" | "simulation" | "state" | "system";
  label: string;
  detail: string;
  timestamp: string;
  revision: number;
  tone?: "neutral" | "primary" | "success" | "danger" | "warning";
}

export interface ConstraintCheckView {
  id: string;
  label: string;
  rule: string;
  baseline: string;
  scenarioA: string;
  scenarioB: string;
  scenarioAPass: boolean | null;
  scenarioBPass: boolean | null;
  scenarioAEvidence: string;
  scenarioBEvidence: string;
}

export interface AuthorityView {
  packagingLocked: boolean;
  lockRevision: number;
  blockedControls: string[];
  effectiveTick: number | null;
  effectiveElapsedMinutes: number | null;
}

export interface DecisionPacketExport {
  markdown: string;
  json: string;
  fileName: string;
}

export interface BlueprintViewModel {
  revision: number;
  latestRevision: number;
  lockRevision: number;
  webMcpStatus: "ready" | "unavailable";
  busy: boolean;
  selectedScenarioId: string;
  authority: AuthorityView;
  constraints: MissionConstraintView[];
  stations: StationView[];
  scenarios: ScenarioView[];
  ledger: LedgerEventView[];
  checks: ConstraintCheckView[];
}
