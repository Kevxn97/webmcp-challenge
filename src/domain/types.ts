export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type CalibrationMode = "standard" | "enhanced";
export type SupplierMode = "standard" | "expedite";
export type ChangeoverMinutes = 15 | 30 | 45;
export type QualityRate = 600 | 700 | 800 | 900;
export type WarehouseRate = 800 | 900 | 1000;

export type FactoryResource =
  | "Supplier"
  | "Mixer"
  | "Packaging"
  | "Quality Gate"
  | "Warehouse";

export interface FactoryControls {
  mixerSpeedBps: number;
  packagingSpeedBps: number;
  changeoverMinutes: ChangeoverMinutes;
  calibration: CalibrationMode;
  qualityRateUnitsPerHour: QualityRate;
  warehouseRateUnitsPerHour: WarehouseRate;
  supplierMode: SupplierMode;
}

export interface MaterialDelivery {
  deliveryId: string;
  tick: number;
  grams: number;
}

export type OperationActor = "human" | "model";

interface OperationBase {
  operationId: string;
  tick: number;
  actor: OperationActor;
}

export type FactoryOperation =
  | (OperationBase & { kind: "SET_MIXER_SPEED"; valueBps: number })
  | (OperationBase & { kind: "SET_PACKAGING_SPEED"; valueBps: number })
  | (OperationBase & {
      kind: "SET_CHANGEOVER_MINUTES";
      valueMinutes: ChangeoverMinutes;
    })
  | (OperationBase & {
      kind: "SET_CALIBRATION";
      value: CalibrationMode;
    })
  | (OperationBase & {
      kind: "SET_QUALITY_RATE";
      valueUnitsPerHour: QualityRate;
    })
  | (OperationBase & {
      kind: "SET_WAREHOUSE_RATE";
      valueUnitsPerHour: WarehouseRate;
    })
  | (OperationBase & { kind: "SET_SUPPLIER_MODE"; value: SupplierMode })
  | (OperationBase & { kind: "LOCK_RESOURCE"; resource: FactoryResource });

export interface FactorySimulationInput {
  inputVersion: "factory-input/v1";
  tickMinutes: 15;
  totalTicks: 64;
  controls: FactoryControls;
  deliveries: readonly MaterialDelivery[];
  operations: readonly FactoryOperation[];
}

export interface AssetRecord {
  assetId: string;
  resource: Exclude<FactoryResource, "Supplier">;
  assetType: string;
}

export type OperationRejectionReason =
  | "DUPLICATE_OPERATION"
  | "OPERATION_ID_REUSED"
  | "INVALID_OPERATION"
  | "INVALID_ACTOR"
  | "OUT_OF_RANGE"
  | "PRE_SHIFT_ONLY"
  | "LOCKED_RESOURCE"
  | "UNKNOWN_OPERATION";

export interface AcceptedOperation {
  operationId: string;
  tick: number;
  actor: OperationActor;
  kind: string;
  resource: FactoryResource;
  appliedValue: JsonObject;
}

export interface RejectedOperation {
  operationId: string;
  tick: number | null;
  actor: string | null;
  kind: string;
  resource: FactoryResource | null;
  reason: OperationRejectionReason;
  fatal: boolean;
  message: string;
}

export interface OperationAuditSummary {
  fatalRejectionCount: number;
  benignDuplicateReplayCount: number;
  /** Rejections with a missing or out-of-range tick cannot belong to a snapshot. */
  unattributedRejectedOperationIds: readonly string[];
  tickAttributionPolicy: "VALID_TICK_REJECTIONS_ON_TICK_INVALID_TICKS_UNATTRIBUTED";
}

export interface ResourceLock {
  resource: FactoryResource;
  effectiveTick: number;
  operationId: string;
  lockedBy: "human";
  lockedControlPaths: readonly string[];
}

export interface TickStageSnapshot {
  capacity: number;
  processed: number;
}

export interface InspectedDefectBatchEvidence {
  units: number;
  defectPropensityBps: number;
}

export interface TickSnapshot {
  tick: number;
  elapsedMinutes: number;
  controls: FactoryControls;
  deliveredMaterialGrams: number;
  acceptedOperationIds: readonly string[];
  /** Includes runtime and preflight rejections whose declared tick is this tick. */
  rejectedOperationIds: readonly string[];
  mixer: TickStageSnapshot & { processedGrams: number };
  packaging: TickStageSnapshot & {
    grossUnits: number;
    changeoverActive: boolean;
    packagingDefectPropensityBps: number;
  };
  qualityGate: TickStageSnapshot & {
    inspectedUnits: number;
    badUnits: number;
    goodUnits: number;
    inspectedBatches: readonly InspectedDefectBatchEvidence[];
    inspectedDefectNumerator: number;
    defectRemainderBefore: number;
    defectCalculationNumerator: number;
    defectDenominator: 10_000;
    defectRemainderAfter: number;
  };
  warehouse: TickStageSnapshot & { goodOutputUnits: number };
  buffers: {
    rawMaterialGrams: number;
    mixedMaterialGrams: number;
    packagedUnits: number;
    goodUnits: number;
  };
  cumulative: {
    grossUnits: number;
    inspectedUnits: number;
    badUnits: number;
    goodOutputUnits: number;
  };
}

export interface RawCounters {
  deliveredMaterialGrams: number;
  mixedMaterialGrams: number;
  packagedMaterialGrams: number;
  endingRawMaterialGrams: number;
  endingMixedMaterialGrams: number;
  grossUnits: number;
  inspectedUnits: number;
  endingPackagedQueueUnits: number;
  badUnits: number;
  goodUnitsAfterInspection: number;
  endingGoodQueueUnits: number;
  goodOutputUnits: number;
  energyWattMinutes: number;
}

export type CostCategory =
  | "FIXED"
  | "RAW_MATERIAL"
  | "PACKAGING"
  | "INSPECTION"
  | "SCRAP"
  | "ELECTRICITY"
  | "CALIBRATION"
  | "SMED"
  | "EXPEDITE";

export interface CostLedgerEntry {
  category: CostCategory;
  basisQuantity: string;
  basisUnit: string;
  rateMicroEur: string;
  rateUnit: string;
  amountMicroEur: string;
  calculation: string;
  rounding: "EXACT" | "FLOOR_TO_MICRO_EUR";
}

export type ConstraintCode =
  | "OUTPUT_20"
  | "COST_8"
  | "DEFECT_NO_INCREASE"
  | "NO_NEW_MACHINE";

export interface ExactConstraint {
  code: ConstraintCode;
  lhs: string;
  operator: ">=" | "<=" | "=";
  rhs: string;
  unit: string;
  pass: boolean;
  exactEvidence: Record<string, string>;
}

export interface InvariantCheck {
  code: string;
  lhs: string;
  operator: "=" | ">=";
  rhs: string;
  pass: boolean;
  evidence: string;
}

export interface BottleneckEvidence {
  stage: FactoryResource;
  reason: string;
  capacityLimitedTicks: number;
  blockedTicks: number;
  endingUpstreamQueue: number;
  queueUnit: "grams" | "units";
}

export interface EnergyBreakdown {
  modelVersion: string;
  mixerWattMinutes: number;
  packagingWattMinutes: number;
  qualityGateWattMinutes: number;
  warehouseWattMinutes: number;
  totalWattMinutes: number;
  electricityRateMicroEurPerKwh: string;
  electricityCostRemainderNumerator: string;
}

export interface UpperBoundProof {
  proofVersion: "factory-lock-upper-bound/v1";
  method: "PACKAGING_LOCK_CAPACITY_WITH_DEFECT_CASE_SPLIT";
  lockTick: number;
  lockedResource: "Packaging";
  lockedPackagingSpeedBps: number;
  grossUnitsBeforeLock: number;
  observedBadUnitsBeforeLock: number;
  remainingTicks: number;
  maximumAdditionalGrossUnits: number;
  grossUnitsUpperBound: number;
  committedDefectHorizonUnits: number;
  defectPropensityBps: number;
  minimumAdditionalBadUnits: number;
  minimumBadUnitsAtUpperBranch: number;
  lowerBranchGoodOutputUpperBound: number;
  goodOutputUpperBound: number;
  targetGoodOutputUnits: number;
  exactInequality: string;
  proven: boolean;
}

export type FeasibilityStatus =
  | "FEASIBLE"
  | "NOT_FEASIBLE"
  | "PROVEN_INFEASIBLE_UNDER_LOCKS"
  | "INVALID_OPERATIONS"
  | "INVALID_INVARIANTS";

export interface BaselineComparison {
  baselineGrossUnits: number;
  baselineBadUnits: number;
  baselineDefectPropensityBps: number;
  baselineGoodOutputUnits: number;
  targetGoodOutputUnits: number;
  outputGainNumerator: number;
  outputGainDenominator: number;
  outputGainBasisPointsFloor: number;
  baselineTotalCostMicroEur: string;
}

export interface SimulationReceipt {
  receiptVersion: "factory-receipt/v1";
  engineVersion: string;
  energyModelVersion: string;
  hashAlgorithm: "SHA-256";
  hashScope: "canonical-receipt-without-runId-and-contentHash";
  inputHash: string;
  runId: string;
  contentHash: string;
  inputSnapshot: JsonObject;
  tickMinutes: 15;
  totalTicks: 64;
  unitMassGrams: number;
  rawCounters: RawCounters;
  ticks: readonly TickSnapshot[];
  costLedger: readonly CostLedgerEntry[];
  totalCostMicroEur: string;
  energy: EnergyBreakdown;
  baselineComparison: BaselineComparison;
  bottlenecks: readonly BottleneckEvidence[];
  acceptedOperations: readonly AcceptedOperation[];
  rejectedOperations: readonly RejectedOperation[];
  operationAudit: OperationAuditSummary;
  locks: readonly ResourceLock[];
  constraints: readonly ExactConstraint[];
  feasibilityStatus: FeasibilityStatus;
  upperBoundProof?: UpperBoundProof;
  invariantChecks: readonly InvariantCheck[];
  assetInventoryBefore: readonly AssetRecord[];
  assetInventoryAfter: readonly AssetRecord[];
  assetInventoryUnchanged: boolean;
}
