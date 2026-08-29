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

describe("SandboxStore", () => {
  it("hydrates a receipt-backed showcase and marks prior scenarios stale after the human lock", async () => {
    const store = await readyStore();
    const state = store.getSnapshot();
    const view = createBlueprintViewModel(state);

    expect(state.baselineReceipt?.rawCounters.goodOutputUnits).toBe(9_114);
    expect(state.packagingLocked).toBe(true);
    expect(state.lockRevision).toBe(1);
    expect(view.scenarios.find((scenario) => scenario.marker === "A")?.status).toBe("STALE");
    expect(view.scenarios.find((scenario) => scenario.marker === "B")?.status).toBe("STALE");
    expect(view.scenarios.find((scenario) => scenario.marker === "B")?.engineVersion).toBe("factory-engine/1.0.0");
    expect(view.checks.find((check) => check.id === "COST_8")?.scenarioAPass).toBe(false);
    expect(view.checks.every((check) => check.scenarioBPass === true)).toBe(true);
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
    const created = createEmptyScenario(store);
    await store.togglePackagingLock();
    const locked = store.getSnapshot();
    const revisionBefore = locked.scenarios.find((scenario) => scenario.id === created.scenario_id)?.revision;

    expect(() => store.applyScenarioChanges({
      request_id: "request-locked-change",
      scenario_id: created.scenario_id,
      expected_factory_revision: locked.factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: locked.lockRevision,
      changes: { packaging_speed_bps: 9_000 },
    })).toThrowError(SandboxCommandError);

    try {
      store.applyScenarioChanges({
        request_id: "request-locked-change-2",
        scenario_id: created.scenario_id,
        expected_factory_revision: locked.factoryRevision,
        expected_scenario_revision: created.scenario_revision,
        expected_lock_revision: locked.lockRevision,
        changes: { packaging_speed_bps: 9_000 },
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "HUMAN_LOCKED" });
    }
    expect(store.getSnapshot().scenarios.find((scenario) => scenario.id === created.scenario_id)?.revision).toBe(revisionBefore);
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

  it("keeps the live comparison usable by archiving the non-selected showcase slot", async () => {
    const store = await readyStore();
    const snapshot = store.getSnapshot();
    const created = store.createScenario({
      request_id: "request-replace-showcase",
      name: "Fresh agent plan",
      factory_version_id: snapshot.factoryVersionId,
      expected_factory_revision: snapshot.factoryRevision,
      expected_lock_revision: snapshot.lockRevision,
    });

    expect(created.archived_scenario_id).toBe("scenario-a");
    expect(store.getSnapshot().scenarios).toHaveLength(2);
    expect(store.getSnapshot().scenarios.find((scenario) => scenario.id === created.scenario_id)).toMatchObject({
      name: "Fresh agent plan",
      patch: {},
      receipt: null,
      receiptScenarioRevision: null,
      receiptLockRevision: null,
    });
    expect(store.getSnapshot().runs[snapshot.scenarios[0]?.receipt?.runId ?? "missing"]).toBeDefined();
  });

  it("produces a deterministic lock-bound proof after a human Packaging constraint", async () => {
    const store = await readyStore();
    const created = createEmptyScenario(store);
    await store.togglePackagingLock();
    const locked = store.getSnapshot();

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
