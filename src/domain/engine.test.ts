import { describe, expect, it } from "vitest";
import {
  BASELINE_INPUT,
  BASELINE_BAD_UNITS,
  BASELINE_GOOD_OUTPUT_UNITS,
  BASELINE_GROSS_UNITS,
  ENERGY_MODEL_VERSION,
  FactoryValidationError,
  TARGET_GOOD_OUTPUT_UNITS,
  canonicalStableStringify,
  createBaselineInput,
  createInvalidCostScenarioInput,
  createLockedScenarioInput,
  createValidScenarioInput,
  formatOutputGainPercent,
  sha256Hex,
  simulateFactory,
  type ExactConstraint,
  type FactorySimulationInput,
} from "./index";

function constraint(
  constraints: readonly ExactConstraint[],
  code: ExactConstraint["code"],
) {
  const found = constraints.find((candidate) => candidate.code === code);
  expect(found, `missing ${code} constraint`).toBeDefined();
  return found as ExactConstraint;
}

describe("deterministic factory acceptance fixtures", () => {
  it("reproduces the exact baseline acceptance counters", async () => {
    const [receipt, frozenFixtureReceipt] = await Promise.all([
      simulateFactory(createBaselineInput()),
      simulateFactory(BASELINE_INPUT),
    ]);

    expect(receipt.receiptVersion).toBe("factory-receipt/v1");
    expect(receipt.energyModelVersion).toBe(ENERGY_MODEL_VERSION);
    expect(receipt.ticks).toHaveLength(64);
    expect(receipt.rawCounters.grossUnits).toBe(BASELINE_GROSS_UNITS);
    expect(receipt.rawCounters.badUnits).toBe(BASELINE_BAD_UNITS);
    expect(receipt.rawCounters.goodOutputUnits).toBe(
      BASELINE_GOOD_OUTPUT_UNITS,
    );
    expect(receipt.baselineComparison.baselineDefectPropensityBps).toBe(200);
    expect(receipt.baselineComparison.targetGoodOutputUnits).toBe(
      TARGET_GOOD_OUTPUT_UNITS,
    );
    expect(receipt.ticks[0]?.packaging.changeoverActive).toBe(true);
    expect(receipt.ticks[1]?.packaging.changeoverActive).toBe(true);
    expect(receipt.ticks[2]?.packaging.grossUnits).toBe(150);
    expect(receipt.bottlenecks[0]?.stage).toBe("Packaging");
    expect(receipt.assetInventoryUnchanged).toBe(true);
    expect(receipt.constraints).toHaveLength(4);
    expect(receipt.costLedger).toHaveLength(9);
    expect(receipt.totalCostMicroEur).toBe("43275975000");
    expect(receipt.energy.totalWattMinutes).toBe(165_714_000);
    expect(frozenFixtureReceipt.contentHash).toBe(receipt.contentHash);
    expect(() => JSON.stringify(receipt)).not.toThrow();
    expect(
      receipt.costLedger.every(
        (entry) =>
          typeof entry.basisQuantity === "string" &&
          typeof entry.rateMicroEur === "string" &&
          typeof entry.amountMicroEur === "string",
      ),
    ).toBe(true);
  });

  it("reproduces the exact valid scenario and all four constraints pass", async () => {
    const receipt = await simulateFactory(createValidScenarioInput());

    expect(receipt.rawCounters.grossUnits).toBe(11_340);
    expect(receipt.rawCounters.badUnits).toBe(226);
    expect(receipt.rawCounters.goodOutputUnits).toBe(11_114);
    expect(receipt.baselineComparison.outputGainNumerator).toBe(2_000);
    expect(receipt.baselineComparison.outputGainDenominator).toBe(9_114);
    expect(formatOutputGainPercent(receipt.baselineComparison)).toBe("21.944%");
    expect(receipt.acceptedOperations).toHaveLength(4);
    expect(receipt.rejectedOperations).toHaveLength(0);
    expect(receipt.constraints.map((item) => item.pass)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(receipt.feasibilityStatus).toBe("FEASIBLE");
    expect(receipt.totalCostMicroEur).toBe("45170508333");
    expect(receipt.energy.totalWattMinutes).toBe(188_594_000);
  });

  it("charges expedite without changing output and fails the exact cost cap", async () => {
    const [valid, invalid] = await Promise.all([
      simulateFactory(createValidScenarioInput()),
      simulateFactory(createInvalidCostScenarioInput()),
    ]);

    expect(invalid.rawCounters).toEqual(valid.rawCounters);
    expect(invalid.rawCounters.grossUnits).toBe(11_340);
    expect(invalid.rawCounters.badUnits).toBe(226);
    expect(invalid.rawCounters.goodOutputUnits).toBe(11_114);
    expect(BigInt(invalid.totalCostMicroEur) - BigInt(valid.totalCostMicroEur)).toBe(
      2_500_000_000n,
    );
    expect(constraint(valid.constraints, "COST_8").pass).toBe(true);
    expect(constraint(invalid.constraints, "COST_8").pass).toBe(false);
    expect(invalid.feasibilityStatus).toBe("NOT_FEASIBLE");
    expect(invalid.totalCostMicroEur).toBe("47670508333");
    expect(
      invalid.costLedger.find((entry) => entry.category === "EXPEDITE")
        ?.amountMicroEur,
    ).toBe("2500000000");
  });

  it("proves the required locked-resource upper bound", async () => {
    const receipt = await simulateFactory(createLockedScenarioInput());

    expect(receipt.rawCounters.grossUnits).toBe(9_300);
    expect(receipt.rawCounters.badUnits).toBe(186);
    expect(receipt.rawCounters.goodOutputUnits).toBe(9_114);
    expect(receipt.upperBoundProof).toMatchObject({
      lockTick: 16,
      lockedResource: "Packaging",
      lockedPackagingSpeedBps: 7_500,
      grossUnitsBeforeLock: 2_100,
      observedBadUnitsBeforeLock: 42,
      remainingTicks: 48,
      maximumAdditionalGrossUnits: 7_200,
      grossUnitsUpperBound: 9_300,
      committedDefectHorizonUnits: 300,
      minimumAdditionalBadUnits: 6,
      minimumBadUnitsAtUpperBranch: 48,
      goodOutputUpperBound: 9_252,
      targetGoodOutputUnits: 10_937,
      exactInequality: "9252 < 10937",
      proven: true,
    });
    expect(receipt.feasibilityStatus).toBe(
      "PROVEN_INFEASIBLE_UNDER_LOCKS",
    );
    expect(receipt.operationAudit.fatalRejectionCount).toBe(4);
    expect(receipt.totalCostMicroEur).toBe("43842975000");
  });
});

describe("canonical hashes and exact arithmetic", () => {
  it("uses actual SHA-256 and decimal-string bigint canonicalization", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(canonicalStableStringify({ z: 2n, a: 1 })).toBe(
      '{"a":1,"z":"2"}',
    );
  });

  it("canonicalizes sparse arrays as explicit JSON null entries", () => {
    const oneHole = new Array(1);
    const twoHoles = new Array(2);
    const nested = new Array(2);
    nested[1] = new Array(2);

    expect(canonicalStableStringify([])).toBe("[]");
    expect(canonicalStableStringify(oneHole)).toBe("[null]");
    expect(canonicalStableStringify(twoHoles)).toBe("[null,null]");
    expect(canonicalStableStringify(nested)).toBe(
      "[null,[null,null]]",
    );
    expect(canonicalStableStringify([])).not.toBe(
      canonicalStableStringify(oneHole),
    );
  });

  it("returns byte-identical canonical receipts and hashes for identical normalized input", async () => {
    const leftInput = createValidScenarioInput();
    const rightInput = createValidScenarioInput();
    rightInput.operations = [...rightInput.operations].reverse();

    const [left, right] = await Promise.all([
      simulateFactory(leftInput),
      simulateFactory(rightInput),
    ]);

    expect(left.inputHash).toBe(right.inputHash);
    expect(left.contentHash).toBe(right.contentHash);
    expect(left.runId).toBe(right.runId);
    expect(canonicalStableStringify(left)).toBe(
      canonicalStableStringify(right),
    );
    expect(left.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(left.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await sha256Hex(canonicalStableStringify(left.inputSnapshot)),
    ).toBe(left.inputHash);
    const { runId, contentHash, ...contentHashScope } = left;
    expect(await sha256Hex(canonicalStableStringify(contentHashScope))).toBe(
      contentHash,
    );
    expect(runId).toBe(`factory-run-${contentHash}`);
  });

  it("decides defect and cost constraints only by exact cross multiplication", async () => {
    const [valid, invalid] = await Promise.all([
      simulateFactory(createValidScenarioInput()),
      simulateFactory(createInvalidCostScenarioInput()),
    ]);
    const defect = constraint(valid.constraints, "DEFECT_NO_INCREASE");
    const validCost = constraint(valid.constraints, "COST_8");
    const invalidCost = constraint(invalid.constraints, "COST_8");

    expect(BigInt(defect.lhs)).toBe(226n * 9_300n);
    expect(BigInt(defect.rhs)).toBe(186n * 11_340n);
    expect(defect.pass).toBe(BigInt(defect.lhs) <= BigInt(defect.rhs));
    expect(validCost.pass).toBe(
      BigInt(validCost.lhs) <= BigInt(validCost.rhs),
    );
    expect(invalidCost.pass).toBe(
      BigInt(invalidCost.lhs) <= BigInt(invalidCost.rhs),
    );
    expect(validCost.exactEvidence.comparison).toContain("* 100 <=");
  });

  it("documents and applies the versioned integer energy formula", async () => {
    const receipt = await simulateFactory(createBaselineInput());
    const electricity = receipt.costLedger.find(
      (entry) => entry.category === "ELECTRICITY",
    );

    expect(receipt.energy.modelVersion).toBe("factory-energy/v1");
    expect(receipt.energy.totalWattMinutes).toBe(
      receipt.rawCounters.energyWattMinutes,
    );
    expect(electricity?.calculation).toBe(
      `floor(${receipt.energy.totalWattMinutes} * 250000 / 60000)`,
    );
    expect(BigInt(electricity?.amountMicroEur ?? "-1")).toBe(
      (BigInt(receipt.energy.totalWattMinutes) * 250_000n) / 60_000n,
    );
  });
});

describe("invariants, idempotency, locks, and validation", () => {
  it("leaves every conservation and nonnegative invariant true", async () => {
    for (const input of [
      createBaselineInput(),
      createValidScenarioInput(),
      createInvalidCostScenarioInput(),
      createLockedScenarioInput(),
    ]) {
      const receipt = await simulateFactory(input);
      expect(receipt.invariantChecks.every((check) => check.pass)).toBe(true);
      for (const value of Object.values(receipt.rawCounters)) {
        expect(Number.isSafeInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("ignores duplicate operation IDs without applying the change twice", async () => {
    const singleInput = createValidScenarioInput();
    const duplicateInput = createValidScenarioInput();
    duplicateInput.operations = [
      ...duplicateInput.operations,
      { ...duplicateInput.operations[0]! },
    ];

    const [single, duplicate] = await Promise.all([
      simulateFactory(singleInput),
      simulateFactory(duplicateInput),
    ]);

    expect(duplicate.rawCounters).toEqual(single.rawCounters);
    expect(
      duplicate.rejectedOperations.filter(
        (operation) => operation.reason === "DUPLICATE_OPERATION",
      ),
    ).toHaveLength(1);
    expect(
      duplicate.rejectedOperations.find(
        (operation) => operation.reason === "DUPLICATE_OPERATION",
      )?.fatal,
    ).toBe(false);
    expect(
      duplicate.acceptedOperations.filter(
        (operation) => operation.operationId === "valid-mixer-9500",
      ),
    ).toHaveLength(1);
    expect(duplicate.ticks[0]?.rejectedOperationIds).toContain(
      "valid-mixer-9500",
    );
    expect(duplicate.operationAudit).toMatchObject({
      fatalRejectionCount: 0,
      benignDuplicateReplayCount: 1,
      unattributedRejectedOperationIds: [],
    });
    expect(duplicate.feasibilityStatus).toBe("FEASIBLE");
  });

  it("keeps the first normalized payload and fails closed on conflicting ID reuse", async () => {
    const input = createValidScenarioInput();
    input.operations = [
      ...input.operations,
      {
        operationId: "valid-mixer-9500",
        tick: 0,
        actor: "model",
        kind: "SET_MIXER_SPEED",
        valueBps: 5_000,
      },
    ];

    const receipt = await simulateFactory(input);
    const reused = receipt.rejectedOperations.find(
      (operation) => operation.reason === "OPERATION_ID_REUSED",
    );

    expect(receipt.ticks[0]?.controls.mixerSpeedBps).toBe(9_500);
    expect(receipt.rawCounters.goodOutputUnits).toBe(11_114);
    expect(receipt.constraints.every((item) => item.pass)).toBe(true);
    expect(
      receipt.acceptedOperations.filter(
        (operation) => operation.operationId === "valid-mixer-9500",
      ),
    ).toHaveLength(1);
    expect(reused).toMatchObject({
      operationId: "valid-mixer-9500",
      reason: "OPERATION_ID_REUSED",
      fatal: true,
    });
    expect(receipt.ticks[0]?.rejectedOperationIds).toContain(
      "valid-mixer-9500",
    );
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("gives a same-tick human lock priority and rejects later operations", async () => {
    const receipt = await simulateFactory(createLockedScenarioInput());
    const packagingRejections = receipt.rejectedOperations.filter(
      (operation) => operation.resource === "Packaging",
    );

    expect(receipt.locks).toEqual([
      expect.objectContaining({
        resource: "Packaging",
        effectiveTick: 16,
        operationId: "lock-packaging-t16",
      }),
    ]);
    expect(packagingRejections.map((operation) => operation.operationId)).toEqual([
      "locked-changeover-15",
      "locked-same-tick-packaging-9000",
      "locked-retry-packaging-9500",
    ]);
    expect(packagingRejections.every((operation) => operation.reason === "LOCKED_RESOURCE")).toBe(
      true,
    );
    expect(
      receipt.rejectedOperations.find(
        (operation) => operation.operationId === "locked-late-calibration",
      )?.reason,
    ).toBe("PRE_SHIFT_ONLY");
  });

  it("rejects out-of-range settings and post-shift calibration", async () => {
    const input = createBaselineInput();
    input.operations = [
      {
        operationId: "bad-speed",
        tick: 0,
        actor: "model",
        kind: "SET_MIXER_SPEED",
        valueBps: 10_001,
      },
      {
        operationId: "late-calibration",
        tick: 1,
        actor: "model",
        kind: "SET_CALIBRATION",
        value: "enhanced",
      },
    ];
    const receipt = await simulateFactory(input);

    expect(receipt.rejectedOperations.map((operation) => operation.reason)).toEqual([
      "OUT_OF_RANGE",
      "PRE_SHIFT_ONLY",
    ]);
    expect(receipt.rawCounters.grossUnits).toBe(BASELINE_GROSS_UNITS);
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
    expect(receipt.operationAudit.fatalRejectionCount).toBe(2);
  });

  it("rejects late changeover as pre-shift-only without changing output or fees", async () => {
    const input = createBaselineInput();
    input.operations = [
      {
        operationId: "late-changeover",
        tick: 16,
        actor: "model",
        kind: "SET_CHANGEOVER_MINUTES",
        valueMinutes: 15,
      },
    ];

    const receipt = await simulateFactory(input);
    const smed = receipt.costLedger.find((entry) => entry.category === "SMED");

    expect(receipt.rejectedOperations).toEqual([
      expect.objectContaining({
        operationId: "late-changeover",
        reason: "PRE_SHIFT_ONLY",
        fatal: true,
      }),
    ]);
    expect(receipt.ticks[16]?.rejectedOperationIds).toEqual([
      "late-changeover",
    ]);
    expect(receipt.rawCounters.grossUnits).toBe(9_300);
    expect(smed?.amountMicroEur).toBe("0");
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("attributes valid-tick rejections and separately audits invalid ticks", async () => {
    const input = createValidScenarioInput() as unknown as {
      operations: unknown[];
    };
    const exactReplay = { ...(input.operations[0] as Record<string, unknown>) };
    input.operations = [
      ...input.operations,
      exactReplay,
      {
        operationId: "invalid-actor",
        tick: 5,
        actor: "service",
        kind: "SET_MIXER_SPEED",
        valueBps: 9_500,
      },
      {
        operationId: "invalid-tick",
        tick: 64,
        actor: "model",
        kind: "SET_MIXER_SPEED",
        valueBps: 9_500,
      },
    ];

    const receipt = await simulateFactory(
      input as unknown as FactorySimulationInput,
    );

    expect(receipt.ticks[0]?.rejectedOperationIds).toContain(
      "valid-mixer-9500",
    );
    expect(receipt.ticks[5]?.rejectedOperationIds).toEqual(["invalid-actor"]);
    expect(
      receipt.ticks.flatMap((tick) => tick.rejectedOperationIds),
    ).not.toContain("invalid-tick");
    expect(receipt.operationAudit).toEqual({
      fatalRejectionCount: 2,
      benignDuplicateReplayCount: 1,
      unattributedRejectedOperationIds: ["invalid-tick"],
      tickAttributionPolicy:
        "VALID_TICK_REJECTIONS_ON_TICK_INVALID_TICKS_UNATTRIBUTED",
    });
    expect(
      receipt.rejectedOperations.find(
        (operation) => operation.operationId === "invalid-tick",
      ),
    ).toMatchObject({ reason: "OUT_OF_RANGE", fatal: true });
    expect(receipt.constraints.every((item) => item.pass)).toBe(true);
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("fails closed on invalid initial controls", async () => {
    const input = createBaselineInput();
    input.controls.mixerSpeedBps = 4_999;

    await expect(simulateFactory(input)).rejects.toBeInstanceOf(
      FactoryValidationError,
    );
  });

  it("has no ADD_MACHINE operation and rejects it without changing inventory", async () => {
    const input = createValidScenarioInput() as unknown as {
      operations: unknown[];
    };
    input.operations = [
      ...input.operations,
      {
        operationId: "attempt-add-machine",
        tick: 0,
        actor: "model",
        kind: "ADD_MACHINE",
        resource: "Packaging",
      },
    ];

    const receipt = await simulateFactory(
      input as unknown as FactorySimulationInput,
    );
    const noNewMachine = constraint(receipt.constraints, "NO_NEW_MACHINE");

    expect(receipt.rejectedOperations).toEqual([
      expect.objectContaining({
        operationId: "attempt-add-machine",
        kind: "ADD_MACHINE",
        reason: "UNKNOWN_OPERATION",
        fatal: true,
      }),
    ]);
    expect(receipt.assetInventoryAfter).toEqual(receipt.assetInventoryBefore);
    expect(receipt.assetInventoryUnchanged).toBe(true);
    expect(noNewMachine.pass).toBe(true);
    expect(receipt.constraints.every((item) => item.pass)).toBe(true);
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("rejects inherited operation semantics without reading inherited getters", async () => {
    let inheritedGetterCalls = 0;
    const prototype = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(prototype, "valueBps", {
      enumerable: true,
      get() {
        inheritedGetterCalls += 1;
        return 9_500;
      },
    });
    Object.assign(prototype, {
      operationId: "inherited-operation",
      tick: 0,
      actor: "model",
      kind: "SET_MIXER_SPEED",
    });
    const inheritedOperation = Object.create(prototype);
    const input = createBaselineInput() as unknown as {
      operations: unknown[];
    };
    input.operations = [inheritedOperation];

    const [receipt, baseline] = await Promise.all([
      simulateFactory(input as unknown as FactorySimulationInput),
      simulateFactory(createBaselineInput()),
    ]);

    expect(inheritedGetterCalls).toBe(0);
    expect(receipt.inputSnapshot.operations).toEqual([null]);
    expect(receipt.inputSnapshot.operationNormalization).toEqual([
      {
        status: "REJECTED_UNSAFE_SHAPE",
        error: "$operation must use Object.prototype or null",
      },
    ]);
    expect(receipt.inputHash).not.toBe(baseline.inputHash);
    expect(
      await sha256Hex(canonicalStableStringify(receipt.inputSnapshot)),
    ).toBe(receipt.inputHash);
    expect(receipt.rawCounters).toEqual(baseline.rawCounters);
    expect(receipt.acceptedOperations).toHaveLength(0);
    expect(receipt.rejectedOperations).toEqual([
      expect.objectContaining({
        reason: "INVALID_OPERATION",
        fatal: true,
      }),
    ]);
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("rejects own accessors without invoking the getter", async () => {
    let getterCalls = 0;
    const getterOperation: Record<string, unknown> = {
      operationId: "getter-operation",
      tick: 0,
      actor: "model",
      kind: "SET_MIXER_SPEED",
    };
    Object.defineProperty(getterOperation, "valueBps", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 9_500;
      },
    });
    const input = createBaselineInput() as unknown as {
      operations: unknown[];
    };
    input.operations = [getterOperation];

    const receipt = await simulateFactory(
      input as unknown as FactorySimulationInput,
    );

    expect(getterCalls).toBe(0);
    expect(receipt.inputSnapshot.operations).toEqual([null]);
    expect(receipt.inputSnapshot.operationNormalization).toEqual([
      {
        status: "REJECTED_UNSAFE_SHAPE",
        error:
          '$operation."valueBps" must be an enumerable data property',
      },
    ]);
    expect(receipt.rawCounters.grossUnits).toBe(BASELINE_GROSS_UNITS);
    expect(receipt.acceptedOperations).toHaveLength(0);
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("executes only the immutable descriptor snapshot of a Proxy operation", async () => {
    let propertyGetCalls = 0;
    const target = {
      operationId: "proxy-operation",
      tick: 0,
      actor: "model",
      kind: "SET_MIXER_SPEED",
      valueBps: 9_500,
    };
    const proxy = new Proxy(target, {
      get(object, property, receiver) {
        propertyGetCalls += 1;
        if (property === "valueBps") return 5_000;
        return Reflect.get(object, property, receiver);
      },
    });
    const input = createBaselineInput() as unknown as {
      operations: unknown[];
    };
    input.operations = [proxy];

    const receipt = await simulateFactory(
      input as unknown as FactorySimulationInput,
    );
    const normalizedOperation = (
      receipt.inputSnapshot.operations as unknown[]
    )[0] as Record<string, unknown>;

    expect(propertyGetCalls).toBe(0);
    expect(Object.isFrozen(normalizedOperation)).toBe(true);
    expect(normalizedOperation.valueBps).toBe(9_500);
    expect(receipt.ticks[0]?.controls.mixerSpeedBps).toBe(9_500);
    expect(receipt.acceptedOperations).toEqual([
      expect.objectContaining({
        operationId: "proxy-operation",
        appliedValue: { previousValue: 8_750, nextValue: 9_500 },
      }),
    ]);
    expect(receipt.rejectedOperations).toHaveLength(0);
  });

  it("fails closed on symbol and non-enumerable operation properties", async () => {
    const withSymbol = {
      operationId: "symbol-operation",
      tick: 0,
      actor: "model",
      kind: "SET_MIXER_SPEED",
      valueBps: 9_500,
      [Symbol("hidden")]: true,
    };
    const withNonEnumerable: Record<string, unknown> = {
      operationId: "non-enumerable-operation",
      tick: 0,
      actor: "model",
      kind: "SET_MIXER_SPEED",
      valueBps: 9_500,
    };
    Object.defineProperty(withNonEnumerable, "hidden", {
      value: true,
      enumerable: false,
    });

    for (const operation of [withSymbol, withNonEnumerable]) {
      const input = createBaselineInput() as unknown as {
        operations: unknown[];
      };
      input.operations = [operation];
      const receipt = await simulateFactory(
        input as unknown as FactorySimulationInput,
      );

      expect(receipt.inputSnapshot.operations).toEqual([null]);
      expect(receipt.rejectedOperations).toEqual([
        expect.objectContaining({
          reason: "INVALID_OPERATION",
          fatal: true,
        }),
      ]);
      expect(receipt.rawCounters.grossUnits).toBe(BASELINE_GROSS_UNITS);
      expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
    }
  });
});

describe("FIFO defect evidence", () => {
  it("separates packaging propensity from the exact inspected lot numerator", async () => {
    const input = createBaselineInput();
    input.controls.packagingSpeedBps = 9_000;
    input.controls.changeoverMinutes = 15;
    input.controls.qualityRateUnitsPerHour = 600;
    input.operations = [
      {
        operationId: "slow-packaging-after-backlog",
        tick: 2,
        actor: "model",
        kind: "SET_PACKAGING_SPEED",
        valueBps: 7_500,
      },
    ];

    const receipt = await simulateFactory(input);
    const tick = receipt.ticks[2]!;

    expect(tick.packaging.packagingDefectPropensityBps).toBe(200);
    expect(tick.qualityGate.inspectedBatches).toEqual([
      { units: 30, defectPropensityBps: 240 },
      { units: 120, defectPropensityBps: 200 },
    ]);
    expect(tick.qualityGate.inspectedDefectNumerator).toBe(31_200);
    expect(tick.qualityGate.defectRemainderBefore).toBe(6_000);
    expect(tick.qualityGate.defectCalculationNumerator).toBe(37_200);
    expect(tick.qualityGate.defectDenominator).toBe(10_000);
    expect(tick.qualityGate.badUnits).toBe(3);
    expect(tick.qualityGate.defectRemainderAfter).toBe(7_200);
    expect("defectPropensityBps" in tick.qualityGate).toBe(false);
  });
});

describe("tick-zero shift fee commitment", () => {
  it("does not charge an initial expedite mode changed to standard at tick zero", async () => {
    const input = createBaselineInput();
    input.controls.supplierMode = "expedite";
    input.operations = [
      {
        operationId: "commit-standard-supplier",
        tick: 0,
        actor: "human",
        kind: "SET_SUPPLIER_MODE",
        value: "standard",
      },
    ];

    const receipt = await simulateFactory(input);
    expect(
      receipt.costLedger.find((entry) => entry.category === "EXPEDITE")
        ?.amountMicroEur,
    ).toBe("0");
    expect(receipt.totalCostMicroEur).toBe("43275975000");
  });

  it("charges standard changed to expedite at tick zero", async () => {
    const input = createBaselineInput();
    input.operations = [
      {
        operationId: "commit-expedite-supplier",
        tick: 0,
        actor: "human",
        kind: "SET_SUPPLIER_MODE",
        value: "expedite",
      },
    ];

    const receipt = await simulateFactory(input);
    expect(
      receipt.costLedger.find((entry) => entry.category === "EXPEDITE")
        ?.amountMicroEur,
    ).toBe("2500000000");
    expect(receipt.totalCostMicroEur).toBe("45775975000");
  });

  it("rejects late standard-to-expedite without applying mode or premium", async () => {
    const input = createBaselineInput();
    input.operations = [
      {
        operationId: "late-expedite-supplier",
        tick: 16,
        actor: "model",
        kind: "SET_SUPPLIER_MODE",
        value: "expedite",
      },
    ];

    const receipt = await simulateFactory(input);

    expect(receipt.acceptedOperations).toHaveLength(0);
    expect(receipt.rejectedOperations).toEqual([
      expect.objectContaining({
        operationId: "late-expedite-supplier",
        reason: "PRE_SHIFT_ONLY",
        fatal: true,
      }),
    ]);
    expect(receipt.ticks[16]?.rejectedOperationIds).toEqual([
      "late-expedite-supplier",
    ]);
    expect(receipt.ticks[16]?.controls.supplierMode).toBe("standard");
    expect(receipt.ticks[63]?.controls.supplierMode).toBe("standard");
    expect(
      receipt.costLedger.find((entry) => entry.category === "EXPEDITE")
        ?.amountMicroEur,
    ).toBe("0");
    expect(receipt.totalCostMicroEur).toBe("43275975000");
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("rejects late expedite-to-standard without removing committed premium", async () => {
    const input = createBaselineInput();
    input.controls.supplierMode = "expedite";
    input.operations = [
      {
        operationId: "late-standard-supplier",
        tick: 16,
        actor: "model",
        kind: "SET_SUPPLIER_MODE",
        value: "standard",
      },
    ];

    const receipt = await simulateFactory(input);

    expect(receipt.acceptedOperations).toHaveLength(0);
    expect(receipt.rejectedOperations).toEqual([
      expect.objectContaining({
        operationId: "late-standard-supplier",
        reason: "PRE_SHIFT_ONLY",
        fatal: true,
      }),
    ]);
    expect(receipt.ticks[16]?.controls.supplierMode).toBe("expedite");
    expect(receipt.ticks[63]?.controls.supplierMode).toBe("expedite");
    expect(
      receipt.costLedger.find((entry) => entry.category === "EXPEDITE")
        ?.amountMicroEur,
    ).toBe("2500000000");
    expect(receipt.totalCostMicroEur).toBe("45775975000");
    expect(receipt.feasibilityStatus).toBe("INVALID_OPERATIONS");
  });

  it("does not charge initial 15-minute SMED changed to 30 at tick zero", async () => {
    const input = createBaselineInput();
    input.controls.changeoverMinutes = 15;
    input.operations = [
      {
        operationId: "commit-changeover-30",
        tick: 0,
        actor: "human",
        kind: "SET_CHANGEOVER_MINUTES",
        valueMinutes: 30,
      },
    ];

    const receipt = await simulateFactory(input);
    expect(
      receipt.costLedger.find((entry) => entry.category === "SMED")
        ?.amountMicroEur,
    ).toBe("0");
    expect(receipt.rawCounters.grossUnits).toBe(9_300);
    expect(receipt.totalCostMicroEur).toBe("43275975000");
  });

  it("charges 30-minute changeover changed to 15 at tick zero", async () => {
    const input = createBaselineInput();
    input.operations = [
      {
        operationId: "commit-changeover-15",
        tick: 0,
        actor: "human",
        kind: "SET_CHANGEOVER_MINUTES",
        valueMinutes: 15,
      },
    ];

    const receipt = await simulateFactory(input);
    expect(
      receipt.costLedger.find((entry) => entry.category === "SMED")
        ?.amountMicroEur,
    ).toBe("250000000");
    expect(receipt.rawCounters.grossUnits).toBe(9_450);
  });
});
