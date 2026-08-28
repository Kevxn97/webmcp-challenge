import { describe, expect, it, vi } from "vitest";

import type {
  CommandOutcome,
  FactoryCommandBus,
  WebMcpDocumentLike,
  WebMcpToolDescriptor,
} from "./contracts";
import { registerFactoryWebMcpTools } from "./register";
import { FACTORY_TOOL_NAMES } from "./tools";

const OK_OUTCOME: CommandOutcome = {
  status: "ok",
  code: "OK",
  message: "Current state returned.",
  data: { revision: 7 },
};

function makeBus(label = "default"): FactoryCommandBus {
  return {
    getFactorySnapshot: vi.fn(async () => ({
      ...OK_OUTCOME,
      data: { bus: label },
    })),
    getScenarioSnapshot: vi.fn(async () => OK_OUTCOME),
    createScenario: vi.fn(async () => OK_OUTCOME),
    applyScenarioChanges: vi.fn(async () => OK_OUTCOME),
    runFactorySimulation: vi.fn(async () => OK_OUTCOME),
    compareSimulationRuns: vi.fn(async () => OK_OUTCOME),
    awaitVisibleCommit: vi.fn(async () => undefined),
  };
}

function makeTarget() {
  const descriptors: WebMcpToolDescriptor[] = [];
  const signals: AbortSignal[] = [];
  const target: WebMcpDocumentLike = {
    modelContext: {
      registerTool: vi.fn((descriptor, options) => {
        descriptors.push(descriptor);
        signals.push(options.signal);
      }),
    },
  };
  return { target, descriptors, signals };
}

describe("registerFactoryWebMcpTools", () => {
  it("registers exactly the six static top-level tools once per live context", async () => {
    const busA = makeBus("A");
    const busB = makeBus("B");
    const { target, descriptors, signals } = makeTarget();

    const first = registerFactoryWebMcpTools(busA, target);
    const second = registerFactoryWebMcpTools(busB, target);
    await Promise.all([first.ready, second.ready]);

    expect(first.supported).toBe(true);
    expect(descriptors.map((descriptor) => descriptor.name)).toEqual(
      FACTORY_TOOL_NAMES,
    );
    expect(descriptors).toHaveLength(6);
    expect(new Set(signals)).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(false);

    const readFactory = descriptors.find(
      (descriptor) => descriptor.name === "get_factory_snapshot",
    );
    const result = await readFactory?.execute({}, { signal: new AbortController().signal });
    expect(result?.data).toEqual({ bus: "B" });
    expect(busA.getFactorySnapshot).not.toHaveBeenCalled();
    expect(busB.getFactorySnapshot).toHaveBeenCalledOnce();

    first.cleanup();
    expect(signals[0]?.aborted).toBe(false);
    second.cleanup();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("marks only inspection tools read-only and exposes no unsupported annotations", async () => {
    const { target, descriptors } = makeTarget();
    const registration = registerFactoryWebMcpTools(makeBus(), target);
    await registration.ready;

    const readOnly = new Set([
      "get_factory_snapshot",
      "get_scenario_snapshot",
      "compare_simulation_runs",
    ]);
    for (const descriptor of descriptors) {
      expect(descriptor.annotations.readOnlyHint).toBe(readOnly.has(descriptor.name));
      expect(descriptor.annotations.untrustedContentHint).toBe(true);
      expect(Object.keys(descriptor.annotations).sort()).toEqual([
        "readOnlyHint",
        "untrustedContentHint",
      ]);
      expect("outputSchema" in descriptor).toBe(false);
    }

    registration.cleanup();
  });

  it("returns a safe no-op when document.modelContext is unavailable", async () => {
    const missingDocument = registerFactoryWebMcpTools(makeBus(), undefined);
    const missingContext = registerFactoryWebMcpTools(makeBus(), {});
    const missingMethod = registerFactoryWebMcpTools(makeBus(), { modelContext: {} });

    await expect(missingDocument.ready).resolves.toBeUndefined();
    await expect(missingContext.ready).resolves.toBeUndefined();
    await expect(missingMethod.ready).resolves.toBeUndefined();
    expect(missingDocument.supported).toBe(false);
    expect(missingContext.supported).toBe(false);
    expect(missingMethod.supported).toBe(false);
    expect(() => {
      missingDocument.cleanup();
      missingContext.cleanup();
      missingMethod.cleanup();
    }).not.toThrow();
  });
});
