import { describe, expect, it } from "vitest";

import { describeProof } from "./EvidenceDialog";
import type { ScenarioView } from "./types";

function proofScenario(overrides: Partial<ScenarioView["infeasibilityProof"]> = {}, status: ScenarioView["status"] = "PROVEN INFEASIBLE"): ScenarioView {
  return {
    id: "scenario-proof",
    marker: "B",
    name: "Proof scenario",
    status,
    tone: status === "STALE" ? "stale" : "danger",
    sourceCurrent: status !== "STALE",
    historicalReason: status === "STALE" ? "AUTHORITY_EPOCH_CHANGED" : null,
    revision: 1,
    receiptId: "factory-run-proof",
    engineVersion: "factory-engine/1.0.0",
    infeasibilityProof: {
      proofVersion: "factory-lock-upper-bound/v1",
      method: "PACKAGING_LOCK_CAPACITY_WITH_DEFECT_CASE_SPLIT",
      goodOutputUpperBound: 9_252,
      targetGoodOutputUnits: 10_937,
      exactInequality: "9252 < 10937",
      proven: true,
      sourceCurrent: true,
      ...overrides,
    },
    runnable: true,
    branchable: true,
    metrics: {
      output: "9,114",
      outputDelta: "+0.0%",
      cost: "€43.8k",
      costDelta: "+1.3%",
      defectRate: "2.00%",
      defectDelta: "+0.00%",
      machineAdditions: "0",
    },
    violations: ["OUTPUT_20"],
  };
}

describe("evidence proof presentation", () => {
  it("labels a current proven bound as conclusive", () => {
    expect(describeProof(proofScenario())).toMatchObject({
      tone: "conclusive",
      title: "Mission proven infeasible under the human lock",
      comparison: "9252 < 10937",
    });
  });

  it("labels a current high-capacity bound as inconclusive", () => {
    expect(describeProof(proofScenario({
      goodOutputUpperBound: 12_348,
      exactInequality: "12348 < 10937",
      proven: false,
    }, "FAILED"))).toMatchObject({
      tone: "inconclusive",
      title: "The bound does not prove infeasibility",
      comparison: "12348 ≥ 10937",
    });
  });

  it("labels a proven receipt from an old lock revision as historical", () => {
    expect(describeProof(proofScenario({ sourceCurrent: false }, "STALE"))).toMatchObject({
      tone: "historical",
      title: "Receipt is stale under the current factory state",
      comparison: "9252 < 10937",
    });
  });
});
