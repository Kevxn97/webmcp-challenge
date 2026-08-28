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

    const create = descriptors.find((item) => item.name === "create_scenario");
    const scenarioName = create?.inputSchema.properties.name;
    expect(scenarioName).toMatchObject({
      minLength: 1,
      maxLength: 48,
      pattern: expect.any(String),
    });
    if (!scenarioName || !("pattern" in scenarioName) || !scenarioName.pattern) {
      throw new Error("Missing scenario-name pattern");
    }
    const namePattern = new RegExp(scenarioName.pattern, "u");
    expect(namePattern.test("Scenario B")).toBe(true);
    expect(namePattern.test(" Scenario B")).toBe(false);
    expect(namePattern.test("Scenario B ")).toBe(false);
    expect(namePattern.test("Scenario\nB")).toBe(false);

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
    const validationData = result.data as { issues?: unknown };
    expect(Array.isArray(validationData.issues)).toBe(true);
    expect(bus.applyScenarioChanges).not.toHaveBeenCalled();
    expect(bus.awaitVisibleCommit).not.toHaveBeenCalled();
  });

  it.each([" Scenario B", "Scenario B ", "Scenario\nB"])(
    "keeps scenario-name runtime validation aligned with the schema for %j",
    async (name) => {
      const bus = makeBus();
      const result = await descriptor("create_scenario", bus).execute(
        {
          request_id: "req.create.invalid-name",
          name,
          factory_version_id: "factory-v7",
          expected_factory_revision: 7,
          expected_lock_revision: 3,
        },
        { signal: new AbortController().signal },
      );

      expect(result).toMatchObject({
        status: "error",
        code: "VALIDATION_ERROR",
      });
      expect(bus.createScenario).not.toHaveBeenCalled();
      expect(bus.awaitVisibleCommit).not.toHaveBeenCalled();
    },
  );

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

  it("keeps committed success when cancellation aborts the visibility barrier", async () => {
    const controller = new AbortController();
    const bus = makeBus({
      applyScenarioChanges: vi.fn(async () => OK_OUTCOME),
      awaitVisibleCommit: vi.fn(
        ({ signal }) =>
          new Promise<void>((_resolve, reject) => {
            const rejectAsAborted = () =>
              reject(new DOMException("Visibility wait aborted", "AbortError"));
            if (signal.aborted) {
              rejectAsAborted();
            } else {
              signal.addEventListener("abort", rejectAsAborted, { once: true });
            }
          }),
      ),
    });
    const execution = descriptor("apply_scenario_changes", bus).execute(
      VALID_APPLY_INPUT,
      { signal: controller.signal },
    );
    await vi.waitFor(() => expect(bus.awaitVisibleCommit).toHaveBeenCalledOnce());

    controller.abort();

    await expect(execution).resolves.toMatchObject({
      status: "ok",
      code: "OK",
      request_id: "req.apply.1",
    });
  });

  it("keeps committed success when the visibility barrier rejects", async () => {
    const bus = makeBus({
      applyScenarioChanges: vi.fn(async () => OK_OUTCOME),
      awaitVisibleCommit: vi.fn(async () => {
        throw new Error("React commit observation failed");
      }),
    });

    const result = await descriptor("apply_scenario_changes", bus).execute(
      VALID_APPLY_INPUT,
      { signal: new AbortController().signal },
    );

    expect(bus.applyScenarioChanges).toHaveBeenCalledOnce();
    expect(bus.awaitVisibleCommit).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
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

  it("rejects hidden toJSON and BigInt properties on objects and arrays", async () => {
    const cases: Array<() => unknown> = [
      () => {
        const value = { visible: true };
        Object.defineProperty(value, "toJSON", {
          value: () => ({ transformed: true }),
          enumerable: false,
        });
        return value;
      },
      () => {
        const value = { visible: true };
        Object.defineProperty(value, "hidden", {
          value: 1n,
          enumerable: false,
        });
        return value;
      },
      () => {
        const value = [1, 2];
        Object.defineProperty(value, "toJSON", {
          value: () => ({ transformed: true }),
          enumerable: false,
        });
        return value;
      },
      () => {
        const value = [1, 2];
        Object.defineProperty(value, "hidden", {
          value: 1n,
          enumerable: false,
        });
        return value;
      },
    ];

    for (const createData of cases) {
      const bus = makeBus({
        getFactorySnapshot: vi.fn(async () => ({
          ...OK_OUTCOME,
          data: createData(),
        })),
      });
      const result = await descriptor("get_factory_snapshot", bus).execute(
        {},
        { signal: new AbortController().signal },
      );

      expect(result).toMatchObject({
        status: "error",
        code: "INTERNAL_ERROR",
      });
      expect(() => JSON.stringify(result)).not.toThrow();
    }
  });

  it("rejects accessors and symbol properties without invoking getters", async () => {
    let getterCalls = 0;
    const accessorValue: Record<string, unknown> = {};
    Object.defineProperty(accessorValue, "dangerous", {
      get: () => {
        getterCalls += 1;
        throw new Error("getter must never run");
      },
      enumerable: true,
    });
    const symbolValue = { visible: true } as Record<PropertyKey, unknown>;
    symbolValue[Symbol("hidden")] = "not JSON";

    for (const data of [accessorValue, symbolValue]) {
      const bus = makeBus({
        getFactorySnapshot: vi.fn(async () => ({ ...OK_OUTCOME, data })),
      });
      const result = await descriptor("get_factory_snapshot", bus).execute(
        {},
        { signal: new AbortController().signal },
      );
      expect(result).toMatchObject({
        status: "error",
        code: "INTERNAL_ERROR",
      });
    }

    expect(getterCalls).toBe(0);
  });

  it("returns a frozen reconstructed JSON tree for valid bus data", async () => {
    const source = { station: "packaging", samples: [950, 1000, 1050] };
    const bus = makeBus({
      getFactorySnapshot: vi.fn(async () => ({
        ...OK_OUTCOME,
        data: source,
      })),
    });
    const result = await descriptor("get_factory_snapshot", bus).execute(
      {},
      { signal: new AbortController().signal },
    );
    const data = result.data as { station: string; samples: number[] };

    expect(result).toMatchObject({ status: "ok", code: "OK" });
    expect(data).not.toBe(source);
    expect(data.samples).not.toBe(source.samples);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.samples)).toBe(true);
    expect([...data.samples]).toEqual([950, 1000, 1050]);
    expect(data.samples.map((sample) => sample + 1)).toEqual([951, 1001, 1051]);
    expect(Object.getPrototypeOf(data.samples)).toBe(Array.prototype);
    expect(Object.getOwnPropertyDescriptor(data.samples, "toJSON")).toMatchObject({
      value: undefined,
      enumerable: false,
    });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({
      status: "ok",
      data: source,
    });
  });

  it("ignores inherited Object and Array toJSON hooks for success and error envelopes", async () => {
    const objectToJson = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "toJSON",
    );
    const arrayToJson = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "toJSON",
    );
    let successJson: string | undefined;
    let errorJson: string | undefined;
    let successData: unknown;

    try {
      Object.defineProperty(Object.prototype, "toJSON", {
        value: () => ({ polluted_by_object_prototype: true }),
        configurable: true,
      });
      Object.defineProperty(Array.prototype, "toJSON", {
        value: () => {
          throw new Error("polluted array serializer");
        },
        configurable: true,
      });

      const successBus = makeBus({
        getFactorySnapshot: vi.fn(async () => ({
          ...OK_OUTCOME,
          data: {
            factory: { revision: 7 },
            throughput_band: [900, 950, 1000],
          },
        })),
      });
      const malformedData = { visible: true };
      Object.defineProperty(malformedData, "hidden", {
        value: 1n,
        enumerable: false,
      });
      const errorBus = makeBus({
        getFactorySnapshot: vi.fn(async () => ({
          ...OK_OUTCOME,
          data: malformedData,
        })),
      });

      const success = await descriptor(
        "get_factory_snapshot",
        successBus,
      ).execute({}, { signal: new AbortController().signal });
      const error = await descriptor("get_factory_snapshot", errorBus).execute(
        {},
        { signal: new AbortController().signal },
      );
      successData = success.data;
      successJson = JSON.stringify(success);
      errorJson = JSON.stringify(error);
    } finally {
      if (arrayToJson) {
        Object.defineProperty(Array.prototype, "toJSON", arrayToJson);
      } else {
        Reflect.deleteProperty(Array.prototype, "toJSON");
      }
      if (objectToJson) {
        Object.defineProperty(Object.prototype, "toJSON", objectToJson);
      } else {
        Reflect.deleteProperty(Object.prototype, "toJSON");
      }
    }

    const success = JSON.parse(successJson ?? "null") as {
      status?: string;
      data?: { factory?: { revision?: number }; throughput_band?: number[] };
    };
    const error = JSON.parse(errorJson ?? "null") as {
      status?: string;
      code?: string;
    };
    const liveData = successData as { throughput_band?: unknown };

    expect(success.status).toBe("ok");
    expect(success.data?.factory?.revision).toBe(7);
    expect(success.data?.throughput_band).toEqual([900, 950, 1000]);
    expect(Array.isArray(liveData.throughput_band)).toBe(true);
    expect(Object.getPrototypeOf(successData as object)).toBeNull();
    expect(Object.getPrototypeOf(liveData.throughput_band as object)).toBe(
      Array.prototype,
    );
    const liveBand = liveData.throughput_band as number[];
    expect([...liveBand]).toEqual([900, 950, 1000]);
    expect(liveBand.map((value) => value / 10)).toEqual([90, 95, 100]);
    expect(Object.getOwnPropertyDescriptor(liveBand, "toJSON")).toMatchObject({
      value: undefined,
      enumerable: false,
    });
    expect(error).toMatchObject({ status: "error", code: "INTERNAL_ERROR" });
  });

  it.each(["OK", "NOT_A_FACTORY_CODE"])(
    "maps a runtime FactoryCommandError code %s to INTERNAL_ERROR",
    async (runtimeCode) => {
      const invalidError = new FactoryCommandError(
        "HUMAN_LOCKED",
        "This message must not be trusted for an invalid code.",
      );
      Object.defineProperty(invalidError, "code", {
        value: runtimeCode,
        configurable: true,
      });
      const bus = makeBus({
        applyScenarioChanges: vi.fn(async () => {
          throw invalidError;
        }),
      });

      const result = await descriptor("apply_scenario_changes", bus).execute(
        VALID_APPLY_INPUT,
        { signal: new AbortController().signal },
      );

      expect(result).toMatchObject({
        status: "error",
        code: "INTERNAL_ERROR",
        message: "The operation could not be completed.",
        data: null,
      });
      expect(bus.awaitVisibleCommit).not.toHaveBeenCalled();
    },
  );

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
