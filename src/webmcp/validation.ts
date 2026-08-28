import type {
  ApplyScenarioChangesInput,
  CompareSimulationRunsInput,
  CreateScenarioInput,
  GetFactorySnapshotInput,
  GetScenarioSnapshotInput,
  RunFactorySimulationInput,
  ScenarioChanges,
} from "./contracts";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_REVISION = 2_147_483_647;

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
    issues.push(`${path} must be a 1-64 character request identifier.`);
  }
}

function validateResourceId(value: unknown, path: string, issues: string[]): void {
  if (typeof value !== "string" || !RESOURCE_ID_PATTERN.test(value)) {
    issues.push(`${path} must be a 1-80 character resource identifier.`);
  }
}

function validateRevision(value: unknown, path: string, issues: string[]): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_REVISION
  ) {
    issues.push(`${path} must be an integer from 0 to ${MAX_REVISION}.`);
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
  const shape = validateShape(input, [], []);
  return shape.issues.length > 0 ? invalid(shape.issues) : valid({});
}

export function validateGetScenarioSnapshotInput(
  input: unknown,
): ValidationResult<GetScenarioSnapshotInput> {
  const shape = validateShape(input, ["scenario_id"], ["scenario_id"]);
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
  const keys = [
    "request_id",
    "name",
    "factory_version_id",
    "expected_factory_revision",
    "expected_lock_revision",
  ] as const;
  const shape = validateShape(input, keys, keys);
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const record = shape.record;
  validateRequestId(record.request_id, "input.request_id", shape.issues);
  validateResourceId(record.factory_version_id, "input.factory_version_id", shape.issues);
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
    record.name.length < 1 ||
    record.name.length > 48 ||
    record.name.trim() !== record.name ||
    CONTROL_CHARACTER_PATTERN.test(record.name)
  ) {
    shape.issues.push(
      "input.name must be 1-48 characters with no surrounding whitespace or control characters.",
    );
  }

  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid(record as unknown as CreateScenarioInput);
}

function validateScenarioChanges(input: unknown): ValidationResult<ScenarioChanges> {
  const keys = [
    "mixer_speed_bps",
    "packaging_speed_bps",
    "packaging_changeover_minutes",
    "packaging_calibration",
    "supplier_mode",
    "quality_rate_units_per_hour",
    "warehouse_dock_units_per_hour",
  ] as const;
  const shape = validateShape(input, keys, [], "input.changes");
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const record = shape.record;
  if (Object.keys(record).length === 0) {
    shape.issues.push("input.changes must contain at least one setting.");
  }

  if (hasOwn(record, "mixer_speed_bps")) {
    validateIntegerRange(
      record.mixer_speed_bps,
      5_000,
      15_000,
      "input.changes.mixer_speed_bps",
      shape.issues,
    );
  }
  if (hasOwn(record, "packaging_speed_bps")) {
    validateIntegerRange(
      record.packaging_speed_bps,
      5_000,
      15_000,
      "input.changes.packaging_speed_bps",
      shape.issues,
    );
  }
  if (hasOwn(record, "packaging_changeover_minutes")) {
    validateNumberEnum(
      record.packaging_changeover_minutes,
      [15, 30, 45],
      "input.changes.packaging_changeover_minutes",
      shape.issues,
    );
  }
  if (hasOwn(record, "packaging_calibration")) {
    validateStringEnum(
      record.packaging_calibration,
      ["standard", "enhanced"],
      "input.changes.packaging_calibration",
      shape.issues,
    );
  }
  if (hasOwn(record, "supplier_mode")) {
    validateStringEnum(
      record.supplier_mode,
      ["standard", "expedite"],
      "input.changes.supplier_mode",
      shape.issues,
    );
  }
  if (hasOwn(record, "quality_rate_units_per_hour")) {
    validateNumberEnum(
      record.quality_rate_units_per_hour,
      [600, 700, 800, 900],
      "input.changes.quality_rate_units_per_hour",
      shape.issues,
    );
  }
  if (hasOwn(record, "warehouse_dock_units_per_hour")) {
    validateNumberEnum(
      record.warehouse_dock_units_per_hour,
      [800, 900, 1000],
      "input.changes.warehouse_dock_units_per_hour",
      shape.issues,
    );
  }

  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid(record as unknown as ScenarioChanges);
}

export function validateApplyScenarioChangesInput(
  input: unknown,
): ValidationResult<ApplyScenarioChangesInput> {
  const keys = [
    "request_id",
    "scenario_id",
    "expected_factory_revision",
    "expected_scenario_revision",
    "expected_lock_revision",
    "changes",
  ] as const;
  const shape = validateShape(input, keys, keys);
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
  const keys = [
    "request_id",
    "scenario_id",
    "expected_factory_revision",
    "expected_scenario_revision",
    "expected_lock_revision",
    "horizon_shifts",
  ] as const;
  const shape = validateShape(input, keys, keys);
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
    [1],
    "input.horizon_shifts",
    shape.issues,
  );

  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid(record as unknown as RunFactorySimulationInput);
}

export function validateCompareSimulationRunsInput(
  input: unknown,
): ValidationResult<CompareSimulationRunsInput> {
  const shape = validateShape(input, ["run_ids"], ["run_ids"]);
  if (!shape.record) {
    return invalid(shape.issues);
  }

  const value = shape.record.run_ids;
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    shape.issues.push("input.run_ids must contain two to four run identifiers.");
    return invalid(shape.issues);
  }

  for (const [index, runId] of value.entries()) {
    validateResourceId(runId, `input.run_ids[${index}]`, shape.issues);
  }
  if (new Set(value).size !== value.length) {
    shape.issues.push("input.run_ids must not contain duplicates.");
  }

  return shape.issues.length > 0
    ? invalid(shape.issues)
    : valid({ run_ids: value as string[] });
}

export function extractRequestId(input: unknown): string | null {
  if (!isPlainRecord(input)) {
    return null;
  }

  return typeof input.request_id === "string" && REQUEST_ID_PATTERN.test(input.request_id)
    ? input.request_id
    : null;
}
