import { describe, expect, it } from "vitest";

import {
  APPLY_SCENARIO_CHANGES_FIELDS,
  COMPARE_RUN_IDS_CONSTRAINTS,
  COMPARE_SIMULATION_RUNS_FIELDS,
  CREATE_SCENARIO_FIELDS,
  GET_FACTORY_SNAPSHOT_FIELDS,
  GET_SCENARIO_SNAPSHOT_FIELDS,
  PACKAGING_CALIBRATIONS,
  PACKAGING_CHANGEOVER_MINUTES,
  QUALITY_RATES_UNITS_PER_HOUR,
  REQUEST_ID_CONSTRAINTS,
  RESOURCE_ID_CONSTRAINTS,
  REVISION_CONSTRAINTS,
  RUN_FACTORY_SIMULATION_FIELDS,
  SCENARIO_CHANGES_MIN_PROPERTIES,
  SCENARIO_CHANGE_FIELDS,
  SCENARIO_CHANGE_REQUIRED_FIELDS,
  SCENARIO_NAME_CONSTRAINTS,
  SIMULATION_HORIZON_SHIFTS,
  SPEED_BPS_CONSTRAINTS,
  SUPPLIER_MODES,
  WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR,
} from "./contract-constants";
import {
  APPLY_SCENARIO_CHANGES_SCHEMA,
  COMPARE_SIMULATION_RUNS_SCHEMA,
  CREATE_SCENARIO_SCHEMA,
  GET_FACTORY_SNAPSHOT_SCHEMA,
  GET_SCENARIO_SNAPSHOT_SCHEMA,
  RUN_FACTORY_SIMULATION_SCHEMA,
  SCENARIO_CHANGES_SCHEMA,
} from "./schemas";
import {
  validateApplyScenarioChangesInput,
  validateCompareSimulationRunsInput,
  validateCreateScenarioInput,
  validateGetFactorySnapshotInput,
  validateGetScenarioSnapshotInput,
  validateRunFactorySimulationInput,
  type ValidationResult,
} from "./validation";

function unwrap<T>(result: ValidationResult<T>): T {
  if (!result.ok) {
    throw new Error(result.issues.join("\n"));
  }
  return result.value;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

describe("WebMCP schema and validator parity", () => {
  it("uses the canonical field sets for every closed object schema", () => {
    const cases = [
      [GET_FACTORY_SNAPSHOT_SCHEMA, GET_FACTORY_SNAPSHOT_FIELDS],
      [GET_SCENARIO_SNAPSHOT_SCHEMA, GET_SCENARIO_SNAPSHOT_FIELDS],
      [CREATE_SCENARIO_SCHEMA, CREATE_SCENARIO_FIELDS],
      [APPLY_SCENARIO_CHANGES_SCHEMA, APPLY_SCENARIO_CHANGES_FIELDS],
      [RUN_FACTORY_SIMULATION_SCHEMA, RUN_FACTORY_SIMULATION_FIELDS],
      [COMPARE_SIMULATION_RUNS_SCHEMA, COMPARE_SIMULATION_RUNS_FIELDS],
    ] as const;

    for (const [schema, fields] of cases) {
      expect(sorted(Object.keys(schema.properties))).toEqual(sorted(fields));
      expect(sorted(schema.required)).toEqual(sorted(fields));
      expect(schema.additionalProperties).toBe(false);
    }

    expect(sorted(Object.keys(SCENARIO_CHANGES_SCHEMA.properties))).toEqual(
      sorted(SCENARIO_CHANGE_FIELDS),
    );
    expect(sorted(SCENARIO_CHANGES_SCHEMA.required)).toEqual(
      sorted(SCENARIO_CHANGE_REQUIRED_FIELDS),
    );
  });

  it("projects canonical patterns, bounds, enums, and cardinalities into schemas", () => {
    expect(CREATE_SCENARIO_SCHEMA.properties.request_id).toMatchObject(
      REQUEST_ID_CONSTRAINTS,
    );
    expect(CREATE_SCENARIO_SCHEMA.properties.factory_version_id).toMatchObject(
      RESOURCE_ID_CONSTRAINTS,
    );
    expect(CREATE_SCENARIO_SCHEMA.properties.name).toMatchObject(
      SCENARIO_NAME_CONSTRAINTS,
    );
    expect(
      CREATE_SCENARIO_SCHEMA.properties.expected_factory_revision,
    ).toMatchObject(REVISION_CONSTRAINTS);
    expect(SCENARIO_CHANGES_SCHEMA.properties.mixer_speed_bps).toMatchObject(
      SPEED_BPS_CONSTRAINTS,
    );
    expect(
      SCENARIO_CHANGES_SCHEMA.properties.packaging_changeover_minutes,
    ).toMatchObject({ enum: PACKAGING_CHANGEOVER_MINUTES });
    expect(
      SCENARIO_CHANGES_SCHEMA.properties.packaging_calibration,
    ).toMatchObject({ enum: PACKAGING_CALIBRATIONS });
    expect(SCENARIO_CHANGES_SCHEMA.properties.supplier_mode).toMatchObject({
      enum: SUPPLIER_MODES,
    });
    expect(
      SCENARIO_CHANGES_SCHEMA.properties.quality_rate_units_per_hour,
    ).toMatchObject({ enum: QUALITY_RATES_UNITS_PER_HOUR });
    expect(
      SCENARIO_CHANGES_SCHEMA.properties.warehouse_dock_units_per_hour,
    ).toMatchObject({ enum: WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR });
    expect(SCENARIO_CHANGES_SCHEMA.minProperties).toBe(
      SCENARIO_CHANGES_MIN_PROPERTIES,
    );
    expect(RUN_FACTORY_SIMULATION_SCHEMA.properties.horizon_shifts).toMatchObject({
      enum: SIMULATION_HORIZON_SHIFTS,
    });
    expect(COMPARE_SIMULATION_RUNS_SCHEMA.properties.run_ids).toMatchObject(
      COMPARE_RUN_IDS_CONSTRAINTS,
    );
  });

  it("accepts nameplate speed at 10000 bps and rejects 10001 before the command bus", () => {
    const base = {
      request_id: "req.speed.boundary",
      scenario_id: "scenario-a",
      expected_factory_revision: 1,
      expected_scenario_revision: 1,
      expected_lock_revision: 0,
    };
    expect(validateApplyScenarioChangesInput({
      ...base,
      changes: { mixer_speed_bps: 10_000, packaging_speed_bps: 10_000 },
    }).ok).toBe(true);
    expect(validateApplyScenarioChangesInput({
      ...base,
      changes: { mixer_speed_bps: 10_001 },
    }).ok).toBe(false);
  });
});

describe("WebMCP validator reconstruction", () => {
  it("returns new clean DTOs for all six tool inputs", () => {
    const factorySource: Record<string, never> = {};
    const scenarioSource = { scenario_id: "scenario-b" };
    const createSource = {
      request_id: "req.create.clean",
      name: "Scenario Clean",
      factory_version_id: "factory-v7",
      expected_factory_revision: 7,
      expected_lock_revision: 3,
    };
    const changesSource = {
      mixer_speed_bps: 10_000,
      packaging_changeover_minutes: 15,
      packaging_calibration: "enhanced",
      supplier_mode: "standard",
      quality_rate_units_per_hour: 800,
      warehouse_dock_units_per_hour: 900,
    };
    const applySource = {
      request_id: "req.apply.clean",
      scenario_id: "scenario-b",
      expected_factory_revision: 7,
      expected_scenario_revision: 2,
      expected_lock_revision: 3,
      changes: changesSource,
    };
    const runSource = {
      request_id: "req.run.clean",
      scenario_id: "scenario-b",
      expected_factory_revision: 7,
      expected_scenario_revision: 2,
      expected_lock_revision: 3,
      horizon_shifts: 1,
    };
    const runIdsSource = ["run-a", "run-b"];
    const compareSource = { run_ids: runIdsSource };

    const factory = unwrap(validateGetFactorySnapshotInput(factorySource));
    const scenario = unwrap(validateGetScenarioSnapshotInput(scenarioSource));
    const create = unwrap(validateCreateScenarioInput(createSource));
    const apply = unwrap(validateApplyScenarioChangesInput(applySource));
    const run = unwrap(validateRunFactorySimulationInput(runSource));
    const compare = unwrap(validateCompareSimulationRunsInput(compareSource));

    expect(factory).not.toBe(factorySource);
    expect(scenario).not.toBe(scenarioSource);
    expect(create).not.toBe(createSource);
    expect(apply).not.toBe(applySource);
    expect(apply.changes).not.toBe(changesSource);
    expect(run).not.toBe(runSource);
    expect(compare).not.toBe(compareSource);
    expect(compare.run_ids).not.toBe(runIdsSource);
    expect(Object.getPrototypeOf(compare.run_ids)).toBe(Array.prototype);
    expect(Object.isFrozen(factory)).toBe(true);
    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(create)).toBe(true);
    expect(Object.isFrozen(apply)).toBe(true);
    expect(Object.isFrozen(apply.changes)).toBe(true);
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(compare)).toBe(true);
    expect(Object.isFrozen(compare.run_ids)).toBe(true);

    scenarioSource.scenario_id = "scenario-mutated";
    createSource.name = "Mutated";
    changesSource.mixer_speed_bps = 5_000;
    runSource.expected_factory_revision = 99;
    runIdsSource[0] = "run-mutated";

    expect(scenario.scenario_id).toBe("scenario-b");
    expect(create.name).toBe("Scenario Clean");
    expect(apply.changes.mixer_speed_bps).toBe(10_000);
    expect(run.expected_factory_revision).toBe(7);
    expect(compare.run_ids).toEqual(["run-a", "run-b"]);
    expect(Object.values(apply.changes).every((value) =>
      ["string", "number", "boolean"].includes(typeof value),
    )).toBe(true);
  });

  it("snapshots each allowed data property once", () => {
    const source = {
      request_id: "req.create.snapshot",
      name: "Stable Name",
      factory_version_id: "factory-v7",
      expected_factory_revision: 7,
      expected_lock_revision: 3,
    };
    let nameDescriptorReads = 0;
    const changingDescriptor = new Proxy(source, {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key !== "name" || !descriptor || !("value" in descriptor)) {
          return descriptor;
        }
        nameDescriptorReads += 1;
        return {
          ...descriptor,
          value: nameDescriptorReads === 1 ? "Stable Name" : "Changed Name",
        };
      },
    });

    const result = unwrap(validateCreateScenarioInput(changingDescriptor));

    expect(nameDescriptorReads).toBe(1);
    expect(result.name).toBe("Stable Name");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects accessors without invoking their getters", () => {
    let getterCalls = 0;
    const source = {
      request_id: "req.create.accessor",
      factory_version_id: "factory-v7",
      expected_factory_revision: 7,
      expected_lock_revision: 3,
    } as Record<string, unknown>;
    Object.defineProperty(source, "name", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1 ? "First Name" : "Changed Name";
      },
    });

    const result = validateCreateScenarioInput(source);

    expect(result.ok).toBe(false);
    expect(getterCalls).toBe(0);
    if (!result.ok) {
      expect(result.issues).toContain(
        "input.name must be an enumerable data property.",
      );
    }
  });

  it("rejects accessor array elements without invoking their getters", () => {
    let getterCalls = 0;
    const runIds = ["run-a", "run-b"];
    Object.defineProperty(runIds, "0", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1 ? "run-a" : "run-mutated";
      },
    });

    const result = validateCompareSimulationRunsInput({ run_ids: runIds });

    expect(result.ok).toBe(false);
    expect(getterCalls).toBe(0);
    if (!result.ok) {
      expect(result.issues).toContain(
        "input.run_ids[0] must be an enumerable data property.",
      );
    }
  });
});

describe("WebMCP identifier boundaries", () => {
  const createInput = (requestId: string) => ({
    request_id: requestId,
    name: "Boundary Scenario",
    factory_version_id: "factory-v7",
    expected_factory_revision: 7,
    expected_lock_revision: 3,
  });

  it("accepts request identifiers at both exact length boundaries", () => {
    expect(validateCreateScenarioInput(createInput("r")).ok).toBe(true);
    expect(
      validateCreateScenarioInput(
        createInput("r".repeat(REQUEST_ID_CONSTRAINTS.maxLength)),
      ).ok,
    ).toBe(true);
  });

  it("rejects request identifiers outside bounds or outside the pattern", () => {
    expect(validateCreateScenarioInput(createInput("")).ok).toBe(false);
    expect(
      validateCreateScenarioInput(
        createInput("r".repeat(REQUEST_ID_CONSTRAINTS.maxLength + 1)),
      ).ok,
    ).toBe(false);
    expect(validateCreateScenarioInput(createInput("request/id")).ok).toBe(
      false,
    );
  });

  it("accepts resource identifiers at both exact length boundaries", () => {
    expect(validateGetScenarioSnapshotInput({ scenario_id: "s" }).ok).toBe(true);
    expect(
      validateGetScenarioSnapshotInput({
        scenario_id: "s".repeat(RESOURCE_ID_CONSTRAINTS.maxLength),
      }).ok,
    ).toBe(true);
  });

  it("rejects resource identifiers outside bounds or outside the pattern", () => {
    expect(validateGetScenarioSnapshotInput({ scenario_id: "" }).ok).toBe(false);
    expect(
      validateGetScenarioSnapshotInput({
        scenario_id: "s".repeat(RESOURCE_ID_CONSTRAINTS.maxLength + 1),
      }).ok,
    ).toBe(false);
    expect(validateGetScenarioSnapshotInput({ scenario_id: "scenario/id" }).ok).toBe(
      false,
    );
  });
});
