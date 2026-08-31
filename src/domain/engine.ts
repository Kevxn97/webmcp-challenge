import { canonicalStableStringify, sha256Hex } from "./canonical";
import { SPEED_BPS_MAX, SPEED_BPS_MIN } from "../shared/controlDefinitions";
import {
  ASSET_INVENTORY,
  BASELINE_BAD_UNITS,
  BASELINE_GOOD_OUTPUT_UNITS,
  BASELINE_GROSS_UNITS,
  BASE_DEFECT_PROPENSITY_BPS,
  COST_RATES,
  ENERGY_MODEL_VERSION,
  ENERGY_POWER_WATTS,
  ENGINE_VERSION,
  INPUT_VERSION,
  LOCK_PROOF_DEFECT_HORIZON_UNITS,
  MIXER_NAMEPLATE_GRAMS_PER_HOUR,
  PACKAGING_NAMEPLATE_UNITS_PER_HOUR,
  RECEIPT_VERSION,
  TARGET_GOOD_OUTPUT_UNITS,
  TICK_MINUTES,
  TOTAL_TICKS,
  UNIT_MASS_GRAMS,
} from "./constants";
import { createBaselineInput } from "./fixtures";
import type {
  AcceptedOperation,
  AssetRecord,
  BaselineComparison,
  BottleneckEvidence,
  CalibrationMode,
  CostCategory,
  CostLedgerEntry,
  EnergyBreakdown,
  ExactConstraint,
  FactoryControls,
  FactoryResource,
  FactorySimulationInput,
  FeasibilityStatus,
  InvariantCheck,
  JsonObject,
  JsonValue,
  MaterialDelivery,
  OperationActor,
  OperationRejectionReason,
  RawCounters,
  RejectedOperation,
  ResourceLock,
  SimulationReceipt,
  TickSnapshot,
  UpperBoundProof,
} from "./types";

export class FactoryValidationError extends Error {
  readonly code = "FACTORY_INPUT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "FactoryValidationError";
  }
}

interface RuntimeOperation {
  record: Readonly<Record<string, JsonValue>> | null;
  snapshot: JsonValue;
  normalizationSnapshot: JsonObject;
  normalizationError?: string;
  canonical: string;
  originalIndex: number;
  normalizedIndex: number;
}

interface NormalizedInput {
  controls: FactoryControls;
  deliveries: MaterialDelivery[];
  operations: RuntimeOperation[];
  snapshot: JsonObject;
}

interface QualityBatch {
  units: number;
  defectPropensityBps: number;
}

interface PackagingLockProofSeed {
  lockTick: number;
  packagingSpeedBps: number;
  changeoverMinutes: number;
  calibration: CalibrationMode;
  grossUnitsBeforeLock: number;
  badUnitsBeforeLock: number;
  defectRemainder: number;
}

interface InternalEnergy {
  mixerWattMinutes: number;
  packagingWattMinutes: number;
  qualityGateWattMinutes: number;
  warehouseWattMinutes: number;
}

interface InternalCostLedger {
  entries: CostLedgerEntry[];
  totalMicroEur: bigint;
  electricityRemainderNumerator: bigint;
}

interface InternalRun {
  rawCounters: RawCounters;
  ticks: TickSnapshot[];
  acceptedOperations: AcceptedOperation[];
  rejectedOperations: RejectedOperation[];
  unattributedRejectedOperationIds: string[];
  locks: ResourceLock[];
  packagingLockProofSeed?: PackagingLockProofSeed;
  cost: InternalCostLedger;
  energy: InternalEnergy;
  bottlenecks: BottleneckEvidence[];
  invariantChecks: InvariantCheck[];
}

interface ScheduledOperation {
  operation: RuntimeOperation;
  preflightRejection?: RejectedOperation;
}

interface MutableCounters {
  deliveredMaterialGrams: number;
  mixedMaterialGrams: number;
  grossUnits: number;
  inspectedUnits: number;
  badUnits: number;
  goodUnitsAfterInspection: number;
  goodOutputUnits: number;
}

interface MutableBuffers {
  rawMaterialGrams: number;
  mixedMaterialGrams: number;
  packagedUnits: number;
  goodUnits: number;
}

interface OperationContext {
  controls: FactoryControls;
  locksByResource: Map<FactoryResource, ResourceLock>;
  locks: ResourceLock[];
  accepted: AcceptedOperation[];
  rejected: RejectedOperation[];
}

const KNOWN_RESOURCES: readonly FactoryResource[] = [
  "Supplier",
  "Mixer",
  "Packaging",
  "Quality Gate",
  "Warehouse",
];

const KNOWN_OPERATION_KINDS = new Set([
  "SET_MIXER_SPEED",
  "SET_PACKAGING_SPEED",
  "SET_CHANGEOVER_MINUTES",
  "SET_CALIBRATION",
  "SET_QUALITY_RATE",
  "SET_WAREHOUSE_RATE",
  "SET_SUPPLIER_MODE",
  "LOCK_RESOURCE",
]);

const CHANGEOVER_VALUES = new Set([15, 30, 45]);
const QUALITY_RATE_VALUES = new Set([600, 700, 800, 900]);
const WAREHOUSE_RATE_VALUES = new Set([800, 900, 1000]);
const CALIBRATION_VALUES = new Set(["standard", "enhanced"]);
const SUPPLIER_MODE_VALUES = new Set(["standard", "expedite"]);

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

class UnsafeOperationShapeError extends Error {}

function operationPath(parent: string, key: string): string {
  return `${parent}.${JSON.stringify(key)}`;
}

function isArrayIndexKey(key: string, length: number): boolean {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return (
    Number.isSafeInteger(index) &&
    index >= 0 &&
    index < length &&
    index <= 4_294_967_294 &&
    String(index) === key
  );
}

/**
 * Descriptor-only JSON snapshotting for operation input. It never reads a
 * property value through `get`, rejects accessors/custom shapes, and freezes
 * every cloned container. Execution retains only this clone, never the caller
 * object (including when the caller supplied a Proxy).
 */
function snapshotOperationJsonValue(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): JsonValue {
  if (value === null) return null;
  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new UnsafeOperationShapeError(`${path} has a non-finite number`);
      }
      return Object.is(value, -0) ? 0 : value;
    case "bigint":
      return value.toString(10);
    case "undefined":
    case "function":
    case "symbol":
      throw new UnsafeOperationShapeError(
        `${path} has a non-JSON ${typeof value} value`,
      );
    case "object":
      break;
  }

  const object = value as object;
  if (ancestors.has(object)) {
    throw new UnsafeOperationShapeError(`${path} is circular`);
  }
  ancestors.add(object);

  try {
    const prototype = Object.getPrototypeOf(object);
    const descriptors = Object.getOwnPropertyDescriptors(object);
    const descriptorKeys = Reflect.ownKeys(descriptors);

    if (Array.isArray(object)) {
      if (prototype !== Array.prototype) {
        throw new UnsafeOperationShapeError(
          `${path} must use the standard Array prototype`,
        );
      }
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor?.value;
      if (
        !lengthDescriptor ||
        typeof length !== "number" ||
        !Number.isSafeInteger(length) ||
        length < 0
      ) {
        throw new UnsafeOperationShapeError(`${path} has an invalid array length`);
      }

      for (const key of descriptorKeys) {
        if (typeof key === "symbol") {
          throw new UnsafeOperationShapeError(`${path} has a symbol property`);
        }
        if (key === "length") continue;
        const descriptor = descriptors[key];
        if (!isArrayIndexKey(key, length)) {
          throw new UnsafeOperationShapeError(
            `${operationPath(path, key)} is a custom array property`,
          );
        }
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          throw new UnsafeOperationShapeError(
            `${operationPath(path, key)} must be an enumerable data property`,
          );
        }
      }

      const clone: JsonValue[] = new Array(length);
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor && "value" in descriptor) {
          clone[index] = snapshotOperationJsonValue(
            descriptor.value,
            `${path}[${index}]`,
            ancestors,
          );
        }
      }
      return Object.freeze(clone) as unknown as JsonValue[];
    }

    if (prototype !== Object.prototype && prototype !== null) {
      throw new UnsafeOperationShapeError(
        `${path} must use Object.prototype or null`,
      );
    }

    const clone = Object.create(null) as Record<string, JsonValue>;
    for (const key of descriptorKeys) {
      if (typeof key === "symbol") {
        throw new UnsafeOperationShapeError(`${path} has a symbol property`);
      }
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        throw new UnsafeOperationShapeError(
          `${operationPath(path, key)} must be an enumerable data property`,
        );
      }
      Object.defineProperty(clone, key, {
        value: snapshotOperationJsonValue(
          descriptor.value,
          operationPath(path, key),
          ancestors,
        ),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(clone) as JsonObject;
  } finally {
    ancestors.delete(object);
  }
}

function normalizeOperationOnce(raw: unknown): {
  record: Readonly<Record<string, JsonValue>> | null;
  snapshot: JsonValue;
  normalizationSnapshot: JsonObject;
  normalizationError?: string;
} {
  try {
    const snapshot = snapshotOperationJsonValue(raw, "$operation", new Set());
    if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new UnsafeOperationShapeError("$operation must be a plain record");
    }
    const normalizationSnapshot = Object.freeze({
      status: "NORMALIZED",
      error: null,
    }) as JsonObject;
    return {
      record: snapshot as Readonly<Record<string, JsonValue>>,
      snapshot,
      normalizationSnapshot,
    };
  } catch (error) {
    const normalizationError =
      error instanceof UnsafeOperationShapeError
        ? error.message
        : "$operation could not be descriptor-snapshotted";
    const normalizationSnapshot = Object.freeze({
      status: "REJECTED_UNSAFE_SHAPE",
      error: normalizationError,
    }) as JsonObject;
    return {
      record: null,
      snapshot: null,
      normalizationSnapshot,
      normalizationError,
    };
  }
}

function assertInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new FactoryValidationError(`${label} must be a safe integer`);
  }
}

function assertInitialSpeed(value: unknown, label: string): asserts value is number {
  assertInteger(value, label);
  if (value < SPEED_BPS_MIN || value > SPEED_BPS_MAX) {
    throw new FactoryValidationError(
      `${label} must be between ${SPEED_BPS_MIN} and ${SPEED_BPS_MAX} bps`,
    );
  }
}

function normalizeControls(value: unknown): FactoryControls {
  const controls = asRecord(value);
  if (!controls) {
    throw new FactoryValidationError("controls must be an object");
  }

  assertInitialSpeed(controls.mixerSpeedBps, "controls.mixerSpeedBps");
  assertInitialSpeed(controls.packagingSpeedBps, "controls.packagingSpeedBps");

  if (!CHANGEOVER_VALUES.has(controls.changeoverMinutes as number)) {
    throw new FactoryValidationError("controls.changeoverMinutes must be 15, 30, or 45");
  }
  if (!CALIBRATION_VALUES.has(controls.calibration as string)) {
    throw new FactoryValidationError(
      "controls.calibration must be standard or enhanced",
    );
  }
  if (!QUALITY_RATE_VALUES.has(controls.qualityRateUnitsPerHour as number)) {
    throw new FactoryValidationError(
      "controls.qualityRateUnitsPerHour must be 600, 700, 800, or 900",
    );
  }
  if (!WAREHOUSE_RATE_VALUES.has(controls.warehouseRateUnitsPerHour as number)) {
    throw new FactoryValidationError(
      "controls.warehouseRateUnitsPerHour must be 800, 900, or 1000",
    );
  }
  if (!SUPPLIER_MODE_VALUES.has(controls.supplierMode as string)) {
    throw new FactoryValidationError(
      "controls.supplierMode must be standard or expedite",
    );
  }

  return {
    mixerSpeedBps: controls.mixerSpeedBps,
    packagingSpeedBps: controls.packagingSpeedBps,
    changeoverMinutes: controls.changeoverMinutes as FactoryControls["changeoverMinutes"],
    calibration: controls.calibration as FactoryControls["calibration"],
    qualityRateUnitsPerHour:
      controls.qualityRateUnitsPerHour as FactoryControls["qualityRateUnitsPerHour"],
    warehouseRateUnitsPerHour:
      controls.warehouseRateUnitsPerHour as FactoryControls["warehouseRateUnitsPerHour"],
    supplierMode: controls.supplierMode as FactoryControls["supplierMode"],
  };
}

function normalizeDeliveries(value: unknown): MaterialDelivery[] {
  if (!Array.isArray(value)) {
    throw new FactoryValidationError("deliveries must be an array");
  }

  const seenIds = new Set<string>();
  const deliveries = value.map((candidate, index) => {
    const delivery = asRecord(candidate);
    if (!delivery) {
      throw new FactoryValidationError(`deliveries[${index}] must be an object`);
    }
    if (typeof delivery.deliveryId !== "string" || !delivery.deliveryId.trim()) {
      throw new FactoryValidationError(
        `deliveries[${index}].deliveryId must be a non-empty string`,
      );
    }
    if (seenIds.has(delivery.deliveryId)) {
      throw new FactoryValidationError(`duplicate deliveryId ${delivery.deliveryId}`);
    }
    seenIds.add(delivery.deliveryId);
    assertInteger(delivery.tick, `deliveries[${index}].tick`);
    assertInteger(delivery.grams, `deliveries[${index}].grams`);
    if (delivery.tick < 0 || delivery.tick >= TOTAL_TICKS) {
      throw new FactoryValidationError(
        `deliveries[${index}].tick must be between 0 and ${TOTAL_TICKS - 1}`,
      );
    }
    if (delivery.grams <= 0) {
      throw new FactoryValidationError(`deliveries[${index}].grams must be positive`);
    }
    return {
      deliveryId: delivery.deliveryId,
      tick: delivery.tick,
      grams: delivery.grams,
    };
  });

  return deliveries.sort(
    (left, right) =>
      left.tick - right.tick || compareStrings(left.deliveryId, right.deliveryId),
  );
}

function operationSortParts(candidate: RuntimeOperation) {
  const operation = candidate.record;
  const tick = Number.isSafeInteger(operation?.tick)
    ? (operation?.tick as number)
    : Number.MAX_SAFE_INTEGER;
  const isHumanLock =
    operation?.kind === "LOCK_RESOURCE" && operation?.actor === "human";
  const operationId =
    typeof operation?.operationId === "string" ? operation.operationId : "";
  return { tick, priority: isHumanLock ? 0 : 1, operationId };
}

function normalizeOperations(value: unknown): RuntimeOperation[] {
  if (!Array.isArray(value)) {
    throw new FactoryValidationError("operations must be an array");
  }

  let prototype: object | null;
  let descriptors: Record<PropertyKey, PropertyDescriptor>;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<
      PropertyKey,
      PropertyDescriptor
    >;
  } catch {
    throw new FactoryValidationError(
      "operations must be descriptor-snapshotable",
    );
  }
  if (prototype !== Array.prototype) {
    throw new FactoryValidationError(
      "operations must use the standard Array prototype",
    );
  }
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || (length as number) < 0) {
    throw new FactoryValidationError("operations has an invalid array length");
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === "symbol") {
      throw new FactoryValidationError("operations must not have symbol properties");
    }
    if (key === "length") continue;
    const descriptor = descriptors[key];
    if (!isArrayIndexKey(key, length as number)) {
      throw new FactoryValidationError(
        `operations.${JSON.stringify(key)} is a custom array property`,
      );
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new FactoryValidationError(
        `operations[${key}] must be an enumerable data property`,
      );
    }
  }

  const operationValues = Array.from(
    { length: length as number },
    (_, index) => descriptors[String(index)]?.value,
  );
  const operations = operationValues.map((raw, originalIndex) => {
    const normalized = normalizeOperationOnce(raw);
    return {
      ...normalized,
      canonical: canonicalStableStringify({
        operation: normalized.snapshot,
        normalization: normalized.normalizationSnapshot,
      }),
      originalIndex,
      normalizedIndex: -1,
    };
  });

  operations.sort((left, right) => {
    const leftParts = operationSortParts(left);
    const rightParts = operationSortParts(right);
    const timeAndPriority =
      leftParts.tick - rightParts.tick ||
      leftParts.priority - rightParts.priority;
    if (timeAndPriority !== 0) return timeAndPriority;

    const idOrder = compareStrings(leftParts.operationId, rightParts.operationId);
    if (idOrder !== 0) return idOrder;

    // Reused IDs retain input order. Canonical payload sorting here would let
    // the payload value decide which conflicting command gets to execute.
    return left.originalIndex - right.originalIndex;
  });
  operations.forEach((operation, index) => {
    operation.normalizedIndex = index;
  });
  return operations;
}

function controlsSnapshot(controls: FactoryControls): JsonObject {
  return {
    mixerSpeedBps: controls.mixerSpeedBps,
    packagingSpeedBps: controls.packagingSpeedBps,
    changeoverMinutes: controls.changeoverMinutes,
    calibration: controls.calibration,
    qualityRateUnitsPerHour: controls.qualityRateUnitsPerHour,
    warehouseRateUnitsPerHour: controls.warehouseRateUnitsPerHour,
    supplierMode: controls.supplierMode,
  };
}

function normalizeInput(input: FactorySimulationInput): NormalizedInput {
  const record = asRecord(input);
  if (!record) {
    throw new FactoryValidationError("input must be an object");
  }
  if (record.inputVersion !== INPUT_VERSION) {
    throw new FactoryValidationError(`inputVersion must be ${INPUT_VERSION}`);
  }
  if (record.tickMinutes !== TICK_MINUTES || record.totalTicks !== TOTAL_TICKS) {
    throw new FactoryValidationError(
      `Only ${TICK_MINUTES}-minute steps and ${TOTAL_TICKS} ticks are supported`,
    );
  }

  const controls = normalizeControls(record.controls);
  const deliveries = normalizeDeliveries(record.deliveries);
  const operations = normalizeOperations(record.operations);
  const snapshot: JsonObject = {
    inputVersion: INPUT_VERSION,
    tickMinutes: TICK_MINUTES,
    totalTicks: TOTAL_TICKS,
    controls: controlsSnapshot(controls),
    deliveries: deliveries.map((delivery) => ({ ...delivery })),
    operations: operations.map((operation) => operation.snapshot),
    operationNormalization: operations.map(
      (operation) => operation.normalizationSnapshot,
    ),
  };

  return { controls, deliveries, operations, snapshot };
}

function cloneControls(controls: FactoryControls): FactoryControls {
  return { ...controls };
}

function cloneAssets(): AssetRecord[] {
  return ASSET_INVENTORY.map((asset) => ({ ...asset }));
}

function rejection(
  operation: RuntimeOperation,
  reason: OperationRejectionReason,
  message: string,
  overrides: Partial<RejectedOperation> = {},
): RejectedOperation {
  const record = operation.record;
  return {
    operationId:
      typeof record?.operationId === "string" && record.operationId
        ? record.operationId
        : `invalid-operation-${operation.normalizedIndex}`,
    tick: Number.isSafeInteger(record?.tick) ? (record?.tick as number) : null,
    actor: typeof record?.actor === "string" ? record.actor : null,
    kind: typeof record?.kind === "string" ? record.kind : "(missing)",
    resource: null,
    reason,
    fatal: reason !== "DUPLICATE_OPERATION",
    message,
    ...overrides,
  };
}

function resourceForKind(kind: string): FactoryResource | null {
  switch (kind) {
    case "SET_MIXER_SPEED":
      return "Mixer";
    case "SET_PACKAGING_SPEED":
    case "SET_CHANGEOVER_MINUTES":
    case "SET_CALIBRATION":
      return "Packaging";
    case "SET_QUALITY_RATE":
      return "Quality Gate";
    case "SET_WAREHOUSE_RATE":
      return "Warehouse";
    case "SET_SUPPLIER_MODE":
      return "Supplier";
    default:
      return null;
  }
}

function lockedControlPaths(resource: FactoryResource): string[] {
  switch (resource) {
    case "Supplier":
      return ["supplierMode"];
    case "Mixer":
      return ["mixerSpeedBps"];
    case "Packaging":
      return ["packagingSpeedBps", "changeoverMinutes", "calibration"];
    case "Quality Gate":
      return ["qualityRateUnitsPerHour"];
    case "Warehouse":
      return ["warehouseRateUnitsPerHour"];
  }
}

function isSpeedBps(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= SPEED_BPS_MIN &&
    value <= SPEED_BPS_MAX
  );
}

function acceptSetting(
  context: OperationContext,
  operationId: string,
  tick: number,
  actor: OperationActor,
  kind: string,
  resource: FactoryResource,
  previousValue: JsonValue,
  nextValue: JsonValue,
) {
  context.accepted.push({
    operationId,
    tick,
    actor,
    kind,
    resource,
    appliedValue: { previousValue, nextValue },
  });
}

function applyOperation(
  operation: RuntimeOperation,
  tick: number,
  context: OperationContext,
): void {
  const record = operation.record;
  if (!record) {
    context.rejected.push(
      rejection(operation, "INVALID_OPERATION", "Operation must be an object"),
    );
    return;
  }

  const operationId = record.operationId as string;
  const kind = typeof record.kind === "string" ? record.kind : "(missing)";
  if (record.actor !== "human" && record.actor !== "model") {
    context.rejected.push(
      rejection(operation, "INVALID_ACTOR", "actor must be human or model"),
    );
    return;
  }
  const actor = record.actor;

  if (!KNOWN_OPERATION_KINDS.has(kind)) {
    context.rejected.push(
      rejection(
        operation,
        "UNKNOWN_OPERATION",
        `Unknown operation kind ${kind}; asset additions are not supported`,
      ),
    );
    return;
  }

  if (kind === "LOCK_RESOURCE") {
    if (actor !== "human") {
      context.rejected.push(
        rejection(
          operation,
          "INVALID_ACTOR",
          "Only a human may lock a resource",
        ),
      );
      return;
    }
    if (!KNOWN_RESOURCES.includes(record.resource as FactoryResource)) {
      context.rejected.push(
        rejection(operation, "INVALID_OPERATION", "resource is not lockable"),
      );
      return;
    }
    const resource = record.resource as FactoryResource;
    if (context.locksByResource.has(resource)) {
      context.rejected.push(
        rejection(
          operation,
          "LOCKED_RESOURCE",
          `${resource} was already locked`,
          { resource },
        ),
      );
      return;
    }
    const lock: ResourceLock = {
      resource,
      effectiveTick: tick,
      operationId,
      lockedBy: "human",
      lockedControlPaths: lockedControlPaths(resource),
    };
    context.locksByResource.set(resource, lock);
    context.locks.push(lock);
    context.accepted.push({
      operationId,
      tick,
      actor,
      kind,
      resource,
      appliedValue: { locked: true },
    });
    return;
  }

  const resource = resourceForKind(kind);
  if (!resource) {
    context.rejected.push(
      rejection(operation, "UNKNOWN_OPERATION", `Unknown operation kind ${kind}`),
    );
    return;
  }
  if (context.locksByResource.has(resource)) {
    context.rejected.push(
      rejection(
        operation,
        "LOCKED_RESOURCE",
        `${resource} is human-locked at tick ${context.locksByResource.get(resource)?.effectiveTick}`,
        { resource },
      ),
    );
    return;
  }

  switch (kind) {
    case "SET_MIXER_SPEED": {
      if (!isSpeedBps(record.valueBps)) {
        context.rejected.push(
          rejection(
            operation,
            "OUT_OF_RANGE",
            "Mixer speed must be an integer from 5000 through 10000 bps",
            { resource },
          ),
        );
        return;
      }
      const previous = context.controls.mixerSpeedBps;
      context.controls.mixerSpeedBps = record.valueBps;
      acceptSetting(context, operationId, tick, actor, kind, resource, previous, record.valueBps);
      return;
    }
    case "SET_PACKAGING_SPEED": {
      if (!isSpeedBps(record.valueBps)) {
        context.rejected.push(
          rejection(
            operation,
            "OUT_OF_RANGE",
            "Packaging speed must be an integer from 5000 through 10000 bps",
            { resource },
          ),
        );
        return;
      }
      const previous = context.controls.packagingSpeedBps;
      context.controls.packagingSpeedBps = record.valueBps;
      acceptSetting(context, operationId, tick, actor, kind, resource, previous, record.valueBps);
      return;
    }
    case "SET_CHANGEOVER_MINUTES": {
      if (tick !== 0) {
        context.rejected.push(
          rejection(
            operation,
            "PRE_SHIFT_ONLY",
            "Changeover may only be selected at tick 0 before the shift starts",
            { resource },
          ),
        );
        return;
      }
      if (!CHANGEOVER_VALUES.has(record.valueMinutes as number)) {
        context.rejected.push(
          rejection(
            operation,
            "OUT_OF_RANGE",
            "Changeover must be 15, 30, or 45 minutes",
            { resource },
          ),
        );
        return;
      }
      const previous = context.controls.changeoverMinutes;
      context.controls.changeoverMinutes =
        record.valueMinutes as FactoryControls["changeoverMinutes"];
      acceptSetting(
        context,
        operationId,
        tick,
        actor,
        kind,
        resource,
        previous,
        record.valueMinutes as number,
      );
      return;
    }
    case "SET_CALIBRATION": {
      if (tick !== 0) {
        context.rejected.push(
          rejection(
            operation,
            "PRE_SHIFT_ONLY",
            "Calibration may only be selected at tick 0 before the shift starts",
            { resource },
          ),
        );
        return;
      }
      if (!CALIBRATION_VALUES.has(record.value as string)) {
        context.rejected.push(
          rejection(
            operation,
            "OUT_OF_RANGE",
            "Calibration must be standard or enhanced",
            { resource },
          ),
        );
        return;
      }
      const previous = context.controls.calibration;
      context.controls.calibration = record.value as CalibrationMode;
      acceptSetting(
        context,
        operationId,
        tick,
        actor,
        kind,
        resource,
        previous,
        record.value as string,
      );
      return;
    }
    case "SET_QUALITY_RATE": {
      if (!QUALITY_RATE_VALUES.has(record.valueUnitsPerHour as number)) {
        context.rejected.push(
          rejection(
            operation,
            "OUT_OF_RANGE",
            "Quality rate must be 600, 700, 800, or 900 units/hour",
            { resource },
          ),
        );
        return;
      }
      const previous = context.controls.qualityRateUnitsPerHour;
      context.controls.qualityRateUnitsPerHour =
        record.valueUnitsPerHour as FactoryControls["qualityRateUnitsPerHour"];
      acceptSetting(
        context,
        operationId,
        tick,
        actor,
        kind,
        resource,
        previous,
        record.valueUnitsPerHour as number,
      );
      return;
    }
    case "SET_WAREHOUSE_RATE": {
      if (!WAREHOUSE_RATE_VALUES.has(record.valueUnitsPerHour as number)) {
        context.rejected.push(
          rejection(
            operation,
            "OUT_OF_RANGE",
            "Warehouse rate must be 800, 900, or 1000 units/hour",
            { resource },
          ),
        );
        return;
      }
      const previous = context.controls.warehouseRateUnitsPerHour;
      context.controls.warehouseRateUnitsPerHour =
        record.valueUnitsPerHour as FactoryControls["warehouseRateUnitsPerHour"];
      acceptSetting(
        context,
        operationId,
        tick,
        actor,
        kind,
        resource,
        previous,
        record.valueUnitsPerHour as number,
      );
      return;
    }
    case "SET_SUPPLIER_MODE": {
      if (tick !== 0) {
        context.rejected.push(
          rejection(
            operation,
            "PRE_SHIFT_ONLY",
            "Supplier mode may only be committed at tick 0 before the shift starts",
            { resource },
          ),
        );
        return;
      }
      if (!SUPPLIER_MODE_VALUES.has(record.value as string)) {
        context.rejected.push(
          rejection(
            operation,
            "OUT_OF_RANGE",
            "Supplier mode must be standard or expedite",
            { resource },
          ),
        );
        return;
      }
      const previous = context.controls.supplierMode;
      context.controls.supplierMode = record.value as FactoryControls["supplierMode"];
      acceptSetting(
        context,
        operationId,
        tick,
        actor,
        kind,
        resource,
        previous,
        record.value as string,
      );
    }
  }
}

function defectPropensityBps(controls: FactoryControls): number {
  if (controls.calibration === "enhanced") return BASE_DEFECT_PROPENSITY_BPS;
  return controls.packagingSpeedBps <= 7_500
    ? BASE_DEFECT_PROPENSITY_BPS
    : 240;
}

function mixerCapacityGrams(controls: FactoryControls): number {
  return Math.floor(
    (MIXER_NAMEPLATE_GRAMS_PER_HOUR * TICK_MINUTES * controls.mixerSpeedBps) /
      (60 * 10_000),
  );
}

function packagingCapacityUnits(controls: FactoryControls): number {
  return Math.floor(
    (PACKAGING_NAMEPLATE_UNITS_PER_HOUR *
      TICK_MINUTES *
      controls.packagingSpeedBps) /
      (60 * 10_000),
  );
}

function hourlyRateTickCapacity(rate: number): number {
  return Math.floor((rate * TICK_MINUTES) / 60);
}

/**
 * factory-energy/v1 is intentionally integer-only:
 * - Mixer: 120 kW at 10000 bps, linearly scaled by commanded bps, for each
 *   15-minute tick that processes material.
 * - Packaging: 60 kW at 10000 bps under the same rule, excluding changeover.
 * - Quality Gate: 20 kW at its selected hourly nameplate, proportional to units.
 * - Warehouse: 15 kW at its selected hourly nameplate, proportional to units.
 * Stage watt-minutes are floored per tick. The ledger converts the run total at
 * exactly 250000 micro-EUR/kWh using floor(total * 250000 / 60000).
 */
function addTickEnergy(
  energy: InternalEnergy,
  controls: FactoryControls,
  mixedGrams: number,
  packagedUnits: number,
  inspectedUnits: number,
  warehousedUnits: number,
) {
  if (mixedGrams > 0) {
    energy.mixerWattMinutes += Math.floor(
      (ENERGY_POWER_WATTS.mixerAtFullCommand *
        controls.mixerSpeedBps *
        TICK_MINUTES) /
        10_000,
    );
  }
  if (packagedUnits > 0) {
    energy.packagingWattMinutes += Math.floor(
      (ENERGY_POWER_WATTS.packagingAtFullCommand *
        controls.packagingSpeedBps *
        TICK_MINUTES) /
        10_000,
    );
  }
  if (inspectedUnits > 0) {
    energy.qualityGateWattMinutes += Math.floor(
      (ENERGY_POWER_WATTS.qualityGateAtNameplate * 60 * inspectedUnits) /
        controls.qualityRateUnitsPerHour,
    );
  }
  if (warehousedUnits > 0) {
    energy.warehouseWattMinutes += Math.floor(
      (ENERGY_POWER_WATTS.warehouseAtNameplate * 60 * warehousedUnits) /
        controls.warehouseRateUnitsPerHour,
    );
  }
}

function makeLedgerEntry(
  category: CostCategory,
  basisQuantity: bigint,
  basisUnit: string,
  rateMicroEur: bigint,
  rateUnit: string,
  amountMicroEur: bigint,
  calculation: string,
  rounding: CostLedgerEntry["rounding"] = "EXACT",
): CostLedgerEntry {
  return {
    category,
    basisQuantity: basisQuantity.toString(10),
    basisUnit,
    rateMicroEur: rateMicroEur.toString(10),
    rateUnit,
    amountMicroEur: amountMicroEur.toString(10),
    calculation,
    rounding,
  };
}

function buildCostLedger(
  counters: RawCounters,
  energy: InternalEnergy,
  shiftControls: FactoryControls,
  usedExpedite: boolean,
  usedFifteenMinuteSmed: boolean,
): InternalCostLedger {
  const mixedGrams = BigInt(counters.mixedMaterialGrams);
  const grossUnits = BigInt(counters.grossUnits);
  const inspectedUnits = BigInt(counters.inspectedUnits);
  const badUnits = BigInt(counters.badUnits);
  const energyWattMinutes = BigInt(counters.energyWattMinutes);

  const rawAmount = mixedGrams * COST_RATES.rawMaterialMicroEurPerGram;
  const packagingAmount = grossUnits * COST_RATES.packagingMicroEurPerGrossUnit;
  const inspectionAmount = inspectedUnits * COST_RATES.inspectionMicroEurPerInspectedUnit;
  const scrapAmount = badUnits * COST_RATES.scrapMicroEurPerBadUnit;
  const electricityNumerator =
    energyWattMinutes * COST_RATES.electricityMicroEurPerKwh;
  const electricityAmount = electricityNumerator / 60_000n;
  const electricityRemainderNumerator = electricityNumerator % 60_000n;
  const calibrationAmount =
    shiftControls.calibration === "enhanced"
      ? COST_RATES.enhancedCalibrationMicroEurPerRun
      : 0n;
  const smedAmount =
    usedFifteenMinuteSmed
      ? COST_RATES.fifteenMinuteSmedMicroEurPerRun
      : 0n;
  const expediteAmount = usedExpedite ? COST_RATES.expediteMicroEurPerRun : 0n;

  const entries: CostLedgerEntry[] = [
    makeLedgerEntry(
      "FIXED",
      1n,
      "run",
      COST_RATES.fixedMicroEurPerRun,
      "microEUR/run",
      COST_RATES.fixedMicroEurPerRun,
      "1 * 32000000000",
    ),
    makeLedgerEntry(
      "RAW_MATERIAL",
      mixedGrams,
      "g mixed",
      COST_RATES.rawMaterialMicroEurPerGram,
      "microEUR/g",
      rawAmount,
      `${mixedGrams} * 750`,
    ),
    makeLedgerEntry(
      "PACKAGING",
      grossUnits,
      "gross unit",
      COST_RATES.packagingMicroEurPerGrossUnit,
      "microEUR/gross unit",
      packagingAmount,
      `${grossUnits} * 150000`,
    ),
    makeLedgerEntry(
      "INSPECTION",
      inspectedUnits,
      "inspected unit",
      COST_RATES.inspectionMicroEurPerInspectedUnit,
      "microEUR/inspected unit",
      inspectionAmount,
      `${inspectedUnits} * 80000`,
    ),
    makeLedgerEntry(
      "SCRAP",
      badUnits,
      "bad unit",
      COST_RATES.scrapMicroEurPerBadUnit,
      "microEUR/bad unit",
      scrapAmount,
      `${badUnits} * 250000`,
    ),
    makeLedgerEntry(
      "ELECTRICITY",
      energyWattMinutes,
      "watt-minute",
      COST_RATES.electricityMicroEurPerKwh,
      "microEUR/kWh",
      electricityAmount,
      `floor(${energyWattMinutes} * 250000 / 60000)`,
      "FLOOR_TO_MICRO_EUR",
    ),
    makeLedgerEntry(
      "CALIBRATION",
      shiftControls.calibration === "enhanced" ? 1n : 0n,
      "enhanced run",
      COST_RATES.enhancedCalibrationMicroEurPerRun,
      "microEUR/run",
      calibrationAmount,
      `${shiftControls.calibration === "enhanced" ? 1 : 0} * 350000000`,
    ),
    makeLedgerEntry(
      "SMED",
      usedFifteenMinuteSmed ? 1n : 0n,
      "15-minute run",
      COST_RATES.fifteenMinuteSmedMicroEurPerRun,
      "microEUR/run",
      smedAmount,
      `${usedFifteenMinuteSmed ? 1 : 0} * 250000000`,
    ),
    makeLedgerEntry(
      "EXPEDITE",
      usedExpedite ? 1n : 0n,
      "expedited run",
      COST_RATES.expediteMicroEurPerRun,
      "microEUR/run",
      expediteAmount,
      `${usedExpedite ? 1 : 0} * 2500000000`,
    ),
  ];

  return {
    entries,
    totalMicroEur: entries.reduce(
      (total, entry) => total + BigInt(entry.amountMicroEur),
      0n,
    ),
    electricityRemainderNumerator,
  };
}

function invariant(
  code: string,
  lhs: number,
  operator: "=" | ">=",
  rhs: number,
  evidence: string,
): InvariantCheck {
  return {
    code,
    lhs: String(lhs),
    operator,
    rhs: String(rhs),
    pass: operator === "=" ? lhs === rhs : lhs >= rhs,
    evidence,
  };
}

function buildInvariantChecks(counters: RawCounters): InvariantCheck[] {
  const numericCounters = Object.values(counters);
  return [
    invariant(
      "RAW_MATERIAL_CONSERVATION",
      counters.deliveredMaterialGrams,
      "=",
      counters.endingRawMaterialGrams + counters.mixedMaterialGrams,
      "delivered = ending raw + mixer input",
    ),
    invariant(
      "MIXED_MATERIAL_CONSERVATION",
      counters.mixedMaterialGrams,
      "=",
      counters.endingMixedMaterialGrams + counters.packagedMaterialGrams,
      "mixer input = ending mixed buffer + material packaged",
    ),
    invariant(
      "PACKAGED_UNIT_CONSERVATION",
      counters.grossUnits,
      "=",
      counters.inspectedUnits + counters.endingPackagedQueueUnits,
      "gross packaged = inspected + ending packaged queue",
    ),
    invariant(
      "QUALITY_UNIT_CONSERVATION",
      counters.inspectedUnits,
      "=",
      counters.badUnits + counters.goodUnitsAfterInspection,
      "inspected = bad + good after inspection",
    ),
    invariant(
      "GOOD_UNIT_CONSERVATION",
      counters.goodUnitsAfterInspection,
      "=",
      counters.goodOutputUnits + counters.endingGoodQueueUnits,
      "good after inspection = warehouse output + ending good queue",
    ),
    invariant(
      "ALL_COUNTERS_NONNEGATIVE",
      Math.min(...numericCounters),
      ">=",
      0,
      "minimum raw counter must be nonnegative",
    ),
    {
      code: "ALL_COUNTERS_INTEGER",
      lhs: numericCounters.every(Number.isSafeInteger) ? "1" : "0",
      operator: "=",
      rhs: "1",
      pass: numericCounters.every(Number.isSafeInteger),
      evidence: "all material, unit, and energy counters are safe integers",
    },
  ];
}

function executeSimulation(input: NormalizedInput): InternalRun {
  const controls = cloneControls(input.controls);
  const buffers: MutableBuffers = {
    rawMaterialGrams: 0,
    mixedMaterialGrams: 0,
    packagedUnits: 0,
    goodUnits: 0,
  };
  const counters: MutableCounters = {
    deliveredMaterialGrams: 0,
    mixedMaterialGrams: 0,
    grossUnits: 0,
    inspectedUnits: 0,
    badUnits: 0,
    goodUnitsAfterInspection: 0,
    goodOutputUnits: 0,
  };
  const qualityBatches: QualityBatch[] = [];
  let defectRemainder = 0;
  const acceptedOperations: AcceptedOperation[] = [];
  const rejectedOperations: RejectedOperation[] = [];
  const unattributedRejectedOperationIds: string[] = [];
  const locks: ResourceLock[] = [];
  const locksByResource = new Map<FactoryResource, ResourceLock>();
  const operationsByTick = new Map<number, ScheduledOperation[]>();
  const firstPayloadByOperationId = new Map<string, string>();
  const ticks: TickSnapshot[] = [];
  const energy: InternalEnergy = {
    mixerWattMinutes: 0,
    packagingWattMinutes: 0,
    qualityGateWattMinutes: 0,
    warehouseWattMinutes: 0,
  };
  let packagingLockProofSeed: PackagingLockProofSeed | undefined;
  let shiftControls = cloneControls(controls);
  let usedExpedite = false;
  let usedFifteenMinuteSmed = false;
  let packagingCapacityLimitedTicks = 0;
  let packagingChangeoverTicks = 0;
  let qualityCapacityLimitedTicks = 0;
  let warehouseCapacityLimitedTicks = 0;

  for (const operation of input.operations) {
    const record = operation.record;
    const hasValidTick =
      Number.isSafeInteger(record?.tick) &&
      (record?.tick as number) >= 0 &&
      (record?.tick as number) < TOTAL_TICKS;
    let preflightRejection: RejectedOperation | undefined;

    if (operation.normalizationError) {
      preflightRejection = rejection(
        operation,
        "INVALID_OPERATION",
        `Unsafe operation shape rejected: ${operation.normalizationError}`,
      );
    } else if (
      !record ||
      typeof record.operationId !== "string" ||
      !record.operationId.trim()
    ) {
      preflightRejection = rejection(
        operation,
        "INVALID_OPERATION",
        "operationId must be a non-empty string",
      );
    } else {
      const firstPayload = firstPayloadByOperationId.get(record.operationId);
      if (firstPayload === undefined) {
        firstPayloadByOperationId.set(record.operationId, operation.canonical);
      } else if (firstPayload === operation.canonical) {
        preflightRejection = rejection(
          operation,
          "DUPLICATE_OPERATION",
          `Operation ${record.operationId} is an exact replay; duplicate ignored`,
        );
      } else {
        preflightRejection = rejection(
          operation,
          "OPERATION_ID_REUSED",
          `Operation ID ${record.operationId} was reused with a conflicting payload`,
        );
      }
    }

    if (!preflightRejection && !hasValidTick) {
      preflightRejection = rejection(
        operation,
        "OUT_OF_RANGE",
        `tick must be an integer from 0 through ${TOTAL_TICKS - 1}`,
      );
    }

    if (!hasValidTick) {
      const rejected = preflightRejection as RejectedOperation;
      rejectedOperations.push(rejected);
      unattributedRejectedOperationIds.push(rejected.operationId);
      continue;
    }

    const tick = record?.tick as number;
    const operations = operationsByTick.get(tick) ?? [];
    operations.push({ operation, preflightRejection });
    operationsByTick.set(tick, operations);
  }

  for (let tick = 0; tick < TOTAL_TICKS; tick += 1) {
    const acceptedStart = acceptedOperations.length;
    const rejectedStart = rejectedOperations.length;
    const operationContext: OperationContext = {
      controls,
      locksByResource,
      locks,
      accepted: acceptedOperations,
      rejected: rejectedOperations,
    };

    for (const scheduled of operationsByTick.get(tick) ?? []) {
      if (scheduled.preflightRejection) {
        rejectedOperations.push(scheduled.preflightRejection);
        continue;
      }
      const operation = scheduled.operation;
      const acceptedBefore = acceptedOperations.length;
      applyOperation(operation, tick, operationContext);
      const accepted = acceptedOperations[acceptedOperations.length - 1];
      if (
        !packagingLockProofSeed &&
        acceptedOperations.length > acceptedBefore &&
        accepted?.kind === "LOCK_RESOURCE" &&
        accepted.resource === "Packaging"
      ) {
        packagingLockProofSeed = {
          lockTick: tick,
          packagingSpeedBps: controls.packagingSpeedBps,
          changeoverMinutes: controls.changeoverMinutes,
          calibration: controls.calibration,
          grossUnitsBeforeLock: counters.grossUnits,
          badUnitsBeforeLock: counters.badUnits,
          defectRemainder,
        };
      }
    }

    if (tick === 0) {
      shiftControls = cloneControls(controls);
      usedExpedite = controls.supplierMode === "expedite";
      usedFifteenMinuteSmed = controls.changeoverMinutes === 15;
    }

    const deliveredThisTick = input.deliveries
      .filter((delivery) => delivery.tick === tick)
      .reduce((total, delivery) => total + delivery.grams, 0);
    buffers.rawMaterialGrams += deliveredThisTick;
    counters.deliveredMaterialGrams += deliveredThisTick;

    const mixerCapacity = mixerCapacityGrams(controls);
    const mixedThisTick = Math.min(mixerCapacity, buffers.rawMaterialGrams);
    buffers.rawMaterialGrams -= mixedThisTick;
    buffers.mixedMaterialGrams += mixedThisTick;
    counters.mixedMaterialGrams += mixedThisTick;

    const packagingCapacity = packagingCapacityUnits(controls);
    const changeoverActive = tick * TICK_MINUTES < controls.changeoverMinutes;
    const availableUnitsBeforePackaging = Math.floor(
      buffers.mixedMaterialGrams / UNIT_MASS_GRAMS,
    );
    const packagedThisTick = changeoverActive
      ? 0
      : Math.min(packagingCapacity, availableUnitsBeforePackaging);
    if (changeoverActive) packagingChangeoverTicks += 1;
    if (
      !changeoverActive &&
      packagedThisTick === packagingCapacity &&
      availableUnitsBeforePackaging >= packagingCapacity
    ) {
      packagingCapacityLimitedTicks += 1;
    }
    buffers.mixedMaterialGrams -= packagedThisTick * UNIT_MASS_GRAMS;
    buffers.packagedUnits += packagedThisTick;
    counters.grossUnits += packagedThisTick;
    const packagingDefectPropensityBps = defectPropensityBps(controls);
    if (packagedThisTick > 0) {
      qualityBatches.push({
        units: packagedThisTick,
        defectPropensityBps: packagingDefectPropensityBps,
      });
    }

    const qualityCapacity = hourlyRateTickCapacity(
      controls.qualityRateUnitsPerHour,
    );
    const inspectedThisTick = Math.min(qualityCapacity, buffers.packagedUnits);
    if (
      inspectedThisTick === qualityCapacity &&
      buffers.packagedUnits >= qualityCapacity &&
      qualityCapacity > 0
    ) {
      qualityCapacityLimitedTicks += 1;
    }
    let inspectionRemaining = inspectedThisTick;
    const defectRemainderBefore = defectRemainder;
    let inspectedDefectNumerator = 0;
    const inspectedBatches: Array<{
      units: number;
      defectPropensityBps: number;
    }> = [];
    while (inspectionRemaining > 0) {
      const batch = qualityBatches[0];
      if (!batch) {
        throw new Error("Quality queue invariant violated");
      }
      const inspectedFromBatch = Math.min(inspectionRemaining, batch.units);
      inspectedBatches.push({
        units: inspectedFromBatch,
        defectPropensityBps: batch.defectPropensityBps,
      });
      inspectedDefectNumerator +=
        inspectedFromBatch * batch.defectPropensityBps;
      inspectionRemaining -= inspectedFromBatch;
      batch.units -= inspectedFromBatch;
      if (batch.units === 0) qualityBatches.shift();
    }
    const defectCalculationNumerator =
      defectRemainderBefore + inspectedDefectNumerator;
    const badThisTick = Math.floor(defectCalculationNumerator / 10_000);
    defectRemainder = defectCalculationNumerator % 10_000;
    const goodThisTick = inspectedThisTick - badThisTick;
    buffers.packagedUnits -= inspectedThisTick;
    buffers.goodUnits += goodThisTick;
    counters.inspectedUnits += inspectedThisTick;
    counters.badUnits += badThisTick;
    counters.goodUnitsAfterInspection += goodThisTick;

    const warehouseCapacity = hourlyRateTickCapacity(
      controls.warehouseRateUnitsPerHour,
    );
    const goodOutputThisTick = Math.min(warehouseCapacity, buffers.goodUnits);
    if (
      goodOutputThisTick === warehouseCapacity &&
      buffers.goodUnits >= warehouseCapacity &&
      warehouseCapacity > 0
    ) {
      warehouseCapacityLimitedTicks += 1;
    }
    buffers.goodUnits -= goodOutputThisTick;
    counters.goodOutputUnits += goodOutputThisTick;

    addTickEnergy(
      energy,
      controls,
      mixedThisTick,
      packagedThisTick,
      inspectedThisTick,
      goodOutputThisTick,
    );

    ticks.push({
      tick,
      elapsedMinutes: tick * TICK_MINUTES,
      controls: cloneControls(controls),
      deliveredMaterialGrams: deliveredThisTick,
      acceptedOperationIds: acceptedOperations
        .slice(acceptedStart)
        .map((operation) => operation.operationId),
      rejectedOperationIds: rejectedOperations
        .slice(rejectedStart)
        .map((operation) => operation.operationId),
      mixer: {
        capacity: mixerCapacity,
        processed: mixedThisTick,
        processedGrams: mixedThisTick,
      },
      packaging: {
        capacity: packagingCapacity,
        processed: packagedThisTick,
        grossUnits: packagedThisTick,
        changeoverActive,
        packagingDefectPropensityBps,
      },
      qualityGate: {
        capacity: qualityCapacity,
        processed: inspectedThisTick,
        inspectedUnits: inspectedThisTick,
        badUnits: badThisTick,
        goodUnits: goodThisTick,
        inspectedBatches,
        inspectedDefectNumerator,
        defectRemainderBefore,
        defectCalculationNumerator,
        defectDenominator: 10_000,
        defectRemainderAfter: defectRemainder,
      },
      warehouse: {
        capacity: warehouseCapacity,
        processed: goodOutputThisTick,
        goodOutputUnits: goodOutputThisTick,
      },
      buffers: { ...buffers },
      cumulative: {
        grossUnits: counters.grossUnits,
        inspectedUnits: counters.inspectedUnits,
        badUnits: counters.badUnits,
        goodOutputUnits: counters.goodOutputUnits,
      },
    });
  }

  const totalEnergyWattMinutes =
    energy.mixerWattMinutes +
    energy.packagingWattMinutes +
    energy.qualityGateWattMinutes +
    energy.warehouseWattMinutes;
  const rawCounters: RawCounters = {
    deliveredMaterialGrams: counters.deliveredMaterialGrams,
    mixedMaterialGrams: counters.mixedMaterialGrams,
    packagedMaterialGrams: counters.grossUnits * UNIT_MASS_GRAMS,
    endingRawMaterialGrams: buffers.rawMaterialGrams,
    endingMixedMaterialGrams: buffers.mixedMaterialGrams,
    grossUnits: counters.grossUnits,
    inspectedUnits: counters.inspectedUnits,
    endingPackagedQueueUnits: buffers.packagedUnits,
    badUnits: counters.badUnits,
    goodUnitsAfterInspection: counters.goodUnitsAfterInspection,
    endingGoodQueueUnits: buffers.goodUnits,
    goodOutputUnits: counters.goodOutputUnits,
    energyWattMinutes: totalEnergyWattMinutes,
  };
  const invariantChecks = buildInvariantChecks(rawCounters);
  const bottlenecks: BottleneckEvidence[] = [];
  if (buffers.mixedMaterialGrams >= UNIT_MASS_GRAMS) {
    bottlenecks.push({
      stage: "Packaging",
      reason: locksByResource.has("Packaging")
        ? "HUMAN_LOCKED_RATE_AND_CHANGEOVER"
        : "CHANGEOVER_AND_RATE_LIMIT",
      capacityLimitedTicks: packagingCapacityLimitedTicks,
      blockedTicks: packagingChangeoverTicks,
      endingUpstreamQueue: buffers.mixedMaterialGrams,
      queueUnit: "grams",
    });
  }
  if (buffers.packagedUnits > 0) {
    bottlenecks.push({
      stage: "Quality Gate",
      reason: "INSPECTION_RATE_LIMIT",
      capacityLimitedTicks: qualityCapacityLimitedTicks,
      blockedTicks: 0,
      endingUpstreamQueue: buffers.packagedUnits,
      queueUnit: "units",
    });
  }
  if (buffers.goodUnits > 0) {
    bottlenecks.push({
      stage: "Warehouse",
      reason: "WAREHOUSE_RATE_LIMIT",
      capacityLimitedTicks: warehouseCapacityLimitedTicks,
      blockedTicks: 0,
      endingUpstreamQueue: buffers.goodUnits,
      queueUnit: "units",
    });
  }

  return {
    rawCounters,
    ticks,
    acceptedOperations,
    rejectedOperations,
    unattributedRejectedOperationIds,
    locks,
    packagingLockProofSeed,
    cost: buildCostLedger(
      rawCounters,
      energy,
      shiftControls,
      usedExpedite,
      usedFifteenMinuteSmed,
    ),
    energy,
    bottlenecks,
    invariantChecks,
  };
}

function makeUpperBoundProof(
  seed: PackagingLockProofSeed | undefined,
): UpperBoundProof | undefined {
  if (!seed) return undefined;

  const packagingCapacity = Math.floor(
    (PACKAGING_NAMEPLATE_UNITS_PER_HOUR *
      TICK_MINUTES *
      seed.packagingSpeedBps) /
      (60 * 10_000),
  );
  let remainingActiveTicks = 0;
  for (let tick = seed.lockTick; tick < TOTAL_TICKS; tick += 1) {
    if (tick * TICK_MINUTES >= seed.changeoverMinutes) {
      remainingActiveTicks += 1;
    }
  }
  const maximumAdditionalGrossUnits = remainingActiveTicks * packagingCapacity;
  const grossUnitsUpperBound =
    seed.grossUnitsBeforeLock + maximumAdditionalGrossUnits;
  const committedDefectHorizonUnits = Math.min(
    LOCK_PROOF_DEFECT_HORIZON_UNITS,
    maximumAdditionalGrossUnits,
  );
  const proofControls: FactoryControls = {
    mixerSpeedBps: 5_000,
    packagingSpeedBps: seed.packagingSpeedBps,
    changeoverMinutes: seed.changeoverMinutes as FactoryControls["changeoverMinutes"],
    calibration: seed.calibration,
    qualityRateUnitsPerHour: 600,
    warehouseRateUnitsPerHour: 800,
    supplierMode: "standard",
  };
  const propensityBps = defectPropensityBps(proofControls);
  const minimumAdditionalBadUnits = Math.floor(
    (seed.defectRemainder + committedDefectHorizonUnits * propensityBps) /
      10_000,
  );
  const minimumBadUnitsAtUpperBranch =
    seed.badUnitsBeforeLock + minimumAdditionalBadUnits;
  const lowerBranchGoodOutputUpperBound =
    seed.grossUnitsBeforeLock +
    Math.max(0, committedDefectHorizonUnits - 1) -
    seed.badUnitsBeforeLock;
  const upperBranchGoodOutputUpperBound =
    grossUnitsUpperBound - minimumBadUnitsAtUpperBranch;
  const goodOutputUpperBound = Math.max(
    lowerBranchGoodOutputUpperBound,
    upperBranchGoodOutputUpperBound,
  );

  return {
    proofVersion: "factory-lock-upper-bound/v1",
    method: "PACKAGING_LOCK_CAPACITY_WITH_DEFECT_CASE_SPLIT",
    lockTick: seed.lockTick,
    lockedResource: "Packaging",
    lockedPackagingSpeedBps: seed.packagingSpeedBps,
    grossUnitsBeforeLock: seed.grossUnitsBeforeLock,
    observedBadUnitsBeforeLock: seed.badUnitsBeforeLock,
    remainingTicks: TOTAL_TICKS - seed.lockTick,
    maximumAdditionalGrossUnits,
    grossUnitsUpperBound,
    committedDefectHorizonUnits,
    defectPropensityBps: propensityBps,
    minimumAdditionalBadUnits,
    minimumBadUnitsAtUpperBranch,
    lowerBranchGoodOutputUpperBound,
    goodOutputUpperBound,
    targetGoodOutputUnits: TARGET_GOOD_OUTPUT_UNITS,
    exactInequality: `${goodOutputUpperBound} < ${TARGET_GOOD_OUTPUT_UNITS}`,
    proven: goodOutputUpperBound < TARGET_GOOD_OUTPUT_UNITS,
  };
}

function buildConstraints(
  run: InternalRun,
  baseline: InternalRun,
  assetInventoryUnchanged: boolean,
  assetCountBefore: number,
  assetCountAfter: number,
): ExactConstraint[] {
  const outputLhs = run.rawCounters.goodOutputUnits;
  const costLhs = run.cost.totalMicroEur * 100n;
  const costRhs = baseline.cost.totalMicroEur * 108n;
  const defectLhs =
    BigInt(run.rawCounters.badUnits) * BigInt(baseline.rawCounters.grossUnits);
  const defectRhs =
    BigInt(baseline.rawCounters.badUnits) * BigInt(run.rawCounters.grossUnits);

  return [
    {
      code: "OUTPUT_20",
      lhs: String(outputLhs),
      operator: ">=",
      rhs: String(TARGET_GOOD_OUTPUT_UNITS),
      unit: "good output units",
      pass: outputLhs >= TARGET_GOOD_OUTPUT_UNITS,
      exactEvidence: {
        baselineGoodOutputUnits: String(baseline.rawCounters.goodOutputUnits),
        targetFormula: "ceil(baselineGoodOutputUnits * 120 / 100)",
        targetGoodOutputUnits: String(TARGET_GOOD_OUTPUT_UNITS),
      },
    },
    {
      code: "COST_8",
      lhs: costLhs.toString(10),
      operator: "<=",
      rhs: costRhs.toString(10),
      unit: "microEUR times percentage denominator",
      pass: costLhs <= costRhs,
      exactEvidence: {
        comparison: "scenarioTotalMicroEur * 100 <= baselineTotalMicroEur * 108",
        scenarioTotalMicroEur: run.cost.totalMicroEur.toString(10),
        baselineTotalMicroEur: baseline.cost.totalMicroEur.toString(10),
        scenarioMultiplier: "100",
        baselineCapMultiplier: "108",
      },
    },
    {
      code: "DEFECT_NO_INCREASE",
      lhs: defectLhs.toString(10),
      operator: "<=",
      rhs: defectRhs.toString(10),
      unit: "cross-multiplied bad/gross units",
      pass: defectLhs <= defectRhs,
      exactEvidence: {
        comparison: "scenarioBad * baselineGross <= baselineBad * scenarioGross",
        scenarioBadUnits: String(run.rawCounters.badUnits),
        scenarioGrossUnits: String(run.rawCounters.grossUnits),
        baselineBadUnits: String(baseline.rawCounters.badUnits),
        baselineGrossUnits: String(baseline.rawCounters.grossUnits),
      },
    },
    {
      code: "NO_NEW_MACHINE",
      lhs: String(assetCountAfter),
      operator: "=",
      rhs: String(assetCountBefore),
      unit: "assets",
      pass: assetInventoryUnchanged && assetCountAfter === assetCountBefore,
      exactEvidence: {
        beforeAssetCount: String(assetCountBefore),
        afterAssetCount: String(assetCountAfter),
        inventoryCanonicalMatch: String(assetInventoryUnchanged),
        supportedAssetMutationOperations: "0",
      },
    },
  ];
}

function buildEnergyBreakdown(run: InternalRun): EnergyBreakdown {
  return {
    modelVersion: ENERGY_MODEL_VERSION,
    mixerWattMinutes: run.energy.mixerWattMinutes,
    packagingWattMinutes: run.energy.packagingWattMinutes,
    qualityGateWattMinutes: run.energy.qualityGateWattMinutes,
    warehouseWattMinutes: run.energy.warehouseWattMinutes,
    totalWattMinutes: run.rawCounters.energyWattMinutes,
    electricityRateMicroEurPerKwh:
      COST_RATES.electricityMicroEurPerKwh.toString(10),
    electricityCostRemainderNumerator:
      run.cost.electricityRemainderNumerator.toString(10),
  };
}

function buildBaselineComparison(
  run: InternalRun,
  baseline: InternalRun,
): BaselineComparison {
  const gain =
    run.rawCounters.goodOutputUnits - baseline.rawCounters.goodOutputUnits;
  return {
    baselineGrossUnits: baseline.rawCounters.grossUnits,
    baselineBadUnits: baseline.rawCounters.badUnits,
    baselineDefectPropensityBps: BASE_DEFECT_PROPENSITY_BPS,
    baselineGoodOutputUnits: baseline.rawCounters.goodOutputUnits,
    targetGoodOutputUnits: TARGET_GOOD_OUTPUT_UNITS,
    outputGainNumerator: gain,
    outputGainDenominator: baseline.rawCounters.goodOutputUnits,
    outputGainBasisPointsFloor: Math.floor(
      (gain * 10_000) / baseline.rawCounters.goodOutputUnits,
    ),
    baselineTotalCostMicroEur: baseline.cost.totalMicroEur.toString(10),
  };
}

function assertBaselineAcceptance(baseline: InternalRun) {
  if (
    baseline.rawCounters.grossUnits !== BASELINE_GROSS_UNITS ||
    baseline.rawCounters.badUnits !== BASELINE_BAD_UNITS ||
    baseline.rawCounters.goodOutputUnits !== BASELINE_GOOD_OUTPUT_UNITS ||
    Math.ceil((baseline.rawCounters.goodOutputUnits * 120) / 100) !==
      TARGET_GOOD_OUTPUT_UNITS
  ) {
    throw new Error("Engine constants no longer reproduce the baseline acceptance case");
  }
}

export async function simulateFactory(
  input: FactorySimulationInput,
): Promise<SimulationReceipt> {
  const normalized = normalizeInput(input);
  const normalizedBaseline = normalizeInput(createBaselineInput());
  const run = executeSimulation(normalized);
  const baseline = executeSimulation(normalizedBaseline);
  assertBaselineAcceptance(baseline);

  const assetInventoryBefore = cloneAssets();
  const assetInventoryAfter = cloneAssets();
  const assetInventoryUnchanged =
    canonicalStableStringify(assetInventoryBefore) ===
    canonicalStableStringify(assetInventoryAfter);
  const constraints = buildConstraints(
    run,
    baseline,
    assetInventoryUnchanged,
    assetInventoryBefore.length,
    assetInventoryAfter.length,
  );
  const upperBoundProof = makeUpperBoundProof(run.packagingLockProofSeed);
  const invariantsPass = run.invariantChecks.every((check) => check.pass);
  const fatalRejections = run.rejectedOperations.filter(
    (operation) => operation.fatal,
  );
  const dedicatedLockProof =
    upperBoundProof?.proven === true &&
    run.locks.some((lock) => lock.resource === "Packaging") &&
    fatalRejections.every(
      (operation) =>
        operation.reason === "LOCKED_RESOURCE" ||
        operation.reason === "PRE_SHIFT_ONLY",
    );
  const operationAudit = {
    fatalRejectionCount: fatalRejections.length,
    benignDuplicateReplayCount: run.rejectedOperations.filter(
      (operation) => operation.reason === "DUPLICATE_OPERATION",
    ).length,
    unattributedRejectedOperationIds: run.unattributedRejectedOperationIds,
    tickAttributionPolicy:
      "VALID_TICK_REJECTIONS_ON_TICK_INVALID_TICKS_UNATTRIBUTED" as const,
  };
  let feasibilityStatus: FeasibilityStatus;
  if (!invariantsPass) {
    feasibilityStatus = "INVALID_INVARIANTS";
  } else if (dedicatedLockProof) {
    feasibilityStatus = "PROVEN_INFEASIBLE_UNDER_LOCKS";
  } else if (fatalRejections.length > 0) {
    feasibilityStatus = "INVALID_OPERATIONS";
  } else if (constraints.every((constraint) => constraint.pass)) {
    feasibilityStatus = "FEASIBLE";
  } else {
    feasibilityStatus = "NOT_FEASIBLE";
  }

  const inputHash = await sha256Hex(
    canonicalStableStringify(normalized.snapshot),
  );
  const receiptDraft = {
    receiptVersion: RECEIPT_VERSION,
    engineVersion: ENGINE_VERSION,
    energyModelVersion: ENERGY_MODEL_VERSION,
    hashAlgorithm: "SHA-256" as const,
    hashScope: "canonical-receipt-without-runId-and-contentHash" as const,
    inputHash,
    inputSnapshot: normalized.snapshot,
    tickMinutes: TICK_MINUTES,
    totalTicks: TOTAL_TICKS,
    unitMassGrams: UNIT_MASS_GRAMS,
    rawCounters: run.rawCounters,
    ticks: run.ticks,
    costLedger: run.cost.entries,
    totalCostMicroEur: run.cost.totalMicroEur.toString(10),
    energy: buildEnergyBreakdown(run),
    baselineComparison: buildBaselineComparison(run, baseline),
    bottlenecks: run.bottlenecks,
    acceptedOperations: run.acceptedOperations,
    rejectedOperations: run.rejectedOperations,
    operationAudit,
    locks: run.locks,
    constraints,
    feasibilityStatus,
    ...(upperBoundProof ? { upperBoundProof } : {}),
    invariantChecks: run.invariantChecks,
    assetInventoryBefore,
    assetInventoryAfter,
    assetInventoryUnchanged,
  };
  const contentHash = await sha256Hex(canonicalStableStringify(receiptDraft));

  return {
    ...receiptDraft,
    runId: `factory-run-${contentHash}`,
    contentHash,
  };
}

export function formatMicroEur(microEur: string): string {
  const amount = BigInt(microEur);
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const euros = absolute / 1_000_000n;
  const cents = (absolute % 1_000_000n) / 10_000n;
  return `${sign}${euros.toString(10)}.${cents.toString(10).padStart(2, "0")} EUR`;
}

export function formatOutputGainPercent(comparison: BaselineComparison): string {
  const scaledThousandths = Math.round(
    (comparison.outputGainNumerator * 100_000) /
      comparison.outputGainDenominator,
  );
  return `${(scaledThousandths / 1_000).toFixed(3)}%`;
}
