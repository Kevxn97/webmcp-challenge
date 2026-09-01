import { describe, expect, it } from "vitest";

import {
  createBaselineInput,
  simulateFactory,
  type FactoryOperation,
} from "../domain";
import {
  SCENARIO_CHANGES_SCHEMA,
  validateApplyScenarioChangesInput,
} from "../webmcp";
import {
  BASELINE_ENGINE_CONTROLS,
  BASELINE_SCENARIO_VALUES,
  CONTROL_DEFINITIONS,
  PACKAGING_CONTROL_FIELDS,
  PACKAGING_LOCK_EFFECTIVE_MINUTES,
  PACKAGING_LOCK_EFFECTIVE_TICK,
  SCENARIO_CONTROL_FIELDS,
  type ScenarioControlValueMap,
} from "./controlDefinitions";
import { TICK_MINUTES } from "./simulationContract";

const ALTERNATE_VALUES: ScenarioControlValueMap = {
  mixer_speed_bps: 9_500,
  packaging_speed_bps: 9_000,
  packaging_changeover_minutes: 15,
  packaging_calibration: "enhanced",
  supplier_mode: "expedite",
  quality_rate_units_per_hour: 900,
  warehouse_dock_units_per_hour: 1_000,
};

describe("canonical control definitions", () => {
  it("derives elapsed Packaging-lock time from the simulation tick duration", () => {
    expect(PACKAGING_LOCK_EFFECTIVE_MINUTES).toBe(
      PACKAGING_LOCK_EFFECTIVE_TICK * TICK_MINUTES,
    );
    expect(PACKAGING_LOCK_EFFECTIVE_MINUTES).toBe(240);
  });

  it("projects one registry into baseline controls, public schema, validation, and lock scope", () => {
    expect(createBaselineInput().controls).toEqual(BASELINE_ENGINE_CONTROLS);
    expect(Object.keys(BASELINE_SCENARIO_VALUES)).toEqual(
      SCENARIO_CONTROL_FIELDS,
    );
    expect(Object.keys(SCENARIO_CHANGES_SCHEMA.properties)).toEqual(
      SCENARIO_CONTROL_FIELDS,
    );
    expect(PACKAGING_CONTROL_FIELDS).toEqual(
      SCENARIO_CONTROL_FIELDS.filter(
        (field) => CONTROL_DEFINITIONS[field].resource === "Packaging",
      ),
    );

    const validation = validateApplyScenarioChangesInput({
      request_id: "registry-projection",
      scenario_id: "scenario-a",
      expected_factory_revision: 1,
      expected_scenario_revision: 1,
      expected_lock_revision: 0,
      changes: ALTERNATE_VALUES,
    });
    expect(validation.ok).toBe(true);
  });

  it("uses the registry operation mapping in the deterministic evaluator", async () => {
    const input = createBaselineInput();
    input.operations = SCENARIO_CONTROL_FIELDS.map((field) => {
      const definition = CONTROL_DEFINITIONS[field];
      return {
        operationId: `registry-${definition.operation.idSuffix}`,
        tick: 0,
        actor: "model",
        kind: definition.operation.kind,
        [definition.operation.valueKey]: ALTERNATE_VALUES[field],
      } as unknown as FactoryOperation;
    });

    const receipt = await simulateFactory(input);

    expect(receipt.rejectedOperations).toHaveLength(0);
    expect(receipt.acceptedOperations.map((operation) => operation.kind).sort())
      .toEqual(
        SCENARIO_CONTROL_FIELDS.map(
          (field) => CONTROL_DEFINITIONS[field].operation.kind,
        ).sort(),
      );
    for (const field of SCENARIO_CONTROL_FIELDS) {
      const definition = CONTROL_DEFINITIONS[field];
      expect(receipt.acceptedOperations.find(
        (operation) => operation.kind === definition.operation.kind,
      )).toMatchObject({ resource: definition.resource });
    }
  });
});
