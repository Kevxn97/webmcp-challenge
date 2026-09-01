import { CONTROL_DEFINITIONS, SCENARIO_CONTROL_FIELDS, type ScenarioControlField } from "../shared/controlDefinitions";
import type { JsonSchema, JsonSchemaProperty } from "./contracts";
import {
  APPLY_SCENARIO_CHANGES_FIELDS,
  COMPARE_RUN_IDS_CONSTRAINTS,
  COMPARE_SIMULATION_RUNS_FIELDS,
  CREATE_SCENARIO_FIELDS,
  GET_FACTORY_SNAPSHOT_FIELDS,
  GET_SCENARIO_SNAPSHOT_FIELDS,
  REQUEST_ID_CONSTRAINTS,
  RESOURCE_ID_CONSTRAINTS,
  REVISION_CONSTRAINTS,
  RUN_FACTORY_SIMULATION_FIELDS,
  SCENARIO_CHANGES_MIN_PROPERTIES,
  SCENARIO_CHANGE_REQUIRED_FIELDS,
  SCENARIO_NAME_CONSTRAINTS,
  SIMULATION_HORIZON_SHIFTS,
} from "./contract-constants";

export const SCENARIO_NAME_PATTERN_SOURCE =
  SCENARIO_NAME_CONSTRAINTS.pattern;

const REQUEST_ID_PROPERTY = {
  type: "string" as const,
  description: "Unique idempotency key for this write request.",
  ...REQUEST_ID_CONSTRAINTS,
};

const RESOURCE_ID_PROPERTY = (description: string) => ({
  type: "string" as const,
  description,
  ...RESOURCE_ID_CONSTRAINTS,
});

const REVISION_PROPERTY = (description: string) => ({
  type: "integer" as const,
  description,
  ...REVISION_CONSTRAINTS,
});

const SCENARIO_CHANGE_PROPERTIES = Object.fromEntries(
  SCENARIO_CONTROL_FIELDS.map((field) => {
    const definition = CONTROL_DEFINITIONS[field];
    const property: JsonSchemaProperty = definition.domain.type === "range"
      ? {
          type: "integer",
          description: definition.description,
          minimum: definition.domain.minimum,
          maximum: definition.domain.maximum,
        }
      : typeof definition.domain.values[0] === "number"
        ? {
            type: "integer",
            description: definition.description,
            enum: definition.domain.values as readonly number[],
          }
        : {
            type: "string",
            description: definition.description,
            enum: definition.domain.values as readonly string[],
          };
    return [field, property];
  }),
) as Record<ScenarioControlField, JsonSchemaProperty>;

export const GET_FACTORY_SNAPSHOT_SCHEMA = {
  type: "object",
  properties: {},
  required: GET_FACTORY_SNAPSHOT_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;

export const GET_SCENARIO_SNAPSHOT_SCHEMA = {
  type: "object",
  properties: {
    scenario_id: RESOURCE_ID_PROPERTY("Scenario identifier to inspect."),
  },
  required: GET_SCENARIO_SNAPSHOT_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;

export const CREATE_SCENARIO_SCHEMA = {
  type: "object",
  properties: {
    request_id: REQUEST_ID_PROPERTY,
    name: {
      type: "string",
      description: "Human-readable scenario name.",
      ...SCENARIO_NAME_CONSTRAINTS,
    },
    factory_version_id: RESOURCE_ID_PROPERTY(
      "Immutable factory version used as the scenario base.",
    ),
    expected_factory_revision: REVISION_PROPERTY(
      "Factory revision observed before creating the scenario.",
    ),
    expected_lock_revision: REVISION_PROPERTY(
      "Human-lock revision observed before creating the scenario.",
    ),
  },
  required: CREATE_SCENARIO_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;

export const SCENARIO_CHANGES_SCHEMA = {
  type: "object",
  description:
    "Absolute scenario settings. Omitted settings remain unchanged; at least one setting is required.",
  properties: SCENARIO_CHANGE_PROPERTIES,
  required: SCENARIO_CHANGE_REQUIRED_FIELDS,
  additionalProperties: false,
  minProperties: SCENARIO_CHANGES_MIN_PROPERTIES,
} as const satisfies JsonSchema & { description: string };

export const APPLY_SCENARIO_CHANGES_SCHEMA = {
  type: "object",
  properties: {
    request_id: REQUEST_ID_PROPERTY,
    scenario_id: RESOURCE_ID_PROPERTY("Scenario identifier to update."),
    expected_factory_revision: REVISION_PROPERTY(
      "Factory revision observed before applying changes.",
    ),
    expected_scenario_revision: REVISION_PROPERTY(
      "Scenario revision observed before applying changes.",
    ),
    expected_lock_revision: REVISION_PROPERTY(
      "Human-lock revision observed before applying changes.",
    ),
    changes: SCENARIO_CHANGES_SCHEMA,
  },
  required: APPLY_SCENARIO_CHANGES_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;

export const RUN_FACTORY_SIMULATION_SCHEMA = {
  type: "object",
  properties: {
    request_id: REQUEST_ID_PROPERTY,
    scenario_id: RESOURCE_ID_PROPERTY("Scenario identifier to simulate."),
    expected_factory_revision: REVISION_PROPERTY(
      "Factory revision observed before starting the run.",
    ),
    expected_scenario_revision: REVISION_PROPERTY(
      "Scenario revision observed before starting the run.",
    ),
    expected_lock_revision: REVISION_PROPERTY(
      "Human-lock revision observed before starting the run.",
    ),
    horizon_shifts: {
      type: "integer",
      description: "One deterministic 16-hour simulation shift (64 ticks).",
      enum: SIMULATION_HORIZON_SHIFTS,
    },
  },
  required: RUN_FACTORY_SIMULATION_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;

export const COMPARE_SIMULATION_RUNS_SCHEMA = {
  type: "object",
  properties: {
    run_ids: {
      type: "array",
      description: "Two to four stored run identifiers. The first item is the anchor; every reported delta is candidate minus anchor.",
      items: RESOURCE_ID_PROPERTY("Simulation run identifier."),
      ...COMPARE_RUN_IDS_CONSTRAINTS,
    },
  },
  required: COMPARE_SIMULATION_RUNS_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;
