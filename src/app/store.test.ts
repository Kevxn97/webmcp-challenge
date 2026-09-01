import { describe, expect, it, vi } from "vitest";

import { createBaselineInput, simulateFactory } from "../domain";
import { SandboxCommandError, SandboxStore, type ScenarioPatch } from "./store";
import { createBlueprintViewModel } from "./viewModel";

const feasibleChanges: ScenarioPatch = {
  mixer_speed_bps: 9_500,
  packaging_speed_bps: 9_000,
  packaging_changeover_minutes: 15,
  packaging_calibration: "enhanced",
};

async function readyStore() {
  const store = new SandboxStore();
  await store.hydrateShowcase();
  return store;
}

function createEmptyScenario(store: SandboxStore) {
  store.reset();
  const snapshot = store.getSnapshot();
  return store.createScenario({
    request_id: "request-create-a",
    name: "Agent constrained plan",
    factory_version_id: snapshot.factoryVersionId,
    expected_factory_revision: snapshot.factoryRevision,
    expected_lock_revision: snapshot.lockRevision,
  });
}

function createNextScenario(
  store: SandboxStore,
  requestId: string,
  name: string,
) {
  const snapshot = store.getSnapshot();
  return store.createScenario({
    request_id: requestId,
    name,
    factory_version_id: snapshot.factoryVersionId,
    expected_factory_revision: snapshot.factoryRevision,
    expected_lock_revision: snapshot.lockRevision,
  });
}

describe("SandboxStore", () => {
  it("hydrates historical evidence plus a current post-lock recovery proof", async () => {
    const store = await readyStore();
    const state = store.getSnapshot();
    const view = createBlueprintViewModel(state);
    const scenarioA = view.scenarios.find((scenario) => scenario.marker === "A");
    const scenarioB = view.scenarios.find((scenario) => scenario.marker === "B");

    expect(state.baselineReceipt?.rawCounters.goodOutputUnits).toBe(9_114);
    expect(state.packagingLocked).toBe(true);
    expect(state.lockRevision).toBe(1);
    expect(scenarioA?.status).toBe("STALE");
    expect(scenarioA?.sourceCurrent).toBe(false);
    expect(scenarioB?.status).toBe("PROVEN INFEASIBLE");
    expect(scenarioB?.sourceCurrent).toBe(true);
    expect(scenarioB?.engineVersion).toBe("factory-engine/1.0.0");
    expect(scenarioB?.infeasibilityProof).toMatchObject({
      exactInequality: "9252 < 10937",
      proven: true,
      sourceCurrent: true,
    });
    expect(view.checks.find((check) => check.id === "COST_8")?.scenarioAPass).toBe(false);
    expect(view.checks.find((check) => check.id === "OUTPUT_20")?.scenarioBPass).toBe(false);
    expect(view.checks.find((check) => check.id === "NO_NEW_MACHINE")?.scenarioBPass).toBe(true);

    const evidenceIndex = store.getFactorySnapshot().evidence_index;
    expect(evidenceIndex).toHaveLength(3);
    expect(evidenceIndex.find((item) =>
      item.scenario_version_id === "scenario-b-v1"
    )).toMatchObject({
      source_is_current: false,
      feasibility: "FEASIBLE",
      good_output_units: 11_114,
    });
  });

  it("deep-freezes stored patches and receipt evidence exposed through snapshots", async () => {
    const store = await readyStore();
    const scenario = store.getSnapshot().scenarios[0];
    const receipt = scenario?.receipt;
    expect(receipt).toBeDefined();
    expect(Object.isFrozen(scenario?.patch)).toBe(true);
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt?.rawCounters)).toBe(true);
    expect(Object.isFrozen(receipt?.constraints)).toBe(true);
    expect(Object.isFrozen(receipt?.constraints[0]?.exactEvidence)).toBe(true);
    const evidence = Object.values(store.getSnapshot().runEvidence)[0];
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence?.patch)).toBe(true);
    expect(Object.isFrozen(evidence?.receipt)).toBe(true);

    expect(() => {
      (receipt?.rawCounters as { goodOutputUnits: number }).goodOutputUnits = 0;
    }).toThrow(TypeError);
    expect(store.getSnapshot().scenarios[0]?.receipt?.rawCounters.goodOutputUnits).toBe(11_114);
  });

  it("creates, revises, and simulates a feasible scenario through the shared command path", async () => {
    const store = await readyStore();
    const created = createEmptyScenario(store);
    const before = store.getSnapshot();

    const updated = store.applyScenarioChanges({
      request_id: "request-apply-valid",
      scenario_id: created.scenario_id,
      expected_factory_revision: before.factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: before.lockRevision,
      changes: feasibleChanges,
    });
    const result = await store.simulateScenarioVersion({
      request_id: "request-run-valid",
      scenario_id: created.scenario_id,
      expected_factory_revision: before.factoryRevision,
      expected_scenario_revision: updated.scenario_revision,
      expected_lock_revision: before.lockRevision,
      horizon_shifts: 1,
    });

    expect(result.feasibility).toBe("FEASIBLE");
    expect(result.good_output_units).toBe(11_114);
    expect(result.constraints.every((constraint) => constraint.pass)).toBe(true);
    expect(store.getSnapshot().ledger[0]?.label).toContain("feasible");
  });

  it("fails a Packaging mutation atomically when the human lock is current", async () => {
    const store = await readyStore();
    createEmptyScenario(store);
    await store.togglePackagingLock();
    const locked = store.getSnapshot();
    const created = store.createScenario({
      request_id: "request-create-under-lock",
      name: "Fresh locked plan",
      factory_version_id: locked.factoryVersionId,
      expected_factory_revision: locked.factoryRevision,
      expected_lock_revision: locked.lockRevision,
    });
    const revisionBefore = created.scenario_revision;

    try {
      store.applyScenarioChanges({
        request_id: "request-locked-change",
        scenario_id: created.scenario_id,
        expected_factory_revision: locked.factoryRevision,
        expected_scenario_revision: created.scenario_revision,
        expected_lock_revision: locked.lockRevision,
        changes: { packaging_speed_bps: 9_000 },
      });
      throw new Error("Expected HUMAN_LOCKED");
    } catch (error) {
      expect(error).toMatchObject({
        code: "HUMAN_LOCKED",
        details: expect.objectContaining({ committed: false }),
      });
    }
    expect(store.getSnapshot().scenarios.find((scenario) => scenario.id === created.scenario_id)?.revision).toBe(revisionBefore);
    expect(store.getSnapshot().ledger[0]).toMatchObject({
      label: "Write rejected",
      detail: expect.stringContaining("NO COMMIT"),
    });
  });

  it("rejects stale lock revisions before applying any changes", async () => {
    const store = await readyStore();
    const created = createEmptyScenario(store);
    const staleLockRevision = store.getSnapshot().lockRevision;
    await store.togglePackagingLock();

    expect(() => store.applyScenarioChanges({
      request_id: "request-stale-lock",
      scenario_id: created.scenario_id,
      expected_factory_revision: store.getSnapshot().factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: staleLockRevision,
      changes: { mixer_speed_bps: 9_500 },
    })).toThrowError(expect.objectContaining({ code: "LOCK_CHANGED" }));
  });

  it("returns the exact prior idempotent result and rejects request-id payload reuse", async () => {
    const store = await readyStore();
    store.reset();
    const state = store.getSnapshot();
    const input = {
      request_id: "request-idempotent",
      name: "Retry safe scenario",
      factory_version_id: state.factoryVersionId,
      expected_factory_revision: state.factoryRevision,
      expected_lock_revision: state.lockRevision,
    };

    const first = store.createScenario(input);
    const second = store.createScenario(input);
    expect(second).toEqual(first);
    expect(store.getSnapshot().scenarios.filter((scenario) => !scenario.placeholder)).toHaveLength(1);
    expect(() => store.createScenario({ ...input, name: "Different payload" })).toThrowError(
      expect.objectContaining({ code: "IDEMPOTENCY_KEY_REUSED" }),
    );
  });

  it("replaces only a historical head deterministically and preserves its evidence", async () => {
    const store = await readyStore();
    store.selectScenario("scenario-a");
    const snapshot = store.getSnapshot();
    const created = store.createScenario({
      request_id: "request-replace-showcase",
      name: "Fresh agent plan",
      factory_version_id: snapshot.factoryVersionId,
      expected_factory_revision: snapshot.factoryRevision,
      expected_lock_revision: snapshot.lockRevision,
    });

    expect(created).toMatchObject({
      allocation_status: "REPLACE_HISTORICAL_HEAD",
      archived_scenario_id: "scenario-a",
    });
    expect(store.getSnapshot().scenarios).toHaveLength(2);
    expect(store.getSnapshot().scenarios.find((scenario) => scenario.id === created.scenario_id)).toMatchObject({
      name: "Fresh agent plan",
      patch: {},
      receipt: null,
      receiptScenarioRevision: null,
      receiptLockRevision: null,
    });
    const archivedRunId = snapshot.scenarios[0]?.receipt?.runId ?? "missing";
    expect(store.getSnapshot().runs[archivedRunId]).toBeDefined();
    expect(store.getSnapshot().runEvidence[archivedRunId]).toBeDefined();
    expect(store.getFactorySnapshot().evidence_index.find(
      (item) => item.run_id === archivedRunId,
    )).toMatchObject({ source_is_current: false });
  });

  it("fails explicitly instead of replacing a current head when the workspace is full", async () => {
    const store = await readyStore();
    store.reset();
    createNextScenario(store, "request-current-a", "Current A");
    createNextScenario(store, "request-current-b", "Current B");
    const before = store.getSnapshot();

    expect(store.getFactorySnapshot().scenario_workspace.next_allocation).toMatchObject({
      status: "WORKSPACE_FULL",
      scenario_id: null,
    });
    expect(() => createNextScenario(
      store,
      "request-current-c",
      "Must not replace",
    )).toThrowError(expect.objectContaining({ code: "WORKSPACE_FULL" }));

    const after = store.getSnapshot();
    expect(after.scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      revision: scenario.revision,
    }))).toEqual(before.scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      revision: scenario.revision,
    })));
  });

  it("produces a deterministic lock-bound proof from a clean post-lock scenario", async () => {
    const store = await readyStore();
    createEmptyScenario(store);
    await store.togglePackagingLock();
    const locked = store.getSnapshot();
    const created = store.createScenario({
      request_id: "request-create-clean-locked",
      name: "Post-lock recovery",
      factory_version_id: locked.factoryVersionId,
      expected_factory_revision: locked.factoryRevision,
      expected_lock_revision: locked.lockRevision,
    });

    const result = await store.simulateScenarioVersion({
      request_id: "request-run-locked",
      scenario_id: created.scenario_id,
      expected_factory_revision: locked.factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: locked.lockRevision,
      horizon_shifts: 1,
    });

    expect(result.feasibility).toBe("PROVEN_INFEASIBLE_UNDER_LOCKS");
    expect(result.proof).toMatchObject({
      good_output_upper_bound: 9_252,
      target_good_output_units: 10_937,
    });

    const proofView = createBlueprintViewModel(store.getSnapshot())
      .scenarios.find((scenario) => scenario.id === created.scenario_id)?.infeasibilityProof;
    expect(proofView).toEqual(expect.objectContaining({
      proofVersion: "factory-lock-upper-bound/v1",
      goodOutputUpperBound: 9_252,
      targetGoodOutputUnits: 10_937,
      exactInequality: "9252 < 10937",
      proven: true,
      sourceCurrent: true,
    }));
  });

  it("keeps unproven upper bounds and old lock receipts non-conclusive in the view model", async () => {
    const input = createBaselineInput();
    input.operations = [
      { operationId: "high-capacity-mixer", tick: 0, actor: "model", kind: "SET_MIXER_SPEED", valueBps: 10_000 },
      { operationId: "high-capacity-packaging", tick: 0, actor: "model", kind: "SET_PACKAGING_SPEED", valueBps: 10_000 },
      { operationId: "high-capacity-changeover", tick: 0, actor: "model", kind: "SET_CHANGEOVER_MINUTES", valueMinutes: 15 },
      { operationId: "high-capacity-lock", tick: 16, actor: "human", kind: "LOCK_RESOURCE", resource: "Packaging" },
    ];
    const receipt = await simulateFactory(input);
    expect(receipt.upperBoundProof?.proven).toBe(false);

    const store = await readyStore();
    const state = store.getSnapshot();
    const scenario = state.scenarios[0];
    expect(scenario).toBeDefined();
    const currentLockRevision = 8;
    const currentState = {
      ...state,
      packagingLocked: true,
      lockRevision: currentLockRevision,
      scenarios: [{
        ...scenario!,
        receipt,
        receiptScenarioRevision: scenario!.revision,
        receiptLockRevision: currentLockRevision,
      }, state.scenarios[1]!],
    };
    const currentView = createBlueprintViewModel(currentState).scenarios.find((item) => item.id === scenario!.id);
    expect(currentView?.status).toBe("FAILED");
    expect(currentView?.infeasibilityProof).toMatchObject({ proven: false, sourceCurrent: true });

    const staleView = createBlueprintViewModel({
      ...currentState,
      packagingLocked: false,
      lockRevision: currentLockRevision + 1,
    }).scenarios.find((item) => item.id === scenario!.id);
    expect(staleView?.status).toBe("STALE");
    expect(staleView?.infeasibilityProof).toMatchObject({ proven: false, sourceCurrent: false });
  });

  it("recomputes simulation source currentness when an idempotent receipt is replayed after a lock change", async () => {
    const store = await readyStore();
    const created = createEmptyScenario(store);
    const state = store.getSnapshot();
    const input = {
      request_id: "request-run-replay-currentness",
      scenario_id: created.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: state.lockRevision,
      horizon_shifts: 1 as const,
    };

    const first = await store.simulateScenarioVersion(input);
    expect(first.source_is_current).toBe(true);

    await store.togglePackagingLock();
    const replay = await store.simulateScenarioVersion(input);

    expect(replay.run_id).toBe(first.run_id);
    expect(replay.input_hash).toBe(first.input_hash);
    expect(replay.source_is_current).toBe(false);
  });

  it("exposes a decision-complete capability map and copy-ready continuation", async () => {
    const store = await readyStore();
    const snapshot = store.getFactorySnapshot();

    expect(snapshot.continuation).toEqual({
      factory_version_id: store.getSnapshot().factoryVersionId,
      expected_factory_revision: store.getSnapshot().factoryRevision,
      expected_lock_revision: store.getSnapshot().lockRevision,
    });
    expect(snapshot.authority).toMatchObject({
      packaging_locked: true,
      blocked_fields: [
        "packaging_speed_bps",
        "packaging_changeover_minutes",
        "packaging_calibration",
      ],
      simulation_effect: { effective_tick: 16, effective_elapsed_minutes: 240 },
    });
    expect(snapshot.control_catalog.find((control) => control.control_id === "packaging_speed_bps")).toMatchObject({
      unit: "basis_points_of_nameplate",
      domain: { minimum: 5_000, maximum: 10_000 },
      availability: { status: "HUMAN_LOCKED" },
    });
    expect(snapshot.control_catalog.find((control) => control.control_id === "supplier_mode")).toMatchObject({
      availability: { status: "PHASE_CLOSED", reason_code: "PRE_SHIFT_ONLY" },
    });
    expect(snapshot.scenario_workspace).toMatchObject({
      capacity: 2,
      occupied: 2,
      next_allocation: {
        status: "REPLACE_HISTORICAL_HEAD",
        marker: "A",
      },
    });
  });

  it("requires a clean scenario after an authority change and normalizes same-value writes", async () => {
    const store = await readyStore();
    const historical = createEmptyScenario(store);
    const beforeLock = store.getSnapshot();
    await store.togglePackagingLock();
    const locked = store.getSnapshot();

    try {
      store.applyScenarioChanges({
        request_id: "request-stale-authority-head",
        scenario_id: historical.scenario_id,
        expected_factory_revision: locked.factoryRevision,
        expected_scenario_revision: historical.scenario_revision,
        expected_lock_revision: locked.lockRevision,
        changes: { mixer_speed_bps: 9_500 },
      });
      throw new Error("Expected STALE_SCENARIO");
    } catch (error) {
      expect(error).toMatchObject({
        code: "STALE_SCENARIO",
        details: expect.objectContaining({
          committed: false,
          recovery: expect.objectContaining({ fresh_scenario_required: true }),
        }),
      });
    }

    const fresh = store.createScenario({
      request_id: "request-clean-authority-head",
      name: "Clean authority branch",
      factory_version_id: locked.factoryVersionId,
      expected_factory_revision: locked.factoryRevision,
      expected_lock_revision: locked.lockRevision,
    });
    const freshRecord = store.getSnapshot().scenarios.find((scenario) => scenario.id === fresh.scenario_id);
    expect(freshRecord).toMatchObject({
      patch: {},
      sourceFactoryRevision: locked.factoryRevision,
      sourceLockRevision: locked.lockRevision,
    });

    const noOp = store.applyScenarioChanges({
      request_id: "request-normalized-noop",
      scenario_id: fresh.scenario_id,
      expected_factory_revision: locked.factoryRevision,
      expected_scenario_revision: fresh.scenario_revision,
      expected_lock_revision: locked.lockRevision,
      changes: { supplier_mode: "standard" },
    });
    expect(noOp).toMatchObject({
      committed: false,
      outcome: "NO_OP",
      scenario_revision: fresh.scenario_revision,
      normalized_no_op_fields: ["supplier_mode"],
    });
    expect(store.getSnapshot().scenarios.find((scenario) => scenario.id === fresh.scenario_id)?.revision).toBe(fresh.scenario_revision);
    expect(beforeLock.factoryRevision).not.toBe(locked.factoryRevision);
  });

  it("reports a current unevaluated head separately from historical evidence", async () => {
    const store = await readyStore();
    store.reset();
    const created = createNextScenario(
      store,
      "request-current-unevaluated",
      "Current unevaluated",
    );

    expect(store.getScenarioSnapshot(created.scenario_id)).toMatchObject({
      authority_is_current: true,
      source_is_current: false,
      latest_run_id: null,
      currentness: {
        status: "CURRENT_UNEVALUATED",
        invalidated_by: [],
      },
    });
    expect(store.getFactorySnapshot().scenario_heads[0]).toMatchObject({
      currentness: { status: "CURRENT_UNEVALUATED", invalidated_by: [] },
    });
  });

  it("removes baseline-valued overrides and counts effective control differences", async () => {
    const store = await readyStore();
    store.reset();
    const first = createNextScenario(store, "request-effective-a", "Effective A");
    let state = store.getSnapshot();
    const raised = store.applyScenarioChanges({
      request_id: "request-effective-a-raise",
      scenario_id: first.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: first.scenario_revision,
      expected_lock_revision: state.lockRevision,
      changes: { warehouse_dock_units_per_hour: 1_000 },
    });
    state = store.getSnapshot();
    const restored = store.applyScenarioChanges({
      request_id: "request-effective-a-restore",
      scenario_id: first.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: raised.scenario_revision,
      expected_lock_revision: state.lockRevision,
      changes: { warehouse_dock_units_per_hour: 900 },
    });
    state = store.getSnapshot();
    const firstConfigured = store.applyScenarioChanges({
      request_id: "request-effective-a-configure",
      scenario_id: first.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: restored.scenario_revision,
      expected_lock_revision: state.lockRevision,
      changes: feasibleChanges,
    });
    expect(store.getSnapshot().scenarios.find(
      (scenario) => scenario.id === first.scenario_id,
    )?.patch).toEqual(feasibleChanges);
    const firstRun = await store.simulateScenarioVersion({
      request_id: "request-effective-a-run",
      scenario_id: first.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: firstConfigured.scenario_revision,
      expected_lock_revision: state.lockRevision,
      horizon_shifts: 1,
    });

    const second = createNextScenario(store, "request-effective-b", "Effective B");
    state = store.getSnapshot();
    const secondConfigured = store.applyScenarioChanges({
      request_id: "request-effective-b-configure",
      scenario_id: second.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: second.scenario_revision,
      expected_lock_revision: state.lockRevision,
      changes: feasibleChanges,
    });
    const secondRun = await store.simulateScenarioVersion({
      request_id: "request-effective-b-run",
      scenario_id: second.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: secondConfigured.scenario_revision,
      expected_lock_revision: state.lockRevision,
      horizon_shifts: 1,
    });

    const comparison = store.compareRunSet([firstRun.run_id, secondRun.run_id]);
    expect(comparison.best_evaluated_run_id).toBe(
      [firstRun.run_id, secondRun.run_id].sort()[0],
    );
    expect(store.getSnapshot().runEvidence[firstRun.run_id]?.patch).toEqual(
      feasibleChanges,
    );
    expect(store.getSnapshot().runEvidence[secondRun.run_id]?.patch).toEqual(
      feasibleChanges,
    );
  });

  it("rejects changed pre-shift controls before simulation after the modeled shift has started", async () => {
    const store = await readyStore();
    store.reset();
    await store.togglePackagingLock();
    const locked = store.getSnapshot();
    const fresh = store.createScenario({
      request_id: "request-phase-scenario",
      name: "Runtime-only recovery",
      factory_version_id: locked.factoryVersionId,
      expected_factory_revision: locked.factoryRevision,
      expected_lock_revision: locked.lockRevision,
    });

    expect(() => store.applyScenarioChanges({
      request_id: "request-phase-closed",
      scenario_id: fresh.scenario_id,
      expected_factory_revision: locked.factoryRevision,
      expected_scenario_revision: fresh.scenario_revision,
      expected_lock_revision: locked.lockRevision,
      changes: { supplier_mode: "expedite" },
    })).toThrowError(expect.objectContaining({ code: "PHASE_CLOSED" }));
  });

  it("returns complete stale-write recovery data without changing factory or scenario revisions", async () => {
    const store = await readyStore();
    const created = createEmptyScenario(store);
    const held = store.getSnapshot();
    await store.togglePackagingLock();
    const current = store.getSnapshot();
    const scenarioRevisionBefore = current.scenarios.find((scenario) => scenario.id === created.scenario_id)?.revision;

    try {
      store.applyScenarioChanges({
        request_id: "request-intentional-stale",
        scenario_id: created.scenario_id,
        expected_factory_revision: held.factoryRevision,
        expected_scenario_revision: created.scenario_revision,
        expected_lock_revision: held.lockRevision,
        changes: { mixer_speed_bps: 9_500 },
      });
      throw new Error("Expected STALE_FACTORY");
    } catch (error) {
      expect(error).toMatchObject({
        code: "STALE_FACTORY",
        details: expect.objectContaining({
          committed: false,
          audit_recorded: true,
          precondition_diff: {
            expected_factory_revision: held.factoryRevision,
            current_factory_revision: current.factoryRevision,
            expected_lock_revision: held.lockRevision,
            current_lock_revision: current.lockRevision,
          },
          recovery: expect.objectContaining({
            tool: "get_factory_snapshot",
            fresh_scenario_required: true,
          }),
        }),
      });
    }

    const after = store.getSnapshot();
    expect(after.factoryRevision).toBe(current.factoryRevision);
    expect(after.lockRevision).toBe(current.lockRevision);
    expect(after.scenarios.find((scenario) => scenario.id === created.scenario_id)?.revision).toBe(scenarioRevisionBefore);
    expect(after.ledger[0]).toMatchObject({
      label: "Stale write rejected",
      detail: expect.stringContaining("NO COMMIT"),
    });
  });

  it("bounds the visibility barrier when animation frames do not fire", async () => {
    vi.useFakeTimers();
    const animationFrame = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", animationFrame);

    try {
      const pending = new SandboxStore().awaitVisibleCommit();
      await vi.advanceTimersByTimeAsync(300);

      await expect(pending).resolves.toBeUndefined();
      expect(animationFrame).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("skips the visibility barrier when the document is hidden", async () => {
    const animationFrame = vi.fn(() => 1);
    vi.stubGlobal("document", { visibilityState: "hidden" });
    vi.stubGlobal("requestAnimationFrame", animationFrame);

    try {
      await expect(new SandboxStore().awaitVisibleCommit()).resolves.toBeUndefined();
      expect(animationFrame).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
