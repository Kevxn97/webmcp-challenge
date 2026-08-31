import { SPEED_BPS_MAX, SPEED_BPS_MIN } from "../shared/controlDefinitions";

export const REQUEST_ID_CONSTRAINTS = {
  minLength: 1,
  maxLength: 64,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
} as const;

export const RESOURCE_ID_CONSTRAINTS = {
  minLength: 1,
  maxLength: 80,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
} as const;

export const SCENARIO_NAME_CONSTRAINTS = {
  minLength: 1,
  maxLength: 48,
  pattern: "^(?!\\s)(?![\\s\\S]*\\s$)[^\\u0000-\\u001F\\u007F]+$",
} as const;

export const REVISION_CONSTRAINTS = {
  minimum: 0,
  maximum: 2_147_483_647,
} as const;

export const SPEED_BPS_CONSTRAINTS = {
  minimum: SPEED_BPS_MIN,
  maximum: SPEED_BPS_MAX,
} as const;

export const PACKAGING_CHANGEOVER_MINUTES = [15, 30, 45] as const;
export const PACKAGING_CALIBRATIONS = ["standard", "enhanced"] as const;
export const SUPPLIER_MODES = ["standard", "expedite"] as const;
export const QUALITY_RATES_UNITS_PER_HOUR = [600, 700, 800, 900] as const;
export const WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR = [800, 900, 1000] as const;
export const SIMULATION_HORIZON_SHIFTS = [1] as const;

export const COMPARE_RUN_IDS_CONSTRAINTS = {
  minItems: 2,
  maxItems: 4,
  uniqueItems: true,
} as const;

export const GET_FACTORY_SNAPSHOT_FIELDS = [] as const;
export const GET_SCENARIO_SNAPSHOT_FIELDS = ["scenario_id"] as const;
export const CREATE_SCENARIO_FIELDS = [
  "request_id",
  "name",
  "factory_version_id",
  "expected_factory_revision",
  "expected_lock_revision",
] as const;
export const SCENARIO_CHANGE_FIELDS = [
  "mixer_speed_bps",
  "packaging_speed_bps",
  "packaging_changeover_minutes",
  "packaging_calibration",
  "supplier_mode",
  "quality_rate_units_per_hour",
  "warehouse_dock_units_per_hour",
] as const;
export const SCENARIO_CHANGE_REQUIRED_FIELDS = [] as const;
export const APPLY_SCENARIO_CHANGES_FIELDS = [
  "request_id",
  "scenario_id",
  "expected_factory_revision",
  "expected_scenario_revision",
  "expected_lock_revision",
  "changes",
] as const;
export const RUN_FACTORY_SIMULATION_FIELDS = [
  "request_id",
  "scenario_id",
  "expected_factory_revision",
  "expected_scenario_revision",
  "expected_lock_revision",
  "horizon_shifts",
] as const;
export const COMPARE_SIMULATION_RUNS_FIELDS = ["run_ids"] as const;

export const SCENARIO_CHANGES_MIN_PROPERTIES = 1;
