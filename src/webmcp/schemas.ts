import type { JsonSchema } from "./contracts";

const REQUEST_ID_PROPERTY = {
  type: "string" as const,
  description: "Unique idempotency key for this write request.",
  minLength: 1,
  maxLength: 64,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$",
};

const RESOURCE_ID_PROPERTY = (description: string) => ({
  type: "string" as const,
  description,
  minLength: 1,
  maxLength: 80,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$",
});

const REVISION_PROPERTY = (description: string) => ({
  type: "integer" as const,
  description,
  minimum: 0,
  maximum: 2_147_483_647,
});

export const GET_FACTORY_SNAPSHOT_SCHEMA = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const GET_SCENARIO_SNAPSHOT_SCHEMA = {
  type: "object",
  properties: {
    scenario_id: RESOURCE_ID_PROPERTY("Scenario identifier to inspect."),
  },
  required: ["scenario_id"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const CREATE_SCENARIO_SCHEMA = {
  type: "object",
  properties: {
    request_id: REQUEST_ID_PROPERTY,
    name: {
      type: "string",
      description: "Human-readable scenario name.",
      minLength: 1,
      maxLength: 48,
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
  required: [
    "request_id",
    "name",
    "factory_version_id",
    "expected_factory_revision",
    "expected_lock_revision",
  ],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const SCENARIO_CHANGES_SCHEMA = {
  type: "object",
  description:
    "Absolute scenario settings. Omitted settings remain unchanged; at least one setting is required.",
  properties: {
    mixer_speed_bps: {
      type: "integer",
      description: "Mixer speed as basis points of baseline (10000 = 100%).",
      minimum: 5_000,
      maximum: 15_000,
    },
    packaging_speed_bps: {
      type: "integer",
      description: "Packaging speed as basis points of baseline (10000 = 100%).",
      minimum: 5_000,
      maximum: 15_000,
    },
    packaging_changeover_minutes: {
      type: "integer",
      description: "Packaging changeover duration in minutes.",
      enum: [15, 30, 45],
    },
    packaging_calibration: {
      type: "string",
      description: "Packaging calibration mode.",
      enum: ["standard", "enhanced"],
    },
    supplier_mode: {
      type: "string",
      description: "Supplier service mode.",
      enum: ["standard", "expedite"],
    },
    quality_rate_units_per_hour: {
      type: "integer",
      description: "Quality-gate inspection capacity in units per hour.",
      enum: [600, 700, 800, 900],
    },
    warehouse_dock_units_per_hour: {
      type: "integer",
      description: "Warehouse dock capacity in units per hour.",
      enum: [800, 900, 1000],
    },
  },
  required: [],
  additionalProperties: false,
  minProperties: 1,
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
  required: [
    "request_id",
    "scenario_id",
    "expected_factory_revision",
    "expected_scenario_revision",
    "expected_lock_revision",
    "changes",
  ],
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
      enum: [1],
    },
  },
  required: [
    "request_id",
    "scenario_id",
    "expected_factory_revision",
    "expected_scenario_revision",
    "expected_lock_revision",
    "horizon_shifts",
  ],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const COMPARE_SIMULATION_RUNS_SCHEMA = {
  type: "object",
  properties: {
    run_ids: {
      type: "array",
      description: "Two to four simulation run identifiers to compare.",
      items: RESOURCE_ID_PROPERTY("Simulation run identifier."),
      minItems: 2,
      maxItems: 4,
      uniqueItems: true,
    },
  },
  required: ["run_ids"],
  additionalProperties: false,
} as const satisfies JsonSchema;
