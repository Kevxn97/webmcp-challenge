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

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
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
  const seenAllowedKeys = new Set<string>();
  const snapshot = Object.create(null) as Record<string, unknown>;
  let ownKeys: readonly PropertyKey[];

  try {
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return { issues: [`${path} must be a readable plain object.`] };
  }

  for (const key of ownKeys) {
    if (typeof key !== "string") {
      issues.push(`${path} must not contain symbol properties.`);
      continue;
    }

    let descriptor: PropertyDescriptor | undefined;
    try {
      // Snapshot each property descriptor once. Accessor values are never read.
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(`${path}.${key} must be a readable data property.`);
      continue;
    }

    if (!allowedKeys.has(key)) {
      issues.push(`${path}.${key} is not allowed.`);
      continue;
    }
    seenAllowedKeys.add(key);

    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      issues.push(`${path}.${key} must be an enumerable data property.`);
      continue;
    }

    Object.defineProperty(snapshot, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }

  for (const key of required) {
    if (!seenAllowedKeys.has(key)) {
      issues.push(`${path}.${key} is required.`);
    }
  }

  return { record: snapshot, issues };
}

function stringLengthInCodePoints(value: string): number {
  return [...value].length;
}

function isValidRequestId(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const length = stringLengthInCodePoints(value);
  const validLength =
    length >= REQUEST_ID_CONSTRAINTS.minLength &&
    length <= REQUEST_ID_CONSTRAINTS.maxLength;
  const validPattern = REQUEST_ID_PATTERN.test(value);
  return validLength && validPattern;
}

function isValidResourceId(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const length = stringLengthInCodePoints(value);
  const validLength =
    length >= RESOURCE_ID_CONSTRAINTS.minLength &&
    length <= RESOURCE_ID_CONSTRAINTS.maxLength;
  const validPattern = RESOURCE_ID_PATTERN.test(value);
  return validLength && validPattern;
}

function validateRequestId(value: unknown, path: string, issues: string[]): void {
  if (!isValidRequestId(value)) {
    issues.push(
      `${path} must be a ${REQUEST_ID_CONSTRAINTS.minLength}-${REQUEST_ID_CONSTRAINTS.maxLength} character request identifier.`,
    );
  }
}

function validateResourceId(value: unknown, path: string, issues: string[]): void {
  if (!isValidResourceId(value)) {
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

function snapshotDenseArray(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
  path: string,
): { values?: unknown[]; issues: string[] } {
  if (!Array.isArray(value)) {
    return { issues: [`${path} must be an array.`] };
  }

  try {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Array.prototype && prototype !== null) {
      return { issues: [`${path} must be a plain array.`] };
    }
  } catch {
    return { issues: [`${path} must be a readable plain array.`] };
  }

  let ownKeys: readonly PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return { issues: [`${path} must be a readable plain array.`] };
  }

  const issues: string[] = [];
  const descriptors = new Map<string, PropertyDescriptor>();
  for (const key of ownKeys) {
    if (typeof key !== "string") {
      issues.push(`${path} must not contain symbol properties.`);
      continue;
    }

    let descriptor: PropertyDescriptor | undefined;
    try {
      // Capture every own string-keyed descriptor once without reading accessors.
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(`${path}.${key} must be a readable data property.`);
      continue;
    }
    if (!descriptor) {
      issues.push(`${path}.${key} must be a stable data property.`);
      continue;
    }
    descriptors.set(key, descriptor);
  }

  const lengthDescriptor = descriptors.get("length");
  if (
    !lengthDescriptor ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < minimumLength ||
    lengthDescriptor.value > maximumLength
  ) {
    issues.push(
      `${path} must contain ${minimumLength} to ${maximumLength} items.`,
    );
    return { issues };
  }

  const length = lengthDescriptor.value;
  const expectedIndexKeys = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    expectedIndexKeys.add(String(index));
  }
  for (const key of descriptors.keys()) {
    if (key !== "length" && !expectedIndexKeys.has(key)) {
      issues.push(`${path}.${key} is not allowed.`);
    }
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors.get(String(index));
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      issues.push(`${path}[${index}] must be an enumerable data property.`);
      continue;
    }
    Object.defineProperty(snapshot, String(index), {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  return { values: snapshot, issues };
}

export function validateGetFactorySnapshotInput(
  input: unknown,
): ValidationResult<GetFactorySnapshotInput> {
  const shape = validateShape(
    input,
    GET_FACTORY_SNAPSHOT_FIELDS,
    GET_FACTORY_SNAPSHOT_FIELDS,
  );
  return shape.issues.length > 0 ? invalid(shape.issues) : valid(frozen({}));
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
    : valid(
        frozen({ scenario_id: shape.record.scenario_id as string }),
      );
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
    : valid(
        frozen({
          request_id: record.request_id as string,
          name: record.name as string,
          factory_version_id: record.factory_version_id as string,
          expected_factory_revision: record.expected_factory_revision as number,
          expected_lock_revision: record.expected_lock_revision as number,
        }),
      );
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

  const changes = Object.create(null) as Mutable<ScenarioChanges>;
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
  return valid(frozen(changes));
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
    : valid(
        frozen({
          request_id: record.request_id as string,
          scenario_id: record.scenario_id as string,
          expected_factory_revision: record.expected_factory_revision as number,
          expected_scenario_revision: record.expected_scenario_revision as number,
          expected_lock_revision: record.expected_lock_revision as number,
          changes: changes.value,
        }),
      );
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
    : valid(
        frozen({
          request_id: record.request_id as string,
          scenario_id: record.scenario_id as string,
          expected_factory_revision: record.expected_factory_revision as number,
          expected_scenario_revision: record.expected_scenario_revision as number,
          expected_lock_revision: record.expected_lock_revision as number,
          horizon_shifts:
            record.horizon_shifts as RunFactorySimulationInput["horizon_shifts"],
        }),
      );
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

  const snapshot = snapshotDenseArray(
    shape.record.run_ids,
    COMPARE_RUN_IDS_CONSTRAINTS.minItems,
    COMPARE_RUN_IDS_CONSTRAINTS.maxItems,
    "input.run_ids",
  );
  shape.issues.push(...snapshot.issues);
  if (!snapshot.values) {
    return invalid(shape.issues);
  }

  const runIds: string[] = [];
  for (let index = 0; index < snapshot.values.length; index += 1) {
    const runId = snapshot.values[index];
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
    : valid(frozen({ run_ids: frozen(runIds) }));
}

export function extractRequestId(input: unknown): string | null {
  if (!isPlainRecord(input)) {
    return null;
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, "request_id");
    return descriptor &&
      "value" in descriptor &&
      descriptor.enumerable === true &&
      isValidRequestId(descriptor.value)
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}
