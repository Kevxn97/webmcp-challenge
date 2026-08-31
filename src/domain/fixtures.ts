import {
  BASELINE_CONTROLS,
  BASELINE_DELIVERIES,
  INPUT_VERSION,
  TICK_MINUTES,
  TOTAL_TICKS,
} from "./constants";
import type { FactoryControls, FactorySimulationInput } from "./types";
import { PACKAGING_LOCK_EFFECTIVE_TICK } from "../shared/controlDefinitions";

function controlsFixture(): FactoryControls {
  return { ...BASELINE_CONTROLS };
}

function deliveriesFixture() {
  return BASELINE_DELIVERIES.map((delivery) => ({ ...delivery }));
}

export function createBaselineInput(): FactorySimulationInput {
  return {
    inputVersion: INPUT_VERSION,
    tickMinutes: TICK_MINUTES,
    totalTicks: TOTAL_TICKS,
    controls: controlsFixture(),
    deliveries: deliveriesFixture(),
    operations: [],
  };
}

export function createValidScenarioInput(): FactorySimulationInput {
  return {
    ...createBaselineInput(),
    operations: [
      {
        operationId: "valid-mixer-9500",
        tick: 0,
        actor: "model",
        kind: "SET_MIXER_SPEED",
        valueBps: 9_500,
      },
      {
        operationId: "valid-packaging-9000",
        tick: 0,
        actor: "model",
        kind: "SET_PACKAGING_SPEED",
        valueBps: 9_000,
      },
      {
        operationId: "valid-changeover-15",
        tick: 0,
        actor: "model",
        kind: "SET_CHANGEOVER_MINUTES",
        valueMinutes: 15,
      },
      {
        operationId: "valid-calibration-enhanced",
        tick: 0,
        actor: "model",
        kind: "SET_CALIBRATION",
        value: "enhanced",
      },
    ],
  };
}

export function createInvalidCostScenarioInput(): FactorySimulationInput {
  const valid = createValidScenarioInput();
  return {
    ...valid,
    operations: [
      ...valid.operations,
      {
        operationId: "invalid-cost-expedite",
        tick: 0,
        actor: "model",
        kind: "SET_SUPPLIER_MODE",
        value: "expedite",
      },
    ],
  };
}

export function createLockedScenarioInput(): FactorySimulationInput {
  return {
    ...createBaselineInput(),
    operations: [
      {
        operationId: "lock-packaging-t16",
        tick: PACKAGING_LOCK_EFFECTIVE_TICK,
        actor: "human",
        kind: "LOCK_RESOURCE",
        resource: "Packaging",
      },
      {
        operationId: "locked-same-tick-packaging-9000",
        tick: PACKAGING_LOCK_EFFECTIVE_TICK,
        actor: "model",
        kind: "SET_PACKAGING_SPEED",
        valueBps: 9_000,
      },
      {
        operationId: "locked-mixer-9500",
        tick: PACKAGING_LOCK_EFFECTIVE_TICK,
        actor: "model",
        kind: "SET_MIXER_SPEED",
        valueBps: 9_500,
      },
      {
        operationId: "locked-changeover-15",
        tick: PACKAGING_LOCK_EFFECTIVE_TICK,
        actor: "model",
        kind: "SET_CHANGEOVER_MINUTES",
        valueMinutes: 15,
      },
      {
        operationId: "locked-calibration",
        tick: PACKAGING_LOCK_EFFECTIVE_TICK,
        actor: "model",
        kind: "SET_CALIBRATION",
        value: "enhanced",
      },
      {
        operationId: "locked-retry-packaging-9500",
        tick: 32,
        actor: "model",
        kind: "SET_PACKAGING_SPEED",
        valueBps: 9_500,
      },
    ],
  };
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export const BASELINE_INPUT: Readonly<FactorySimulationInput> = deepFreeze(
  createBaselineInput(),
);

export const baselineInputFixture = createBaselineInput;
export const validScenarioFixture = createValidScenarioInput;
export const invalidCostScenarioFixture = createInvalidCostScenarioInput;
export const lockedScenarioFixture = createLockedScenarioInput;
