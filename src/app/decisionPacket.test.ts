import { describe, expect, it } from "vitest";

import { buildDecisionPacket } from "./decisionPacket";
import { SandboxStore } from "./store";

async function readyStore() {
  const store = new SandboxStore();
  await store.hydrateShowcase();
  store.reset();
  return store;
}

describe("decision packet", () => {
  it("exports a receipt-backed best-evaluated decision without claiming global optimality", async () => {
    const store = await readyStore();
    const snapshot = store.getSnapshot();
    const scenario = store.createScenario({
      request_id: "packet-create-feasible",
      name: "Scenario B · constrained",
      factory_version_id: snapshot.factoryVersionId,
      expected_factory_revision: snapshot.factoryRevision,
      expected_lock_revision: snapshot.lockRevision,
    });
    const revised = store.applyScenarioChanges({
      request_id: "packet-apply-feasible",
      scenario_id: scenario.scenario_id,
      expected_factory_revision: snapshot.factoryRevision,
      expected_scenario_revision: scenario.scenario_revision,
      expected_lock_revision: snapshot.lockRevision,
      changes: {
        mixer_speed_bps: 9_500,
        packaging_speed_bps: 9_000,
        packaging_changeover_minutes: 15,
        packaging_calibration: "enhanced",
      },
    });
    await store.simulateScenarioVersion({
      request_id: "packet-run-feasible",
      scenario_id: scenario.scenario_id,
      expected_factory_revision: snapshot.factoryRevision,
      expected_scenario_revision: revised.scenario_revision,
      expected_lock_revision: snapshot.lockRevision,
      horizon_shifts: 1,
    });

    const packet = buildDecisionPacket(store.getSnapshot());
    expect(packet).not.toBeNull();
    const json = JSON.parse(packet!.json) as {
      decision: { status: string; statement: string };
      evidence: Array<{ good_output_units: number; source_is_current: boolean }>;
    };
    expect(json.decision.status).toBe("BEST_EVALUATED_UNDER_POLICY");
    expect(json.decision.statement).toContain("not a global optimality claim");
    expect(json.evidence).toEqual([
      expect.objectContaining({ good_output_units: 11_114, source_is_current: true }),
    ]);
    expect(packet!.markdown).toContain("11,114 units");
    expect(packet!.markdown).toContain("No model-generated operational metrics");
  });

  it("exports the current human authority and exact infeasibility proof after clean recovery", async () => {
    const store = await readyStore();
    const beforeLock = store.getSnapshot();
    store.createScenario({
      request_id: "packet-create-historical",
      name: "Historical plan",
      factory_version_id: beforeLock.factoryVersionId,
      expected_factory_revision: beforeLock.factoryRevision,
      expected_lock_revision: beforeLock.lockRevision,
    });
    await store.togglePackagingLock();
    const locked = store.getSnapshot();
    const fresh = store.createScenario({
      request_id: "packet-create-locked",
      name: "Post-lock recovery",
      factory_version_id: locked.factoryVersionId,
      expected_factory_revision: locked.factoryRevision,
      expected_lock_revision: locked.lockRevision,
    });
    const revised = store.applyScenarioChanges({
      request_id: "packet-apply-locked",
      scenario_id: fresh.scenario_id,
      expected_factory_revision: locked.factoryRevision,
      expected_scenario_revision: fresh.scenario_revision,
      expected_lock_revision: locked.lockRevision,
      changes: { mixer_speed_bps: 9_500 },
    });
    await store.simulateScenarioVersion({
      request_id: "packet-run-locked",
      scenario_id: fresh.scenario_id,
      expected_factory_revision: locked.factoryRevision,
      expected_scenario_revision: revised.scenario_revision,
      expected_lock_revision: locked.lockRevision,
      horizon_shifts: 1,
    });

    const packet = buildDecisionPacket(store.getSnapshot());
    const json = JSON.parse(packet!.json) as {
      authority: { packaging_locked: boolean; simulation_effect: { effective_tick: number; effective_elapsed_minutes: number } };
      decision: { status: string; proof: string };
    };
    expect(json.authority).toMatchObject({
      packaging_locked: true,
      simulation_effect: { effective_tick: 16, effective_elapsed_minutes: 240 },
    });
    expect(json.decision).toMatchObject({
      status: "PROVEN_INFEASIBLE_UNDER_HUMAN_AUTHORITY",
      proof: "9252 < 10937",
    });
    expect(packet!.markdown).toContain("9252 < 10937");
    expect(packet!.markdown).toContain("Packaging locked by human");
  });
});
