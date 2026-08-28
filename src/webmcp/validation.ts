import type {
  ApplyScenarioChangesInput,
  CompareSimulationRunsInput,
  CreateScenarioInput,
  GetFactorySnapshotInput,
  GetScenarioSnapshotInput,
  RunFactorySimulationInput,
  ScenarioChanges,
} from "./contracts";
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

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

const REQUEST_ID_PATTERN = new RegExp(REQUEST_ID_CONSTRAINTS.pattern, "u");
const RESOURCE_ID_PATTERN = new RegExp(RESOURCE_ID_CONSTRAINTS.pattern, "u");
const SCENARIO_NAME_PATTERN = new RegExp(SCENARIO_NAME_CONSTRAINTS.pattern, "u");

function valid<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function invalid<T>(issues: string[]): ValidationResult<T> {
  return { ok: false, issues };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function validateShape(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
  path = "input",
): { record?: Record<string, unknown>; issues: string[] } {
  if (!isPlainRecord(value)) {
    return { issues: [`${path} must be a plain object.`] };
  }

  const issues: string[] = [];
  const allowedKeys = new Set(allowed);

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push(`${path}.${key} is not allowed.`);
    }
  }

  for (const key of required) {
    if (!hasOwn(value, key)) {
      issues.push(`${path}.${key} is required.`);
    }
  }

  return { record: value, issues };
}

function validateRequestId(value: unknown, path: string, issues: string[]): void {
  if (typeof value !== "string" || !REQUEST_ID_PATTERN.test(value)) {
    issues.push(
      `${path} must be a ${REQUEST_ID_CONSTRAINTS.minLength}-${REQUEST_ID_CONSTRAINTS.maxLength} character request identifier.`,
    );
  }
}

function validateResourceId(value: unknown, path: string, issues: string[]): void {
  if (typeof value !== "string" || !RESOURCE_ID_PATTERN.test(value)) {
    issues.push(
      `${path} must be a ${RESOURCE_ID_CONSTRAINTS.minLength}-${RESOURCE_ID_CONSTRAINTS.maxLength} character resource identifier.`,
    );
  }
}

function validateRevision(value: unknown, path: string, issues: string[]): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < REVISION_CONSTRAINTS.minimum ||
    value > REVISION_CONSTRAINTS.maximum
  ) {
    issues.push(
      `${path} must be an integer from ${REVISION_CONSTRAINTS.minimum} to ${REVISION_CONSTRAINTS.maximum}.`,
    );
  }
}

function validateIntegerRange(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
  issues: string[],
): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    issues.push(`${path} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function validateNumberEnum(
  value: unknown,
  choices: readonly number[],
  path: string,
  issues: string[],
): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !choices.includes(value)
  ) {
    issues.push(`${path} must be one of: ${choices.join(", ")}.`);
  }
}

function validateStringEnum(
  value: unknown,
  choices: readonly string[],
  path: string,
  issues: string[],
): void {
  if (typeof value !== "string" || !choices.includes(value)) {
    issues.push(`${path} must be one of: ${choices.join(", ")}.`);
  }
}

export function validateGetFactorySnapshotInput(
  input: unknown,
): ValidationResult<GetFactorySnapshotInput> {
  const shape = validateShape(
    input,
    GET_FACTORY_SNAPSHOT_FIELDS,
    GET_FACTORY_SNAPSHOT_FIELDS,
  );
  return shape.issues.length > 0 ? invalid(shape.issues) : valid({});
}

export function validateGetScenarioSnapshotInput(
  input: unknown,
): ValidationResult<GetScenarioSnapshotInput> {
  const shape = validateShape(
    input,
    GET_SCENARIO_SNAPSHOT_FIELDS,
    GET_SCENARIO_SNAPSHOT_FIELDS,
  );
  if (!shape.record) {
    return invalid(shape.issues);
  }

  validateResourceId(shape.record.scenario_id, "input.scenario_id", shape.issues);
  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid({ scenario_id: shape.record.scenario_id as string });
}

export function validateCreateScenarioInput(
  input: unknown,
): ValidationResult<CreateScenarioInput> {
  const shape = validateShape(
    input,
    CREATE_SCENARIO_FIELDS,
    CREATE_SCENARIO_FIELDS,
  );
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const record = shape.record;
  validateRequestId(record.request_id, "input.request_id", shape.issues);
  validateResourceId(
    record.factory_version_id,
    "input.factory_version_id",
    shape.issues,
  );
  validateRevision(
    record.expected_factory_revision,
    "input.expected_factory_revision",
    shape.issues,
  );
  validateRevision(
    record.expected_lock_revision,
    "input.expected_lock_revision",
    shape.issues,
  );

  if (
    typeof record.name !== "string" ||
    [...record.name].length < SCENARIO_NAME_CONSTRAINTS.minLength ||
    [...record.name].length > SCENARIO_NAME_CONSTRAINTS.maxLength ||
    !SCENARIO_NAME_PATTERN.test(record.name)
  ) {
    shape.issues.push(
      `input.name must be ${SCENARIO_NAME_CONSTRAINTS.minLength}-${SCENARIO_NAME_CONSTRAINTS.maxLength} characters with no surrounding whitespace or control characters.`,
    );
  }

  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid({
        request_id: record.request_id as string,
        name: record.name as string,
        factory_version_id: record.factory_version_id as string,
        expected_factory_revision: record.expected_factory_revision as number,
        expected_lock_revision: record.expected_lock_revision as number,
      });
}

function validateScenarioChanges(input: unknown): ValidationResult<ScenarioChanges> {
  const shape = validateShape(
    input,
    SCENARIO_CHANGE_FIELDS,
    SCENARIO_CHANGE_REQUIRED_FIELDS,
    "input.changes",
  );
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const record = shape.record;
  if (Object.keys(record).length < SCENARIO_CHANGES_MIN_PROPERTIES) {
    shape.issues.push(
      `input.changes must contain at least ${SCENARIO_CHANGES_MIN_PROPERTIES} setting.`,
    );
  }

  if (hasOwn(record, "mixer_speed_bps")) {
    validateIntegerRange(
      record.mixer_speed_bps,
      SPEED_BPS_CONSTRAINTS.minimum,
      SPEED_BPS_CONSTRAINTS.maximum,
      "input.changes.mixer_speed_bps",
      shape.issues,
    );
  }
  if (hasOwn(record, "packaging_speed_bps")) {
    validateIntegerRange(
      record.packaging_speed_bps,
      SPEED_BPS_CONSTRAINTS.minimum,
      SPEED_BPS_CONSTRAINTS.maximum,
      "input.changes.packaging_speed_bps",
      shape.issues,
    );
  }
  if (hasOwn(record, "packaging_changeover_minutes")) {
    validateNumberEnum(
      record.packaging_changeover_minutes,
      PACKAGING_CHANGEOVER_MINUTES,
      "input.changes.packaging_changeover_minutes",
      shape.issues,
    );
  }
  if (hasOwn(record, "packaging_calibration")) {
    validateStringEnum(
      record.packaging_calibration,
      PACKAGING_CALIBRATIONS,
      "input.changes.packaging_calibration",
      shape.issues,
    );
  }
  if (hasOwn(record, "supplier_mode")) {
    validateStringEnum(
      record.supplier_mode,
      SUPPLIER_MODES,
      "input.changes.supplier_mode",
      shape.issues,
    );
  }
  if (hasOwn(record, "quality_rate_units_per_hour")) {
    validateNumberEnum(
      record.quality_rate_units_per_hour,
      QUALITY_RATES_UNITS_PER_HOUR,
      "input.changes.quality_rate_units_per_hour",
      shape.issues,
    );
  }
  if (hasOwn(record, "warehouse_dock_units_per_hour")) {
    validateNumberEnum(
      record.warehouse_dock_units_per_hour,
      WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR,
      "input.changes.warehouse_dock_units_per_hour",
      shape.issues,
    );
  }

  if (shape.issues.length > 0) {
    return invalid(shape.issues);
  }

  const changes: ScenarioChanges = {};
  if (hasOwn(record, "mixer_speed_bps")) {
    changes.mixer_speed_bps = record.mixer_speed_bps as number;
  }
  if (hasOwn(record, "packaging_speed_bps")) {
    changes.packaging_speed_bps = record.packaging_speed_bps as number;
  }
  if (hasOwn(record, "packaging_changeover_minutes")) {
    changes.packaging_changeover_minutes =
      record.packaging_changeover_minutes as NonNullable<
        ScenarioChanges["packaging_changeover_minutes"]
      >;
  }
  if (hasOwn(record, "packaging_calibration")) {
    changes.packaging_calibration = record.packaging_calibration as NonNullable<
      ScenarioChanges["packaging_calibration"]
    >;
  }
  if (hasOwn(record, "supplier_mode")) {
    changes.supplier_mode = record.supplier_mode as NonNullable<
      ScenarioChanges["supplier_mode"]
    >;
  }
  if (hasOwn(record, "quality_rate_units_per_hour")) {
    changes.quality_rate_units_per_hour =
      record.quality_rate_units_per_hour as NonNullable<
        ScenarioChanges["quality_rate_units_per_hour"]
      >;
  }
  if (hasOwn(record, "warehouse_dock_units_per_hour")) {
    changes.warehouse_dock_units_per_hour =
      record.warehouse_dock_units_per_hour as NonNullable<
        ScenarioChanges["warehouse_dock_units_per_hour"]
      >;
  }
  return valid(changes);
}

export function validateApplyScenarioChangesInput(
  input: unknown,
): ValidationResult<ApplyScenarioChangesInput> {
  const shape = validateShape(
    input,
    APPLY_SCENARIO_CHANGES_FIELDS,
    APPLY_SCENARIO_CHANGES_FIELDS,
  );
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const record = shape.record;
  validateRequestId(record.request_id, "input.request_id", shape.issues);
  validateResourceId(record.scenario_id, "input.scenario_id", shape.issues);
  validateRevision(
    record.expected_factory_revision,
    "input.expected_factory_revision",
    shape.issues,
  );
  validateRevision(
    record.expected_scenario_revision,
    "input.expected_scenario_revision",
    shape.issues,
  );
  validateRevision(
    record.expected_lock_revision,
    "input.expected_lock_revision",
    shape.issues,
  );

  const changes = validateScenarioChanges(record.changes);
  if (!changes.ok) {
    shape.issues.push(...changes.issues);
  }

  return shape.issues.length > 0 || !changes.ok
    ? invalid(shape.issues)
    : valid({
        request_id: record.request_id as string,
        scenario_id: record.scenario_id as string,
        expected_factory_revision: record.expected_factory_revision as number,
        expected_scenario_revision: record.expected_scenario_revision as number,
        expected_lock_revision: record.expected_lock_revision as number,
        changes: changes.value,
      });
}

export function validateRunFactorySimulationInput(
  input: unknown,
): ValidationResult<RunFactorySimulationInput> {
  const shape = validateShape(
    input,
    RUN_FACTORY_SIMULATION_FIELDS,
    RUN_FACTORY_SIMULATION_FIELDS,
  );
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const record = shape.record;
  validateRequestId(record.request_id, "input.request_id", shape.issues);
  validateResourceId(record.scenario_id, "input.scenario_id", shape.issues);
  validateRevision(
    record.expected_factory_revision,
    "input.expected_factory_revision",
    shape.issues,
  );
  validateRevision(
    record.expected_scenario_revision,
    "input.expected_scenario_revision",
    shape.issues,
  );
  validateRevision(
    record.expected_lock_revision,
    "input.expected_lock_revision",
    shape.issues,
  );
  validateNumberEnum(
    record.horizon_shifts,
    SIMULATION_HORIZON_SHIFTS,
    "input.horizon_shifts",
    shape.issues,
  );

  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid({
        request_id: record.request_id as string,
        scenario_id: record.scenario_id as string,
        expected_factory_revision: record.expected_factory_revision as number,
        expected_scenario_revision: record.expected_scenario_revision as number,
        expected_lock_revision: record.expected_lock_revision as number,
        horizon_shifts: record.horizon_shifts as 1,
      });
}

export function validateCompareSimulationRunsInput(
  input: unknown,
): ValidationResult<CompareSimulationRunsInput> {
  const shape = validateShape(
    input,
    COMPARE_SIMULATION_RUNS_FIELDS,
    COMPARE_SIMULATION_RUNS_FIELDS,
  );
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const value = shape.record.run_ids;
  if (
    !Array.isArray(value) ||
    value.length < COMPARE_RUN_IDS_CONSTRAINTS.minItems ||
    value.length > COMPARE_RUN_IDS_CONSTRAINTS.maxItems
  ) {
    shape.issues.push(
      `input.run_ids must contain ${COMPARE_RUN_IDS_CONSTRAINTS.minItems} to ${COMPARE_RUN_IDS_CONSTRAINTS.maxItems} run identifiers.`,
    );
    return invalid(shape.issues);
  }

  const runIds: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const runId = value[index];
    validateResourceId(runId, `input.run_ids[${index}]`, shape.issues);
    if (typeof runId === "string") {
      runIds.push(runId);
    }
  }
  if (
    COMPARE_RUN_IDS_CONSTRAINTS.uniqueItems &&
    new Set(runIds).size !== runIds.length
  ) {
    shape.issues.push("input.run_ids must not contain duplicates.");
  }

  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid({ run_ids: runIds });
}

export function extractRequestId(input: unknown): string | null {
  if (!isPlainRecord(input)) {
    return null;
  }

  return typeof input.request_id === "string" &&
    REQUEST_ID_PATTERN.test(input.request_id)
    ? input.request_id
    : null;
}
