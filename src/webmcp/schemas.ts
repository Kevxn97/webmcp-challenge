import type { JsonSchema, JsonSchemaProperty } from "./contracts";
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

const SCENARIO_CHANGE_PROPERTIES = {
  mixer_speed_bps: {
    type: "integer",
    description: "Mixer speed as basis points of equipment nameplate (10000 = 100%).",
    ...SPEED_BPS_CONSTRAINTS,
  },
  packaging_speed_bps: {
    type: "integer",
    description: "Packaging speed as basis points of equipment nameplate (10000 = 100%).",
    ...SPEED_BPS_CONSTRAINTS,
  },
  packaging_changeover_minutes: {
    type: "integer",
    description: "Packaging changeover duration in minutes.",
    enum: PACKAGING_CHANGEOVER_MINUTES,
  },
  packaging_calibration: {
    type: "string",
    description: "Packaging calibration mode.",
    enum: PACKAGING_CALIBRATIONS,
  },
  supplier_mode: {
    type: "string",
    description: "Supplier service mode.",
    enum: SUPPLIER_MODES,
  },
  quality_rate_units_per_hour: {
    type: "integer",
    description: "Quality-gate inspection capacity in units per hour.",
    enum: QUALITY_RATES_UNITS_PER_HOUR,
  },
  warehouse_dock_units_per_hour: {
    type: "integer",
    description: "Warehouse dock capacity in units per hour.",
    enum: WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR,
  },
} as const satisfies Record<
  (typeof SCENARIO_CHANGE_FIELDS)[number],
  JsonSchemaProperty
>;

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
      description: "Two to four simulation run identifiers to compare.",
      items: RESOURCE_ID_PROPERTY("Simulation run identifier."),
      ...COMPARE_RUN_IDS_CONSTRAINTS,
    },
  },
  required: COMPARE_SIMULATION_RUNS_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;
