import { describe, expect, it, vi } from "vitest";

import {
  FactoryCommandError,
  type CommandOutcome,
  type FactoryCommandBus,
  type WebMcpToolDescriptor,
} from "./contracts";
import { FACTORY_TOOL_NAMES, createFactoryToolDescriptors } from "./tools";

const OK_OUTCOME: CommandOutcome = {
  status: "ok",
  code: "OK",
  message: "Operation completed.",
  data: { revision: 8 },
};

function makeBus(overrides: Partial<FactoryCommandBus> = {}): FactoryCommandBus {
  return {
    getFactorySnapshot: vi.fn(async () => OK_OUTCOME),
    getScenarioSnapshot: vi.fn(async () => OK_OUTCOME),
    createScenario: vi.fn(async () => OK_OUTCOME),
    applyScenarioChanges: vi.fn(async () => OK_OUTCOME),
    runFactorySimulation: vi.fn(async () => OK_OUTCOME),
    compareSimulationRuns: vi.fn(async () => OK_OUTCOME),
    awaitVisibleCommit: vi.fn(async () => undefined),
    ...overrides,
  };
}

function descriptor(
  name: (typeof FACTORY_TOOL_NAMES)[number],
  bus: FactoryCommandBus,
): WebMcpToolDescriptor {
  const found = createFactoryToolDescriptors(() => bus).find(
    (candidate) => candidate.name === name,
  );
  if (!found) {
    throw new Error(`Missing descriptor: ${name}`);
  }
  return found;
}

const VALID_APPLY_INPUT = {
  request_id: "req.apply.1",
  scenario_id: "scenario-b",
  expected_factory_revision: 7,
  expected_scenario_revision: 2,
  expected_lock_revision: 3,
  changes: {
    mixer_speed_bps: 10_200,
    packaging_changeover_minutes: 15,
    packaging_calibration: "enhanced",
    supplier_mode: "standard",
    quality_rate_units_per_hour: 800,
    warehouse_dock_units_per_hour: 900,
  },
} as const;

describe("factory WebMCP schemas", () => {
  it("uses closed object schemas with required fields, bounds, and enums", () => {
    const descriptors = createFactoryToolDescriptors(() => makeBus());
    expect(descriptors.map((item) => item.name)).toEqual(FACTORY_TOOL_NAMES);

    for (const item of descriptors) {
      expect(item.inputSchema.type).toBe("object");
      expect(item.inputSchema.additionalProperties).toBe(false);
      expect(Array.isArray(item.inputSchema.required)).toBe(true);
    }

    const apply = descriptors.find(
      (item) => item.name === "apply_scenario_changes",
    );
    const changes = apply?.inputSchema.properties.changes;
    expect(changes && "properties" in changes).toBe(true);
    if (!changes || !("properties" in changes)) {
      throw new Error("Missing changes schema");
    }
    expect(changes.additionalProperties).toBe(false);
    expect(changes.minProperties).toBe(1);
    expect(changes.properties.packaging_changeover_minutes).toMatchObject({
      enum: [15, 30, 45],
    });
    expect(changes.properties.packaging_calibration).toMatchObject({
      enum: ["standard", "enhanced"],
    });
    expect(changes.properties.supplier_mode).toMatchObject({
      enum: ["standard", "expedite"],
    });
    expect(changes.properties.quality_rate_units_per_hour).toMatchObject({
      enum: [600, 700, 800, 900],
    });
    expect(changes.properties.warehouse_dock_units_per_hour).toMatchObject({
      enum: [800, 900, 1000],
    });

    const run = descriptors.find(
      (item) => item.name === "run_factory_simulation",
    );
    expect(run?.inputSchema.properties.horizon_shifts).toMatchObject({
      type: "integer",
      enum: [1],
    });

    expect(FACTORY_TOOL_NAMES.some((name) => /lock|unlock|force/.test(name))).toBe(false);
  });
});

describe("factory WebMCP execution", () => {
  it("rejects unknown and invalid write fields before touching application state", async () => {
    const bus = makeBus();
    const tool = descriptor("apply_scenario_changes", bus);
    const result = await tool.execute(
      {
        ...VALID_APPLY_INPUT,
        force: true,
        changes: {
          ...VALID_APPLY_INPUT.changes,
          packaging_changeover_minutes: 12,
          unlock_packaging: true,
        },
      },
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({
      schema_version: "factory-tools/v1",
      status: "error",
      code: "VALIDATION_ERROR",
      request_id: "req.apply.1",
    });
    expect(result.data).toMatchObject({ issues: expect.any(Array) });
    expect(bus.applyScenarioChanges).not.toHaveBeenCalled();
    expect(bus.awaitVisibleCommit).not.toHaveBeenCalled();
  });

  it("waits for a visible UI commit before completing a successful write", async () => {
    let releaseVisibleCommit: (() => void) | undefined;
    const visibleCommit = new Promise<void>((resolve) => {
      releaseVisibleCommit = resolve;
    });
    const bus = makeBus({
      applyScenarioChanges: vi.fn(async () => OK_OUTCOME),
      awaitVisibleCommit: vi.fn(() => visibleCommit),
    });
    const tool = descriptor("apply_scenario_changes", bus);

    let settled = false;
    const execution = Promise.resolve(
      tool.execute(VALID_APPLY_INPUT, { signal: new AbortController().signal }),
    )
      .then((value) => {
        settled = true;
        return value;
      });
    await Promise.resolve();
    await Promise.resolve();

    expect(bus.applyScenarioChanges).toHaveBeenCalledOnce();
    expect(bus.awaitVisibleCommit).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    releaseVisibleCommit?.();
    await expect(execution).resolves.toMatchObject({
      status: "ok",
      code: "OK",
      request_id: "req.apply.1",
    });
  });

  it("returns ABORTED without calling the bus when the signal is already aborted", async () => {
    const bus = makeBus();
    const tool = descriptor("run_factory_simulation", bus);
    const controller = new AbortController();
    controller.abort();

    const result = await tool.execute(
      {
        request_id: "req.run.1",
        scenario_id: "scenario-b",
        expected_factory_revision: 7,
        expected_scenario_revision: 2,
        expected_lock_revision: 3,
        horizon_shifts: 1,
      },
      { signal: controller.signal },
    );

    expect(result).toMatchObject({
      status: "error",
      code: "ABORTED",
      request_id: "req.run.1",
    });
    expect(bus.runFactorySimulation).not.toHaveBeenCalled();
    expect(bus.awaitVisibleCommit).not.toHaveBeenCalled();
  });

  it("does not advertise or execute unsupported multi-shift behavior", async () => {
    const bus = makeBus();
    const result = await descriptor("run_factory_simulation", bus).execute(
      {
        request_id: "req.run.multi",
        scenario_id: "scenario-b",
        expected_factory_revision: 7,
        expected_scenario_revision: 2,
        expected_lock_revision: 3,
        horizon_shifts: 2,
      },
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({
      status: "error",
      code: "VALIDATION_ERROR",
      request_id: "req.run.multi",
    });
    expect(bus.runFactorySimulation).not.toHaveBeenCalled();
  });

  it("preserves closed business errors in a structured envelope", async () => {
    const bus = makeBus({
      applyScenarioChanges: vi.fn(async () => {
        throw new FactoryCommandError(
          "HUMAN_LOCKED",
          "Packaging is locked by a human decision.",
          { station_id: "packaging", lock_revision: 3 },
        );
      }),
    });
    const result = await descriptor("apply_scenario_changes", bus).execute(
      VALID_APPLY_INPUT,
      { signal: new AbortController().signal },
    );

    expect(result).toEqual({
      schema_version: "factory-tools/v1",
      status: "error",
      code: "HUMAN_LOCKED",
      request_id: "req.apply.1",
      message: "Packaging is locked by a human decision.",
      data: { station_id: "packaging", lock_revision: 3 },
    });
    expect(bus.awaitVisibleCommit).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected faults and rejects non-JSON bus results", async () => {
    const secret = "postgres://private-password";
    const throwingBus = makeBus({
      getFactorySnapshot: vi.fn(async () => {
        throw new Error(secret);
      }),
    });
    const malformedBus = makeBus({
      getFactorySnapshot: vi.fn(async () => ({
        ...OK_OUTCOME,
        data: { impossible: 1n },
      })),
    });

    const thrown = await descriptor("get_factory_snapshot", throwingBus).execute(
      {},
      { signal: new AbortController().signal },
    );
    const malformed = await descriptor("get_factory_snapshot", malformedBus).execute(
      {},
      { signal: new AbortController().signal },
    );

    expect(thrown).toMatchObject({
      status: "error",
      code: "INTERNAL_ERROR",
      request_id: null,
      message: "The operation could not be completed.",
      data: null,
    });
    expect(JSON.stringify(thrown)).not.toContain(secret);
    expect(malformed).toMatchObject({ status: "error", code: "INTERNAL_ERROR" });
  });

  it("returns structured stale outcomes and skips the visible-write barrier", async () => {
    const bus = makeBus({
      runFactorySimulation: vi.fn(async () =>
        ({
          status: "error",
          code: "STALE_SCENARIO",
          message: "Scenario revision changed; inspect it again.",
          data: { expected: 2, actual: 3 },
        }) satisfies CommandOutcome,
      ),
    });
    const result = await descriptor("run_factory_simulation", bus).execute(
      {
        request_id: "req.run.stale",
        scenario_id: "scenario-b",
        expected_factory_revision: 7,
        expected_scenario_revision: 2,
        expected_lock_revision: 3,
        horizon_shifts: 1,
      },
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({
      schema_version: "factory-tools/v1",
      status: "error",
      code: "STALE_SCENARIO",
      request_id: "req.run.stale",
    });
    expect(bus.awaitVisibleCommit).not.toHaveBeenCalled();
  });
});
