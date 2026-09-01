import { describe, expect, it } from "vitest";

import { createFactoryToolDescriptors, type FactoryToolName } from "../webmcp";
import { SandboxFactoryCommandBus } from "./commandBus";
import { SandboxStore } from "./store";

function descriptorMap(store: SandboxStore) {
  const bus = new SandboxFactoryCommandBus(store);
  return new Map(
    createFactoryToolDescriptors(() => bus).map((descriptor) => [descriptor.name as FactoryToolName, descriptor]),
  );
}

function executionMetadata() {
  return { signal: new AbortController().signal };
}

describe("real store + WebMCP command bus", () => {
  it("supports manual WebMCP execution when metadata is omitted", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();
    store.reset();
    const tool = descriptorMap(store).get("get_factory_snapshot");

    const result = await tool?.execute({});

    expect(result).toMatchObject({ status: "ok", code: "OK", request_id: null });
  });

  it("executes the complete inspect-create-change-simulate-compare flow and updates visible state", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();
    store.reset();
    const tools = descriptorMap(store);

    const factory = await tools.get("get_factory_snapshot")?.execute({}, executionMetadata());
    expect(factory).toMatchObject({ status: "ok", code: "OK", request_id: null });
    expect(factory?.data).toMatchObject({
      current_controls: {
        mixer_speed_bps: 8_750,
        packaging_speed_bps: 7_500,
        packaging_changeover_minutes: 30,
        packaging_calibration: "standard",
      },
      stations: expect.arrayContaining([
        expect.objectContaining({
          resource: "Packaging",
          processed_per_shift: 9_300,
          capacity_per_shift: expect.any(Number),
          ending_upstream_queue: 1_900_000,
          bottleneck: expect.objectContaining({ reason: "CHANGEOVER_AND_RATE_LIMIT" }),
        }),
      ]),
      bottlenecks: expect.arrayContaining([
        expect.objectContaining({ resource: "Packaging", ending_upstream_queue: 1_900_000, queue_unit: "grams" }),
      ]),
    });
    const factoryData = factory?.data as Record<string, unknown>;

    const created = await tools.get("create_scenario")?.execute({
      request_id: "e2e-create-scenario",
      name: "Constraint-safe plan",
      factory_version_id: factoryData.factory_version_id,
      expected_factory_revision: factoryData.factory_revision,
      expected_lock_revision: factoryData.lock_revision,
    }, executionMetadata());
    expect(created).toMatchObject({ status: "ok", code: "OK", request_id: "e2e-create-scenario" });
    const createdData = created?.data as Record<string, unknown>;

    const changed = await tools.get("apply_scenario_changes")?.execute({
      request_id: "e2e-apply-settings",
      scenario_id: createdData.scenario_id,
      expected_factory_revision: factoryData.factory_revision,
      expected_scenario_revision: createdData.scenario_revision,
      expected_lock_revision: factoryData.lock_revision,
      changes: {
        mixer_speed_bps: 9_500,
        packaging_speed_bps: 9_000,
        packaging_changeover_minutes: 15,
        packaging_calibration: "enhanced",
      },
    }, executionMetadata());
    expect(changed).toMatchObject({ status: "ok", code: "OK" });
    const changedData = changed?.data as Record<string, unknown>;

    const simulated = await tools.get("run_factory_simulation")?.execute({
      request_id: "e2e-run-shift",
      scenario_id: createdData.scenario_id,
      expected_factory_revision: factoryData.factory_revision,
      expected_scenario_revision: changedData.scenario_revision,
      expected_lock_revision: factoryData.lock_revision,
      horizon_shifts: 1,
    }, executionMetadata());
    expect(simulated).toMatchObject({ status: "ok", code: "OK" });
    expect(simulated?.data).toMatchObject({
      feasibility: "FEASIBLE",
      good_output_units: 11_114,
      source_is_current: true,
    });

    const baselineRunId = store.getSnapshot().baselineReceipt?.runId;
    const simulationData = simulated?.data as Record<string, unknown>;
    const compared = await tools.get("compare_simulation_runs")?.execute({
      run_ids: [baselineRunId, simulationData.run_id],
    }, executionMetadata());
    expect(compared).toMatchObject({ status: "ok", code: "OK" });
    expect(compared?.data).toMatchObject({
      delta_semantics: "CANDIDATE_MINUS_ANCHOR",
      anchor_constraints: expect.arrayContaining([
        expect.objectContaining({ code: "OUTPUT_20", lhs: expect.any(String), operator: ">=", rhs: expect.any(String) }),
      ]),
      comparisons: [expect.objectContaining({
        delta_good_output_units: 2_000,
        feasibility: "FEASIBLE",
        constraints: expect.arrayContaining([
          expect.objectContaining({ code: "COST_8", lhs: expect.any(String), operator: "<=", rhs: expect.any(String), pass: true }),
        ]),
      })],
    });

    const visibleScenario = store.getSnapshot().scenarios.find((scenario) => scenario.id === createdData.scenario_id);
    expect(visibleScenario?.receipt?.runId).toBe(simulationData.run_id);
    expect(store.getSnapshot().ledger[0]?.label).toContain("feasible");
  });

  it("rejects the historical scenario head and requires a fresh branch after human authority changes", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();
    store.reset();
    const beforeCreate = store.getSnapshot();
    const created = store.createScenario({
      request_id: "lock-e2e-create",
      name: "Plan before lock",
      factory_version_id: beforeCreate.factoryVersionId,
      expected_factory_revision: beforeCreate.factoryRevision,
      expected_lock_revision: beforeCreate.lockRevision,
    });
    await store.togglePackagingLock();
    const locked = store.getSnapshot();
    const revisionBefore = locked.scenarios.find((scenario) => scenario.id === created.scenario_id)?.revision;
    const tools = descriptorMap(store);

    const result = await tools.get("apply_scenario_changes")?.execute({
      request_id: "lock-e2e-apply",
      scenario_id: created.scenario_id,
      expected_factory_revision: locked.factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: locked.lockRevision,
      changes: { mixer_speed_bps: 9_500, packaging_speed_bps: 9_000 },
    }, executionMetadata());

    expect(result).toMatchObject({
      status: "error",
      code: "STALE_SCENARIO",
      request_id: "lock-e2e-apply",
      data: expect.objectContaining({
        committed: false,
        source_lock_revision: beforeCreate.lockRevision,
        current_lock_revision: locked.lockRevision,
        recovery: expect.objectContaining({
          tool: "get_factory_snapshot",
          fresh_scenario_required: true,
        }),
      }),
    });
    expect(store.getSnapshot().scenarios.find((scenario) => scenario.id === created.scenario_id)?.revision).toBe(revisionBefore);
  });

  it("discards an in-flight receipt when the human lock revision changes before commit", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();
    store.reset();
    const snapshot = store.getSnapshot();
    const created = store.createScenario({
      request_id: "race-create",
      name: "Plan racing the human lock",
      factory_version_id: snapshot.factoryVersionId,
      expected_factory_revision: snapshot.factoryRevision,
      expected_lock_revision: snapshot.lockRevision,
    });
    const tools = descriptorMap(store);
    const pending = tools.get("run_factory_simulation")?.execute({
      request_id: "race-run",
      scenario_id: created.scenario_id,
      expected_factory_revision: snapshot.factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: snapshot.lockRevision,
      horizon_shifts: 1,
    }, executionMetadata());

    await store.togglePackagingLock();
    const result = await pending;

    expect(result).toMatchObject({
      status: "error",
      code: "LOCK_CHANGED",
      request_id: "race-run",
      data: expect.objectContaining({
        expected_lock_revision: snapshot.lockRevision,
        current_lock_revision: snapshot.lockRevision + 1,
      }),
    });
    const racedScenario = store.getSnapshot().scenarios.find((scenario) => scenario.id === created.scenario_id);
    expect(racedScenario?.receipt).toBeNull();
    expect(Object.keys(store.getSnapshot().runs)).toEqual([store.getSnapshot().baselineReceipt?.runId]);
  });

  it("joins concurrent idempotent simulation retries and rejects a conflicting payload before it can commit", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();
    store.reset();
    const factory = store.getSnapshot();
    const scenarioA = store.createScenario({
      request_id: "concurrent-create-a",
      name: "Concurrent plan A",
      factory_version_id: factory.factoryVersionId,
      expected_factory_revision: factory.factoryRevision,
      expected_lock_revision: factory.lockRevision,
    });
    const scenarioB = store.createScenario({
      request_id: "concurrent-create-b",
      name: "Concurrent plan B",
      factory_version_id: factory.factoryVersionId,
      expected_factory_revision: factory.factoryRevision,
      expected_lock_revision: factory.lockRevision,
    });
    const runner = descriptorMap(store).get("run_factory_simulation");
    expect(runner).toBeDefined();
    const input = {
      request_id: "concurrent-run",
      scenario_id: scenarioA.scenario_id,
      expected_factory_revision: factory.factoryRevision,
      expected_scenario_revision: scenarioA.scenario_revision,
      expected_lock_revision: factory.lockRevision,
      horizon_shifts: 1,
    };

    const firstPending = runner?.execute(input, executionMetadata());
    const joinedPending = runner?.execute(input, executionMetadata());
    const conflicting = await runner?.execute({
      ...input,
      scenario_id: scenarioB.scenario_id,
      expected_scenario_revision: scenarioB.scenario_revision,
    }, executionMetadata());
    const [first, joined] = await Promise.all([firstPending, joinedPending]);

    expect(conflicting).toMatchObject({
      status: "error",
      code: "IDEMPOTENCY_KEY_REUSED",
      request_id: "concurrent-run",
    });
    expect(joined).toEqual(first);
    expect(first).toMatchObject({ status: "ok", code: "OK", request_id: "concurrent-run" });
    expect(store.getSnapshot().ledger.filter((event) => event.kind === "simulation" && event.label.includes("Concurrent plan A"))).toHaveLength(1);
    expect(store.getSnapshot().scenarios.find((scenario) => scenario.id === scenarioB.scenario_id)?.receipt).toBeNull();
  });

  it("describes semantic no-ops truthfully without claiming a commit", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();
    store.reset();
    const factory = store.getSnapshot();
    const scenario = store.createScenario({
      request_id: "noop-create",
      name: "No-op plan",
      factory_version_id: factory.factoryVersionId,
      expected_factory_revision: factory.factoryRevision,
      expected_lock_revision: factory.lockRevision,
    });
    const tool = descriptorMap(store).get("apply_scenario_changes");

    const result = await tool?.execute({
      request_id: "noop-apply",
      scenario_id: scenario.scenario_id,
      expected_factory_revision: factory.factoryRevision,
      expected_scenario_revision: scenario.scenario_revision,
      expected_lock_revision: factory.lockRevision,
      changes: { supplier_mode: "standard" },
    }, executionMetadata());

    expect(result).toMatchObject({
      status: "ok",
      code: "OK",
      message: "Scenario settings already matched the effective values; no state changed.",
      data: {
        committed: false,
        outcome: "NO_OP",
        scenario_revision: scenario.scenario_revision,
      },
    });
  });

  it("maps a full current workspace to the public WORKSPACE_FULL code", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();
    store.reset();
    const factory = store.getSnapshot();
    store.createScenario({
      request_id: "full-create-a",
      name: "Full A",
      factory_version_id: factory.factoryVersionId,
      expected_factory_revision: factory.factoryRevision,
      expected_lock_revision: factory.lockRevision,
    });
    store.createScenario({
      request_id: "full-create-b",
      name: "Full B",
      factory_version_id: factory.factoryVersionId,
      expected_factory_revision: factory.factoryRevision,
      expected_lock_revision: factory.lockRevision,
    });
    const tool = descriptorMap(store).get("create_scenario");

    const result = await tool?.execute({
      request_id: "full-create-c",
      name: "Full C",
      factory_version_id: factory.factoryVersionId,
      expected_factory_revision: factory.factoryRevision,
      expected_lock_revision: factory.lockRevision,
    }, executionMetadata());

    expect(result).toMatchObject({
      status: "error",
      code: "WORKSPACE_FULL",
      data: expect.objectContaining({ committed: false }),
    });
  });
});
