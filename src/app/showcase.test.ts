import { describe, expect, it } from "vitest";

import { buildDecisionPacket } from "./decisionPacket";
import { SandboxStore } from "./store";
import { createBlueprintViewModel } from "./viewModel";

describe("completed landing showcase", () => {
  it("shows historical evidence plus a current clean recovery proof", async () => {
    const store = new SandboxStore();
    await store.hydrateShowcase();

    const state = store.getSnapshot();
    const model = createBlueprintViewModel(state);
    const current = state.scenarios.find((scenario) =>
      scenario.sourceLockRevision === state.lockRevision
      && scenario.receiptLockRevision === state.lockRevision,
    );
    const historical = state.scenarios.find((scenario) =>
      scenario.sourceLockRevision !== state.lockRevision,
    );

    expect(state.packagingLocked).toBe(true);
    expect(historical?.receipt).not.toBeNull();
    expect(current).toMatchObject({
      name: "Scenario B · post-lock recovery",
      patch: { mixer_speed_bps: 9_500 },
      sourceFactoryRevision: state.factoryRevision,
      sourceLockRevision: state.lockRevision,
      receiptScenarioRevision: 2,
      receiptLockRevision: state.lockRevision,
    });
    expect(current?.receipt?.upperBoundProof).toMatchObject({
      exactInequality: "9252 < 10937",
      proven: true,
    });
    expect(model.scenarios.find((scenario) => scenario.id === current?.id)).toMatchObject({
      status: "PROVEN INFEASIBLE",
      sourceCurrent: true,
    });
    expect(model.scenarios.find((scenario) => scenario.id === historical?.id)).toMatchObject({
      status: "STALE",
      sourceCurrent: false,
    });
    expect(state.ledger.map((event) => event.label)).toEqual(expect.arrayContaining([
      "Scenario B feasible",
      "Locked Packaging",
      "Stale write rejected",
      "Created post-lock recovery",
      "Current proof stored",
    ]));

    const packet = buildDecisionPacket(state);
    expect(JSON.parse(packet!.json)).toMatchObject({
      decision: {
        status: "PROVEN_INFEASIBLE_UNDER_HUMAN_AUTHORITY",
        proof: "9252 < 10937",
      },
    });
  });
});
