from __future__ import annotations

from pathlib import Path
import re

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact match, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count == 0:
        if replacement in text:
            return
        raise RuntimeError(f"{path}: regex did not match: {pattern[:160]!r}")
    write(path, updated)


write("src/shared/simulationDefinitions.ts", '''\
export const TICK_MINUTES = 15 as const;
export const TOTAL_TICKS = 64 as const;
''')

write("src/shared/controlDefinitions.ts", '''\
import { TICK_MINUTES } from "./simulationDefinitions";

export const SPEED_BPS_MIN = 5_000 as const;
export const SPEED_BPS_MAX = 10_000 as const;

export const PACKAGING_LOCK_EFFECTIVE_TICK = 16 as const;
export const PACKAGING_LOCK_EFFECTIVE_MINUTES =
  PACKAGING_LOCK_EFFECTIVE_TICK * TICK_MINUTES;

type PrimitiveControlValue = string | number;

export const CONTROL_DEFINITIONS = {
  mixer_speed_bps: {
    label: "Mixer speed",
    description: "Mixer speed as basis points of equipment nameplate (10000 = 100%).",
    resource: "Mixer",
    unit: "basis_points_of_nameplate",
    applicationPhase: "runtime",
    domain: { type: "range", minimum: SPEED_BPS_MIN, maximum: SPEED_BPS_MAX },
    baseline: 8_750,
    engineControl: "mixerSpeedBps",
    operation: {
      kind: "SET_MIXER_SPEED",
      valueKey: "valueBps",
      idSuffix: "mixer-speed",
    },
    blockedByPackagingLock: false,
  },
  packaging_speed_bps: {
    label: "Packaging speed",
    description: "Packaging speed as basis points of equipment nameplate (10000 = 100%).",
    resource: "Packaging",
    unit: "basis_points_of_nameplate",
    applicationPhase: "runtime",
    domain: { type: "range", minimum: SPEED_BPS_MIN, maximum: SPEED_BPS_MAX },
    baseline: 7_500,
    engineControl: "packagingSpeedBps",
    operation: {
      kind: "SET_PACKAGING_SPEED",
      valueKey: "valueBps",
      idSuffix: "packaging-speed",
    },
    blockedByPackagingLock: true,
  },
  packaging_changeover_minutes: {
    label: "Packaging changeover",
    description: "Packaging changeover duration in minutes.",
    resource: "Packaging",
    unit: "minutes",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: [15, 30, 45] },
    baseline: 30,
    engineControl: "changeoverMinutes",
    operation: {
      kind: "SET_CHANGEOVER_MINUTES",
      valueKey: "valueMinutes",
      idSuffix: "changeover",
    },
    blockedByPackagingLock: true,
  },
  packaging_calibration: {
    label: "Packaging calibration",
    description: "Packaging calibration mode.",
    resource: "Packaging",
    unit: "mode",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: ["standard", "enhanced"] },
    baseline: "standard",
    engineControl: "calibration",
    operation: {
      kind: "SET_CALIBRATION",
      valueKey: "value",
      idSuffix: "calibration",
    },
    blockedByPackagingLock: true,
  },
  supplier_mode: {
    label: "Supplier mode",
    description: "Supplier service mode.",
    resource: "Supplier",
    unit: "mode",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: ["standard", "expedite"] },
    baseline: "standard",
    engineControl: "supplierMode",
    operation: {
      kind: "SET_SUPPLIER_MODE",
      valueKey: "value",
      idSuffix: "supplier",
    },
    blockedByPackagingLock: false,
  },
  quality_rate_units_per_hour: {
    label: "Quality Gate rate",
    description: "Quality-gate inspection capacity in units per hour.",
    resource: "Quality Gate",
    unit: "units_per_hour",
    applicationPhase: "runtime",
    domain: { type: "enum", values: [600, 700, 800, 900] },
    baseline: 800,
    engineControl: "qualityRateUnitsPerHour",
    operation: {
      kind: "SET_QUALITY_RATE",
      valueKey: "valueUnitsPerHour",
      idSuffix: "quality",
    },
    blockedByPackagingLock: false,
  },
  warehouse_dock_units_per_hour: {
    label: "Warehouse dock rate",
    description: "Warehouse dock capacity in units per hour.",
    resource: "Warehouse",
    unit: "units_per_hour",
    applicationPhase: "runtime",
    domain: { type: "enum", values: [800, 900, 1000] },
    baseline: 900,
    engineControl: "warehouseRateUnitsPerHour",
    operation: {
      kind: "SET_WAREHOUSE_RATE",
      valueKey: "valueUnitsPerHour",
      idSuffix: "warehouse",
    },
    blockedByPackagingLock: false,
  },
} as const;

export type ScenarioControlField = keyof typeof CONTROL_DEFINITIONS;

type DomainValue<Domain> =
  Domain extends { type: "enum"; values: readonly (infer Value)[] }
    ? Value
    : Domain extends { type: "range" }
      ? number
      : never;

export type ScenarioControlValue<Field extends ScenarioControlField> =
  DomainValue<(typeof CONTROL_DEFINITIONS)[Field]["domain"]>;

export type ScenarioPatch = Partial<{
  [Field in ScenarioControlField]: ScenarioControlValue<Field>;
}>;

export type ScenarioControlValues = {
  [Field in ScenarioControlField]: ScenarioControlValue<Field>;
};

export type RegistryFactoryControls = {
  [Field in ScenarioControlField as
    (typeof CONTROL_DEFINITIONS)[Field]["engineControl"]]:
      ScenarioControlValue<Field>;
};

export type PackagingChangeoverMinutes =
  ScenarioControlValue<"packaging_changeover_minutes">;
export type PackagingCalibration =
  ScenarioControlValue<"packaging_calibration">;
export type SupplierMode = ScenarioControlValue<"supplier_mode">;
export type QualityRateUnitsPerHour =
  ScenarioControlValue<"quality_rate_units_per_hour">;
export type WarehouseDockUnitsPerHour =
  ScenarioControlValue<"warehouse_dock_units_per_hour">;

export const SCENARIO_CONTROL_FIELDS = Object.freeze(
  Object.keys(CONTROL_DEFINITIONS) as ScenarioControlField[],
);

function selectFields(
  predicate: (
    definition: (typeof CONTROL_DEFINITIONS)[ScenarioControlField],
  ) => boolean,
): readonly ScenarioControlField[] {
  return Object.freeze(
    SCENARIO_CONTROL_FIELDS.filter((field) =>
      predicate(CONTROL_DEFINITIONS[field]),
    ),
  );
}

export const PACKAGING_CONTROL_FIELDS = selectFields(
  (definition) => definition.blockedByPackagingLock,
);

export const PRE_SHIFT_CONTROL_FIELDS = selectFields(
  (definition) => definition.applicationPhase === "pre_shift",
);

export const POST_LOCK_AVAILABLE_CONTROL_FIELDS = selectFields(
  (definition) =>
    definition.applicationPhase === "runtime" &&
    !definition.blockedByPackagingLock,
);

export const BASELINE_SCENARIO_VALUES = Object.freeze(
  Object.fromEntries(
    SCENARIO_CONTROL_FIELDS.map((field) => [
      field,
      CONTROL_DEFINITIONS[field].baseline,
    ]),
  ) as unknown as ScenarioControlValues,
);

export const BASELINE_FACTORY_CONTROLS = Object.freeze(
  Object.fromEntries(
    SCENARIO_CONTROL_FIELDS.map((field) => {
      const definition = CONTROL_DEFINITIONS[field];
      return [definition.engineControl, definition.baseline];
    }),
  ) as unknown as RegistryFactoryControls,
);

export function controlValueIsValid(
  field: ScenarioControlField,
  value: unknown,
): boolean {
  const domain = CONTROL_DEFINITIONS[field].domain;
  if (domain.type === "range") {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= domain.minimum &&
      value <= domain.maximum
    );
  }

  const values = domain.values as readonly PrimitiveControlValue[];
  if (typeof value === "number" && !Number.isInteger(value)) return false;
  return values.includes(value as PrimitiveControlValue);
}

export function controlDomainDescription(field: ScenarioControlField): string {
  const domain = CONTROL_DEFINITIONS[field].domain;
  return domain.type === "range"
    ? `an integer from ${domain.minimum} to ${domain.maximum}`
    : `one of: ${domain.values.join(", ")}`;
}

export function scenarioControlOperation(
  field: ScenarioControlField,
  value: PrimitiveControlValue,
  prefix: string,
  tick: number,
): Record<string, PrimitiveControlValue> {
  const operation = CONTROL_DEFINITIONS[field].operation;
  return {
    operationId: `${prefix}-${operation.idSuffix}`,
    tick,
    actor: "model",
    kind: operation.kind,
    [operation.valueKey]: value,
  };
}
''')

write("src/webmcp/contract-constants.ts", '''\
import {
  CONTROL_DEFINITIONS,
  SCENARIO_CONTROL_FIELDS,
} from "../shared/controlDefinitions";

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

const SPEED_DOMAIN = CONTROL_DEFINITIONS.mixer_speed_bps.domain;
export const SPEED_BPS_CONSTRAINTS = {
  minimum: SPEED_DOMAIN.minimum,
  maximum: SPEED_DOMAIN.maximum,
} as const;

export const PACKAGING_CHANGEOVER_MINUTES =
  CONTROL_DEFINITIONS.packaging_changeover_minutes.domain.values;
export const PACKAGING_CALIBRATIONS =
  CONTROL_DEFINITIONS.packaging_calibration.domain.values;
export const SUPPLIER_MODES =
  CONTROL_DEFINITIONS.supplier_mode.domain.values;
export const QUALITY_RATES_UNITS_PER_HOUR =
  CONTROL_DEFINITIONS.quality_rate_units_per_hour.domain.values;
export const WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR =
  CONTROL_DEFINITIONS.warehouse_dock_units_per_hour.domain.values;
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
export const SCENARIO_CHANGE_FIELDS = SCENARIO_CONTROL_FIELDS;
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
''')

write("src/webmcp/schemas.ts", '''\
import {
  CONTROL_DEFINITIONS,
  SCENARIO_CONTROL_FIELDS,
  type ScenarioControlField,
} from "../shared/controlDefinitions";
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

function scenarioChangeProperty(
  field: ScenarioControlField,
): JsonSchemaProperty {
  const definition = CONTROL_DEFINITIONS[field];
  const domain = definition.domain;
  if (domain.type === "range") {
    return {
      type: "integer",
      description: definition.description,
      minimum: domain.minimum,
      maximum: domain.maximum,
    };
  }

  const values = domain.values;
  return typeof values[0] === "number"
    ? {
        type: "integer",
        description: definition.description,
        enum: values as readonly number[],
      }
    : {
        type: "string",
        description: definition.description,
        enum: values as readonly string[],
      };
}

const SCENARIO_CHANGE_PROPERTIES = Object.fromEntries(
  SCENARIO_CONTROL_FIELDS.map((field) => [
    field,
    scenarioChangeProperty(field),
  ]),
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
      description:
        "Two to four simulation run identifiers. run_ids[0] is the anchor; every reported delta is candidate minus anchor.",
      items: RESOURCE_ID_PROPERTY("Simulation run identifier."),
      ...COMPARE_RUN_IDS_CONSTRAINTS,
    },
  },
  required: COMPARE_SIMULATION_RUNS_FIELDS,
  additionalProperties: false,
} as const satisfies JsonSchema;
''')

replace_once(
    "src/domain/constants.ts",
    'import type { AssetRecord, FactoryControls, MaterialDelivery } from "./types";\n',
    'import { BASELINE_FACTORY_CONTROLS } from "../shared/controlDefinitions";\n'
    'export { TICK_MINUTES, TOTAL_TICKS } from "../shared/simulationDefinitions";\n'
    'import type { AssetRecord, FactoryControls, MaterialDelivery } from "./types";\n',
)
replace_once(
    "src/domain/constants.ts",
    'export const TICK_MINUTES = 15 as const;\nexport const TOTAL_TICKS = 64 as const;\n',
    '',
)
regex_once(
    "src/domain/constants.ts",
    r'export const BASELINE_CONTROLS: Readonly<FactoryControls> = Object\.freeze\(\{\n.*?\n\}\);',
    'export const BASELINE_CONTROLS: Readonly<FactoryControls> =\n  BASELINE_FACTORY_CONTROLS;',
    re.S,
)

replace_once(
    "src/domain/types.ts",
    'export type JsonPrimitive = string | number | boolean | null;\n',
    'import type {\n'
    '  PackagingCalibration as RegistryPackagingCalibration,\n'
    '  PackagingChangeoverMinutes as RegistryPackagingChangeoverMinutes,\n'
    '  QualityRateUnitsPerHour as RegistryQualityRate,\n'
    '  RegistryFactoryControls,\n'
    '  SupplierMode as RegistrySupplierMode,\n'
    '  WarehouseDockUnitsPerHour as RegistryWarehouseRate,\n'
    '} from "../shared/controlDefinitions";\n'
    'import { TICK_MINUTES, TOTAL_TICKS } from "../shared/simulationDefinitions";\n\n'
    'export type JsonPrimitive = string | number | boolean | null;\n',
)
regex_once(
    "src/domain/types.ts",
    r'export type CalibrationMode = "standard" \| "enhanced";\n'
    r'export type SupplierMode = "standard" \| "expedite";\n'
    r'export type ChangeoverMinutes = 15 \| 30 \| 45;\n'
    r'export type QualityRate = 600 \| 700 \| 800 \| 900;\n'
    r'export type WarehouseRate = 800 \| 900 \| 1000;\n',
    'export type CalibrationMode = RegistryPackagingCalibration;\n'
    'export type SupplierMode = RegistrySupplierMode;\n'
    'export type ChangeoverMinutes = RegistryPackagingChangeoverMinutes;\n'
    'export type QualityRate = RegistryQualityRate;\n'
    'export type WarehouseRate = RegistryWarehouseRate;\n',
)
regex_once(
    "src/domain/types.ts",
    r'export interface FactoryControls \{\n.*?\n\}',
    'export type FactoryControls = RegistryFactoryControls;',
    re.S,
)
replace_once(
    "src/domain/types.ts",
    '  tickMinutes: 15;\n  totalTicks: 64;\n',
    '  tickMinutes: typeof TICK_MINUTES;\n  totalTicks: typeof TOTAL_TICKS;\n',
)

replace_once(
    "src/webmcp/contracts.ts",
    'import {\n'
    '  PACKAGING_CALIBRATIONS,\n'
    '  PACKAGING_CHANGEOVER_MINUTES,\n'
    '  QUALITY_RATES_UNITS_PER_HOUR,\n'
    '  SIMULATION_HORIZON_SHIFTS,\n'
    '  SUPPLIER_MODES,\n'
    '  WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR,\n'
    '} from "./contract-constants";\n',
    'import type {\n'
    '  PackagingCalibration as RegistryPackagingCalibration,\n'
    '  PackagingChangeoverMinutes as RegistryPackagingChangeoverMinutes,\n'
    '  QualityRateUnitsPerHour as RegistryQualityRateUnitsPerHour,\n'
    '  ScenarioPatch,\n'
    '  SupplierMode as RegistrySupplierMode,\n'
    '  WarehouseDockUnitsPerHour as RegistryWarehouseDockUnitsPerHour,\n'
    '} from "../shared/controlDefinitions";\n'
    'import { SIMULATION_HORIZON_SHIFTS } from "./contract-constants";\n',
)
regex_once(
    "src/webmcp/contracts.ts",
    r'export type PackagingChangeoverMinutes =\n  \(typeof PACKAGING_CHANGEOVER_MINUTES\)\[number\];\n'
    r'export type PackagingCalibration = \(typeof PACKAGING_CALIBRATIONS\)\[number\];\n'
    r'export type SupplierMode = \(typeof SUPPLIER_MODES\)\[number\];\n'
    r'export type QualityRateUnitsPerHour =\n  \(typeof QUALITY_RATES_UNITS_PER_HOUR\)\[number\];\n'
    r'export type WarehouseDockUnitsPerHour =\n  \(typeof WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR\)\[number\];\n',
    'export type PackagingChangeoverMinutes = RegistryPackagingChangeoverMinutes;\n'
    'export type PackagingCalibration = RegistryPackagingCalibration;\n'
    'export type SupplierMode = RegistrySupplierMode;\n'
    'export type QualityRateUnitsPerHour = RegistryQualityRateUnitsPerHour;\n'
    'export type WarehouseDockUnitsPerHour = RegistryWarehouseDockUnitsPerHour;\n',
)
regex_once(
    "src/webmcp/contracts.ts",
    r'export interface ScenarioChanges \{\n.*?\n\}',
    'export type ScenarioChanges = Readonly<ScenarioPatch>;',
    re.S,
)

text = read("src/webmcp/validation.ts")
text = text.replace(
    'import {\n'
    '  APPLY_SCENARIO_CHANGES_FIELDS,\n'
    '  COMPARE_RUN_IDS_CONSTRAINTS,\n'
    '  COMPARE_SIMULATION_RUNS_FIELDS,\n'
    '  CREATE_SCENARIO_FIELDS,\n'
    '  GET_FACTORY_SNAPSHOT_FIELDS,\n'
    '  GET_SCENARIO_SNAPSHOT_FIELDS,\n'
    '  PACKAGING_CALIBRATIONS,\n'
    '  PACKAGING_CHANGEOVER_MINUTES,\n'
    '  QUALITY_RATES_UNITS_PER_HOUR,\n'
    '  REQUEST_ID_CONSTRAINTS,\n'
    '  RESOURCE_ID_CONSTRAINTS,\n'
    '  REVISION_CONSTRAINTS,\n'
    '  RUN_FACTORY_SIMULATION_FIELDS,\n'
    '  SCENARIO_CHANGES_MIN_PROPERTIES,\n'
    '  SCENARIO_CHANGE_FIELDS,\n'
    '  SCENARIO_CHANGE_REQUIRED_FIELDS,\n'
    '  SCENARIO_NAME_CONSTRAINTS,\n'
    '  SIMULATION_HORIZON_SHIFTS,\n'
    '  SPEED_BPS_CONSTRAINTS,\n'
    '  SUPPLIER_MODES,\n'
    '  WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR,\n'
    '} from "./contract-constants";\n',
    'import {\n'
    '  controlDomainDescription,\n'
    '  controlValueIsValid,\n'
    '  SCENARIO_CONTROL_FIELDS,\n'
    '} from "../shared/controlDefinitions";\n'
    'import {\n'
    '  APPLY_SCENARIO_CHANGES_FIELDS,\n'
    '  COMPARE_RUN_IDS_CONSTRAINTS,\n'
    '  COMPARE_SIMULATION_RUNS_FIELDS,\n'
    '  CREATE_SCENARIO_FIELDS,\n'
    '  GET_FACTORY_SNAPSHOT_FIELDS,\n'
    '  GET_SCENARIO_SNAPSHOT_FIELDS,\n'
    '  REQUEST_ID_CONSTRAINTS,\n'
    '  RESOURCE_ID_CONSTRAINTS,\n'
    '  REVISION_CONSTRAINTS,\n'
    '  RUN_FACTORY_SIMULATION_FIELDS,\n'
    '  SCENARIO_CHANGES_MIN_PROPERTIES,\n'
    '  SCENARIO_CHANGE_FIELDS,\n'
    '  SCENARIO_CHANGE_REQUIRED_FIELDS,\n'
    '  SCENARIO_NAME_CONSTRAINTS,\n'
    '  SIMULATION_HORIZON_SHIFTS,\n'
    '} from "./contract-constants";\n',
)
if 'controlValueIsValid' not in text:
    raise RuntimeError("src/webmcp/validation.ts: import replacement failed")
text = re.sub(
    r'\nfunction validateIntegerRange\(.*?\n\}\n\nfunction validateNumberEnum\(.*?\n\}\n\nfunction validateStringEnum\(.*?\n\}\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)
manual_validation = re.compile(
    r'  if \(hasOwn\(record, "mixer_speed_bps"\)\) \{.*?'
    r'  if \(hasOwn\(record, "warehouse_dock_units_per_hour"\)\) \{.*?\n  \}\n\n'
    r'  if \(shape\.issues\.length > 0\)',
    re.S,
)
replacement_validation = '''\
  for (const field of SCENARIO_CONTROL_FIELDS) {
    if (!hasOwn(record, field)) continue;
    if (!controlValueIsValid(field, record[field])) {
      shape.issues.push(
        `input.changes.${field} must be ${controlDomainDescription(field)}.`,
      );
    }
  }

  if (shape.issues.length > 0)'''
text, count = manual_validation.subn(replacement_validation, text, count=1)
if count != 1:
    raise RuntimeError(f"src/webmcp/validation.ts: semantic validation block matches {count}")
construction = re.compile(
    r'  const changes = Object\.create\(null\) as Mutable<ScenarioChanges>;\n.*?'
    r'  return valid\(frozen\(changes\)\);',
    re.S,
)
replacement_construction = '''\
  const changes = Object.create(null) as Record<string, unknown>;
  for (const field of SCENARIO_CONTROL_FIELDS) {
    if (!hasOwn(record, field)) continue;
    Object.defineProperty(changes, field, {
      value: record[field],
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return valid(frozen(changes as ScenarioChanges));'''
text, count = construction.subn(replacement_construction, text, count=1)
if count != 1:
    raise RuntimeError(f"src/webmcp/validation.ts: construction block matches {count}")
text = text.replace('type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };\n\n', '')
write("src/webmcp/validation.ts", text)

replace_once(
    "src/domain/engine.ts",
    'import { SPEED_BPS_MAX, SPEED_BPS_MIN } from "../shared/controlDefinitions";\n',
    'import {\n'
    '  CONTROL_DEFINITIONS,\n'
    '  SCENARIO_CONTROL_FIELDS,\n'
    '  SPEED_BPS_MAX,\n'
    '  SPEED_BPS_MIN,\n'
    '} from "../shared/controlDefinitions";\n',
)
regex_once(
    "src/domain/engine.ts",
    r'const KNOWN_OPERATION_KINDS = new Set\(\[\n.*?\n\]\);\n\n'
    r'const CHANGEOVER_VALUES = new Set\(\[15, 30, 45\]\);\n'
    r'const QUALITY_RATE_VALUES = new Set\(\[600, 700, 800, 900\]\);\n'
    r'const WAREHOUSE_RATE_VALUES = new Set\(\[800, 900, 1000\]\);\n'
    r'const CALIBRATION_VALUES = new Set\(\["standard", "enhanced"\]\);\n'
    r'const SUPPLIER_MODE_VALUES = new Set\(\["standard", "expedite"\]\);',
    '''\
const KNOWN_OPERATION_KINDS = new Set([
  ...SCENARIO_CONTROL_FIELDS.map(
    (field) => CONTROL_DEFINITIONS[field].operation.kind,
  ),
  "LOCK_RESOURCE",
]);

const CHANGEOVER_VALUES = new Set(
  CONTROL_DEFINITIONS.packaging_changeover_minutes.domain.values,
);
const QUALITY_RATE_VALUES = new Set(
  CONTROL_DEFINITIONS.quality_rate_units_per_hour.domain.values,
);
const WAREHOUSE_RATE_VALUES = new Set(
  CONTROL_DEFINITIONS.warehouse_dock_units_per_hour.domain.values,
);
const CALIBRATION_VALUES = new Set(
  CONTROL_DEFINITIONS.packaging_calibration.domain.values,
);
const SUPPLIER_MODE_VALUES = new Set(
  CONTROL_DEFINITIONS.supplier_mode.domain.values,
);''',
    re.S,
)

write("src/app/selectionPolicy.ts", '''\
import type { SimulationReceipt } from "../domain";

export const SELECTION_POLICY = Object.freeze([
  "CURRENT_AND_VALID",
  "ALL_HARD_CONSTRAINTS_PASS",
  "MAX_GOOD_OUTPUT",
  "MIN_TOTAL_COST",
  "MIN_DEFECT_RATE",
  "MIN_CHANGED_CONTROLS",
  "CANONICAL_RUN_ID",
] as const);

export interface EvaluatedRun {
  runId: string;
  receipt: SimulationReceipt;
  changedControlCount: number;
}

export function compareDefectRate(
  left: SimulationReceipt,
  right: SimulationReceipt,
): number {
  return left.rawCounters.badUnits * right.rawCounters.grossUnits
    - right.rawCounters.badUnits * left.rawCounters.grossUnits;
}

export function compareEvaluatedRuns<T extends EvaluatedRun>(
  left: T,
  right: T,
): number {
  const output =
    right.receipt.rawCounters.goodOutputUnits
    - left.receipt.rawCounters.goodOutputUnits;
  if (output !== 0) return output;

  const cost =
    BigInt(left.receipt.totalCostMicroEur)
    - BigInt(right.receipt.totalCostMicroEur);
  if (cost !== 0n) return cost < 0n ? -1 : 1;

  const defects = compareDefectRate(left.receipt, right.receipt);
  if (defects !== 0) return defects;

  return (
    left.changedControlCount - right.changedControlCount
    || left.runId.localeCompare(right.runId)
  );
}
''')

text = read("src/app/store.ts")
text = text.replace(
    '  createBaselineInput,\n',
    '  BASELINE_CONTROLS,\n  createBaselineInput,\n',
    1,
)
text = text.replace(
    '  CONTROL_DEFINITIONS,\n',
    '  BASELINE_SCENARIO_VALUES,\n  CONTROL_DEFINITIONS,\n',
    1,
)
text = text.replace(
    '  SCENARIO_CONTROL_FIELDS,\n  type ScenarioControlField,\n',
    '  SCENARIO_CONTROL_FIELDS,\n'
    '  scenarioControlOperation,\n'
    '  type ScenarioControlField,\n'
    '  type ScenarioPatch,\n',
    1,
)
needle = '} from "../shared/controlDefinitions";\n'
if needle not in text:
    raise RuntimeError("store: shared import end missing")
text = text.replace(
    needle,
    needle + 'import {\n'
    '  compareDefectRate,\n'
    '  compareEvaluatedRuns,\n'
    '  SELECTION_POLICY,\n'
    '} from "./selectionPolicy";\n',
    1,
)
text = re.sub(r'\nexport type ScenarioPatch = \{\n.*?\n\};\n', '\n', text, count=1, flags=re.S)
text = re.sub(
    r'\nconst BASELINE_SCENARIO_VALUES: Required<ScenarioPatch> = \(\(\) => \{\n.*?\n\}\)\(\);\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)
scenario_record_end = '''\
export interface ScenarioRecord {
  id: string;
  marker: "A" | "B";
  name: string;
  revision: number;
  headVersionId: string;
  baseFactoryVersionId: string;
  sourceFactoryRevision: number;
  sourceLockRevision: number;
  patch: ScenarioPatch;
  placeholder: boolean;
  receipt: SimulationReceipt | null;
  receiptScenarioRevision: number | null;
  receiptLockRevision: number | null;
}
'''
if scenario_record_end not in text:
    raise RuntimeError("store: ScenarioRecord block mismatch")
text = text.replace(
    scenario_record_end,
    scenario_record_end + '''\

export interface RunProvenance {
  runId: string;
  kind: "baseline" | "scenario";
  scenarioId: string | null;
  scenarioVersionId: string | null;
  displayLabel: string;
  labelTrust: "SYSTEM_LABEL" | "UNTRUSTED_DISPLAY_TEXT";
  sourceFactoryRevision: number;
  sourceFactoryVersionId: string;
  sourceLockRevision: number;
  scenarioRevision: number | null;
  changedControlCount: number;
}
''',
    1,
)
text = text.replace(
    '  runs: Record<string, SimulationReceipt>;\n  ledger: SandboxLedgerEvent[];\n',
    '  runs: Record<string, SimulationReceipt>;\n'
    '  runProvenance: Record<string, RunProvenance>;\n'
    '  ledger: SandboxLedgerEvent[];\n',
    1,
)
text = text.replace(
    '  const runs = Object.fromEntries(\n'
    '    Object.entries(state.runs).map(([runId, receipt]) => [runId, deepFreeze(receipt)]),\n'
    '  );\n',
    '  const runs = Object.fromEntries(\n'
    '    Object.entries(state.runs).map(([runId, receipt]) => [runId, deepFreeze(receipt)]),\n'
    '  );\n'
    '  const runProvenance = Object.fromEntries(\n'
    '    Object.entries(state.runProvenance).map(([runId, provenance]) => [\n'
    '      runId,\n'
    '      Object.freeze({ ...provenance }),\n'
    '    ]),\n'
    '  );\n',
    1,
)
text = text.replace(
    '    runs: Object.freeze(runs),\n',
    '    runs: Object.freeze(runs),\n'
    '    runProvenance: Object.freeze(runProvenance),\n',
    1,
)
insert_after_normalize = '  return { changed: changed as ScenarioPatch, noOps };\n}\n'
if insert_after_normalize not in text:
    raise RuntimeError("store: normalize helper end missing")
helpers = r'''

function mergeScenarioPatch(
  current: ScenarioPatch,
  changed: ScenarioPatch,
): ScenarioPatch {
  const next = { ...current } as Record<string, unknown>;
  for (const field of SCENARIO_CONTROL_FIELDS) {
    const value = changed[field];
    if (value === undefined) continue;
    if (Object.is(value, BASELINE_SCENARIO_VALUES[field])) {
      delete next[field];
    } else {
      next[field] = value;
    }
  }
  return next as ScenarioPatch;
}

function runProvenanceForScenario(
  receipt: SimulationReceipt,
  scenario: ScenarioRecord,
): RunProvenance {
  return {
    runId: receipt.runId,
    kind: "scenario",
    scenarioId: scenario.id,
    scenarioVersionId: scenario.headVersionId,
    displayLabel: scenario.name,
    labelTrust: "UNTRUSTED_DISPLAY_TEXT",
    sourceFactoryRevision: scenario.sourceFactoryRevision,
    sourceFactoryVersionId: scenario.baseFactoryVersionId,
    sourceLockRevision: scenario.sourceLockRevision,
    scenarioRevision: scenario.revision,
    changedControlCount: Object.keys(scenario.patch).length,
  };
}

function baselineRunProvenance(
  receipt: SimulationReceipt,
  state: Pick<
    SandboxState,
    "factoryRevision" | "factoryVersionId" | "lockRevision"
  >,
): RunProvenance {
  return {
    runId: receipt.runId,
    kind: "baseline",
    scenarioId: null,
    scenarioVersionId: null,
    displayLabel: "Baseline",
    labelTrust: "SYSTEM_LABEL",
    sourceFactoryRevision: state.factoryRevision,
    sourceFactoryVersionId: state.factoryVersionId,
    sourceLockRevision: state.lockRevision,
    scenarioRevision: null,
    changedControlCount: 0,
  };
}

function scenarioEvaluationCurrentness(
  scenario: ScenarioRecord,
  state: SandboxState,
) {
  const authorityCurrent = scenarioAuthorityIsCurrent(scenario, state);
  if (!authorityCurrent) {
    return {
      status: "HISTORICAL" as const,
      sourceIsCurrent: false,
      invalidatedBy: ["AUTHORITY_EPOCH_CHANGED"],
    };
  }
  if (!scenario.receipt) {
    return {
      status: "UNEVALUATED" as const,
      sourceIsCurrent: false,
      invalidatedBy: [],
    };
  }

  const sourceIsCurrent =
    scenario.receiptLockRevision === state.lockRevision
    && scenario.receiptScenarioRevision === scenario.revision;
  return {
    status: sourceIsCurrent ? "CURRENT" as const : "STALE_RECEIPT" as const,
    sourceIsCurrent,
    invalidatedBy: sourceIsCurrent ? [] : ["SCENARIO_HEAD_CHANGED"],
  };
}

function scenarioWorkspaceAllocation(state: SandboxState) {
  const ordered = [...state.scenarios].sort((left, right) =>
    left.marker.localeCompare(right.marker),
  );
  const slot = ordered.find((scenario) => scenario.placeholder)
    ?? ordered.find((scenario) => !scenarioAuthorityIsCurrent(scenario, state))
    ?? ordered.find((scenario) => scenario.marker === "A")
    ?? ordered[0];

  const reason = !slot
    ? "NO_SLOT"
    : slot.placeholder
      ? "EMPTY_SLOT"
      : !scenarioAuthorityIsCurrent(slot, state)
        ? "HISTORICAL_HEAD"
        : "DETERMINISTIC_SLOT_A_REPLACEMENT";

  return {
    capacity: state.scenarios.length,
    occupied: state.scenarios.filter((scenario) => !scenario.placeholder).length,
    allocation_policy: [
      "FILL_EMPTY_SLOT",
      "REPLACE_OLDEST_AUTHORITY_EPOCH",
      "REPLACE_SLOT_A",
    ],
    next_create: slot ? {
      action: slot.placeholder ? "FILL_SLOT" : "REPLACE_HEAD",
      reason,
      slot_id: slot.id,
      slot_marker: slot.marker,
      displaced_scenario_id: slot.placeholder ? null : slot.id,
      displaced_scenario_version_id:
        slot.placeholder ? null : slot.headVersionId,
    } : null,
  };
}
'''
text = text.replace(insert_after_normalize, insert_after_normalize + helpers, 1)
text, count = re.subn(
    r'function patchToOperations\(\n  patch: ScenarioPatch,\n  prefix: string,\n  tick = 0,\n\): FactoryOperation\[\] \{\n.*?\n\}',
    '''\
function patchToOperations(
  patch: ScenarioPatch,
  prefix: string,
  tick = 0,
): FactoryOperation[] {
  return SCENARIO_CONTROL_FIELDS.flatMap((field) => {
    const value = patch[field];
    if (value === undefined) return [];
    return [
      scenarioControlOperation(field, value, prefix, tick) as FactoryOperation,
    ];
  });
}''',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f"store: patchToOperations matches {count}")
text = text.replace('    runs: {},\n    ledger: [],\n', '    runs: {},\n    runProvenance: {},\n    ledger: [],\n', 1)
runs_block = '''\
        runs: {
          [baselineReceipt.runId]: baselineReceipt,
          [invalidReceipt.runId]: invalidReceipt,
          [validReceipt.runId]: validReceipt,
          [lockedReceipt.runId]: lockedReceipt,
        },
'''
if runs_block not in text:
    raise RuntimeError("store: hydrate runs block mismatch")
text = text.replace(
    runs_block,
    runs_block + '''\
        runProvenance: {
          [baselineReceipt.runId]: baselineRunProvenance(
            baselineReceipt,
            {
              factoryRevision: currentFactoryRevision,
              factoryVersionId: currentFactoryVersionId,
              lockRevision: currentLockRevision,
            },
          ),
          [invalidReceipt.runId]: runProvenanceForScenario(
            invalidReceipt,
            scenarioA,
          ),
          [validReceipt.runId]: {
            runId: validReceipt.runId,
            kind: "scenario",
            scenarioId: "scenario-b",
            scenarioVersionId: "scenario-b-v1",
            displayLabel: "Scenario B · constrained",
            labelTrust: "UNTRUSTED_DISPLAY_TEXT",
            sourceFactoryRevision: 1,
            sourceFactoryVersionId: historicalFactoryVersionId,
            sourceLockRevision: 0,
            scenarioRevision: 1,
            changedControlCount: Object.keys(VALID_PATCH).length,
          },
          [lockedReceipt.runId]: runProvenanceForScenario(
            lockedReceipt,
            scenarioB,
          ),
        },
''',
    1,
)
old_run_insert = '        runs: { ...this.state.runs, [receipt.runId]: receipt },\n'
new_run_insert = (
    '        runs: { ...this.state.runs, [receipt.runId]: receipt },\n'
    '        runProvenance: {\n'
    '          ...this.state.runProvenance,\n'
    '          [receipt.runId]: runProvenanceForScenario(receipt, updated),\n'
    '        },\n'
)
if text.count(old_run_insert) < 1:
    raise RuntimeError("store: no run insertion blocks")
text = text.replace(old_run_insert, new_run_insert)
text = text.replace(
    '      runs: this.state.baselineReceipt ? { [this.state.baselineReceipt.runId]: this.state.baselineReceipt } : {},\n'
    '      ledger: [],\n',
    '      runs: this.state.baselineReceipt ? { [this.state.baselineReceipt.runId]: this.state.baselineReceipt } : {},\n'
    '      runProvenance: this.state.baselineReceipt ? {\n'
    '        [this.state.baselineReceipt.runId]:\n'
    '          this.state.runProvenance[this.state.baselineReceipt.runId]\n'
    '          ?? baselineRunProvenance(this.state.baselineReceipt, {\n'
    '            factoryRevision,\n'
    '            factoryVersionId: `factory-v${factoryRevision}`,\n'
    '            lockRevision,\n'
    '          }),\n'
    '      } : {},\n'
    '      ledger: [],\n',
    1,
)
text = text.replace(
    '        const authorityCurrent = scenarioAuthorityIsCurrent(scenario, this.state);\n'
    '        const receiptCurrent = authorityCurrent\n'
    '          && scenario.receiptLockRevision === this.state.lockRevision\n'
    '          && scenario.receiptScenarioRevision === scenario.revision;\n',
    '        const authorityCurrent = scenarioAuthorityIsCurrent(scenario, this.state);\n'
    '        const currentness = scenarioEvaluationCurrentness(\n'
    '          scenario,\n'
    '          this.state,\n'
    '        );\n',
    1,
)
text = text.replace('          source_is_current: receiptCurrent,\n', '          source_is_current: currentness.sourceIsCurrent,\n          currentness_status: currentness.status,\n', 1)
manual_policy = '''\
        selection_policy: [
          "CURRENT_AND_VALID",
          "ALL_HARD_CONSTRAINTS_PASS",
          "MAX_GOOD_OUTPUT",
          "MIN_TOTAL_COST",
          "MIN_DEFECT_RATE",
          "MIN_CHANGED_CONTROLS",
          "CANONICAL_RUN_ID",
        ],
'''
text = text.replace(manual_policy, '        selection_policy: SELECTION_POLICY,\n', 1)
text = text.replace('      baseline_run_id: this.state.baselineReceipt?.runId ?? null,\n', '      scenario_workspace: scenarioWorkspaceAllocation(this.state),\n      baseline_run_id: this.state.baselineReceipt?.runId ?? null,\n', 1)
evidence_pattern = re.compile(
    r'      evidence_index: this\.state\.scenarios\n'
    r'        \.filter\(\(scenario\) => !scenario\.placeholder && scenario\.receipt\)\n'
    r'        \.map\(\(scenario\) => \(\{\n.*?\n        \}\)\),',
    re.S,
)
evidence_replacement = '''\
      evidence_index: Object.values(this.state.runProvenance)
        .filter((provenance) => provenance.kind === "scenario")
        .sort((left, right) => left.runId.localeCompare(right.runId))
        .map((provenance) => {
          const receipt = this.state.runs[provenance.runId];
          const activeHead = this.state.scenarios.find(
            (scenario) =>
              scenario.id === provenance.scenarioId
              && scenario.headVersionId === provenance.scenarioVersionId,
          );
          return {
            run_id: provenance.runId,
            scenario_id: provenance.scenarioId,
            scenario_version_id: provenance.scenarioVersionId,
            display_label: provenance.displayLabel,
            label_trust: provenance.labelTrust,
            source_factory_revision: provenance.sourceFactoryRevision,
            source_factory_version_id: provenance.sourceFactoryVersionId,
            source_lock_revision: provenance.sourceLockRevision,
            scenario_revision: provenance.scenarioRevision,
            source_is_current: this.runSourceIsCurrent(provenance.runId),
            active_head: Boolean(
              activeHead?.receipt?.runId === provenance.runId,
            ),
            changed_control_count: provenance.changedControlCount,
            feasibility: receipt?.feasibilityStatus ?? null,
            good_output_units: receipt?.rawCounters.goodOutputUnits ?? null,
            total_cost_micro_eur: receipt?.totalCostMicroEur ?? null,
            proof: receipt?.upperBoundProof ? {
              exact_inequality: receipt.upperBoundProof.exactInequality,
              proven: receipt.upperBoundProof.proven,
            } : null,
          };
        }),'''
text, count = evidence_pattern.subn(evidence_replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"store: evidence index matches {count}")
old_currentness = '''\
    const authorityCurrent = scenarioAuthorityIsCurrent(scenario, this.state);
    const sourceIsCurrent = authorityCurrent
      && scenario.receiptLockRevision === this.state.lockRevision
      && scenario.receiptScenarioRevision === scenario.revision;
'''
if old_currentness not in text:
    raise RuntimeError("store: snapshot currentness block missing")
text = text.replace(old_currentness, '    const authorityCurrent = scenarioAuthorityIsCurrent(scenario, this.state);\n    const currentness = scenarioEvaluationCurrentness(\n      scenario,\n      this.state,\n    );\n', 1)
text = text.replace(
    '      source_is_current: sourceIsCurrent,\n'
    '      currentness: {\n'
    '        status: sourceIsCurrent ? "CURRENT" : "HISTORICAL",\n'
    '        invalidated_by: authorityCurrent ? [] : ["AUTHORITY_EPOCH_CHANGED"],\n'
    '      },\n',
    '      source_is_current: currentness.sourceIsCurrent,\n'
    '      currentness: {\n'
    '        status: currentness.status,\n'
    '        invalidated_by: currentness.invalidatedBy,\n'
    '      },\n',
    1,
)
allocation_old = '''\
      const ordered = [...this.state.scenarios].sort((left, right) =>
        left.marker.localeCompare(right.marker),
      );
      const slot = ordered.find((scenario) => scenario.placeholder)
        ?? ordered.find((scenario) => !scenarioAuthorityIsCurrent(scenario, this.state))
        ?? ordered.find((scenario) => scenario.marker === "A")
        ?? ordered[0];
      if (!slot) throw new SandboxCommandError("INTERNAL_ERROR", "The scenario workspace could not allocate a comparison slot.");
'''
if allocation_old not in text:
    raise RuntimeError("store: allocation block missing")
text = text.replace(
    allocation_old,
    '      const allocation = scenarioWorkspaceAllocation(this.state);\n'
    '      const slot = allocation.next_create\n'
    '        ? this.state.scenarios.find(\n'
    '            (scenario) => scenario.id === allocation.next_create?.slot_id,\n'
    '          )\n'
    '        : undefined;\n'
    '      if (!slot) throw new SandboxCommandError("INTERNAL_ERROR", "The scenario workspace could not allocate a comparison slot.");\n',
    1,
)
text = text.replace('        archived_scenario_id: slot.placeholder ? null : slot.id,\n        continuation: continuationForScenario(this.state, created),\n', '        archived_scenario_id: slot.placeholder ? null : slot.id,\n        allocation: allocation.next_create,\n        continuation: continuationForScenario(this.state, created),\n', 1)
text = text.replace('        patch: { ...scenario.patch, ...normalized.changed },\n', '        patch: mergeScenarioPatch(scenario.patch, normalized.changed),\n', 1)
run_current_pattern = re.compile(
    r'  private runSourceIsCurrent\(runId: string\): boolean \{\n'
    r'    if \(this\.state\.baselineReceipt\?\.runId === runId\) return true;\n'
    r'    const scenario = this\.state\.scenarios\.find\(\(item\) => item\.receipt\?\.runId === runId\);\n'
    r'    return Boolean\(\n.*?\n    \);\n  \}',
    re.S,
)
run_current_replacement = '''\
  private runSourceIsCurrent(runId: string): boolean {
    if (this.state.baselineReceipt?.runId === runId) return true;
    const provenance = this.state.runProvenance[runId];
    if (
      !provenance
      || provenance.kind !== "scenario"
      || !provenance.scenarioId
      || !provenance.scenarioVersionId
    ) {
      return false;
    }
    const scenario = this.state.scenarios.find(
      (item) =>
        item.id === provenance.scenarioId
        && item.headVersionId === provenance.scenarioVersionId,
    );
    return Boolean(
      scenario
      && scenarioAuthorityIsCurrent(scenario, this.state)
      && scenario.receipt?.runId === runId
      && scenario.receiptScenarioRevision === scenario.revision
      && scenario.receiptLockRevision === this.state.lockRevision,
    );
  }

  private runChangedControlCount(
    runId: string,
    receipt: SimulationReceipt,
  ): number {
    if (this.state.baselineReceipt?.runId === runId) return 0;
    return (
      this.state.runProvenance[runId]?.changedControlCount
      ?? receipt.acceptedOperations.filter(
        (operation) => operation.actor === "model",
      ).length
    );
  }'''
text, count = run_current_pattern.subn(run_current_replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"store: runSourceIsCurrent matches {count}")
text = text.replace(
    '      return { runId, receipt, sourceIsCurrent: this.runSourceIsCurrent(runId) };\n',
    '      return {\n'
    '        runId,\n'
    '        receipt,\n'
    '        sourceIsCurrent: this.runSourceIsCurrent(runId),\n'
    '        changedControlCount: this.runChangedControlCount(runId, receipt),\n'
    '      };\n',
    1,
)
compare_helpers_pattern = re.compile(
    r'    const defectCompare = \(left: SimulationReceipt, right: SimulationReceipt\) =>\n'
    r'.*?'
    r'    const eligible = receipts\.filter',
    re.S,
)
text, count = compare_helpers_pattern.subn('    const eligible = receipts.filter', text, count=1)
if count != 1:
    raise RuntimeError(f"store: local compare helpers matches {count}")
text = text.replace('    const best = [...eligible].sort(policyCompare)[0];\n', '    const best = [...eligible].sort(compareEvaluatedRuns)[0];\n', 1)
text = text.replace('defectCompare(right.receipt, left.receipt)', 'compareDefectRate(right.receipt, left.receipt)')
text = text.replace(manual_policy.replace('        ', '      '), '      selection_policy: SELECTION_POLICY,\n', 1)
text = text.replace('      anchor_run_id: anchorId,\n', '      anchor_run_id: anchorId,\n      delta_convention: "CANDIDATE_MINUS_ANCHOR",\n', 1)
write("src/app/store.ts", text)

text = read("src/app/commandBus.ts")
old = '''\
  applyScenarioChanges(input: ApplyScenarioChangesInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      return ok(this.store.applyScenarioChanges(input), "Scenario settings committed atomically.");
    } catch (error) {
      return rethrowPublic(error);
    }
  }
'''
new = '''\
  applyScenarioChanges(input: ApplyScenarioChangesInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      const result = this.store.applyScenarioChanges(input);
      return ok(
        result,
        result.committed
          ? "Scenario settings committed atomically."
          : "No scenario settings changed; all requested values already matched the effective scenario.",
      );
    } catch (error) {
      return rethrowPublic(error);
    }
  }
'''
if old not in text:
    raise RuntimeError("commandBus apply block missing")
write("src/app/commandBus.ts", text.replace(old, new, 1))

replace_once(
    "src/webmcp/tools.ts",
    '"Orient before writing: read the mission, exact thresholds, authority epoch, control capabilities, baseline, evidence index, scenario heads, and copy-ready preconditions. This does not change state.",',
    '"Orient before writing: read the mission, exact thresholds, authority epoch, control capabilities, baseline, complete evidence index, scenario heads, deterministic next workspace allocation, and copy-ready preconditions. This does not change state.",',
)
replace_once(
    "src/webmcp/tools.ts",
    '"Create a clean named hypothesis under the authority epoch returned by get_factory_snapshot. Historical scenario heads are never silently rebased. This writes local planning state but never changes human locks.",',
    '"Create a clean named hypothesis under the authority epoch returned by get_factory_snapshot. The snapshot advertises the deterministic slot allocation and any head that will be displaced. Historical scenario heads are never silently rebased. This writes local planning state but never changes human locks.",',
)
replace_once(
    "src/webmcp/tools.ts",
    '"Compare two to four stored receipts with exact deltas, constraint operands, currentness, dominance, and the best evaluated run under the declared policy. This never claims global optimality and does not change state.",',
    '"Compare two to four stored receipts. run_ids[0] is the anchor and every delta is candidate minus anchor. Returns exact operands, currentness, dominance, and the best evaluated run under the declared policy. This never claims global optimality and does not change state.",',
)

text = read("src/app/decisionPacket.ts")
text = text.replace('import type { SandboxState, ScenarioRecord } from "./store";\n', 'import type { SandboxState, ScenarioRecord } from "./store";\nimport {\n  compareEvaluatedRuns,\n  SELECTION_POLICY,\n} from "./selectionPolicy";\n', 1)
text = re.sub(
    r'\nfunction defectCompare\(left: SimulationReceipt, right: SimulationReceipt\): number \{\n.*?\n\}\n\n'
    r'function policyCompare\(\n.*?\n\}\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)
text = text.replace('  const best = [...feasibleCurrent].sort(policyCompare)[0];\n', '  const best = feasibleCurrent\n    .map((item) => ({\n      ...item,\n      runId: item.receipt.runId,\n      changedControlCount: Object.keys(item.scenario.patch).length,\n    }))\n    .sort(compareEvaluatedRuns)[0];\n', 1)
text = text.replace(
    '      selection_policy: [\n'
    '        "CURRENT_AND_VALID",\n'
    '        "ALL_HARD_CONSTRAINTS_PASS",\n'
    '        "MAX_GOOD_OUTPUT",\n'
    '        "MIN_TOTAL_COST",\n'
    '        "MIN_DEFECT_RATE",\n'
    '        "MIN_CHANGED_CONTROLS",\n'
    '        "CANONICAL_ID",\n'
    '      ],\n',
    '      selection_policy: SELECTION_POLICY,\n',
    1,
)
write("src/app/decisionPacket.ts", text)

write("src/app/codexReview.test.ts", '''\
import { describe, expect, it } from "vitest";

import {
  BASELINE_CONTROLS,
  TICK_MINUTES,
} from "../domain";
import {
  BASELINE_SCENARIO_VALUES,
  CONTROL_DEFINITIONS,
  PACKAGING_LOCK_EFFECTIVE_MINUTES,
  PACKAGING_LOCK_EFFECTIVE_TICK,
} from "../shared/controlDefinitions";
import {
  PACKAGING_CALIBRATIONS,
  PACKAGING_CHANGEOVER_MINUTES,
  QUALITY_RATES_UNITS_PER_HOUR,
  SUPPLIER_MODES,
  WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR,
} from "../webmcp/contract-constants";
import {
  COMPARE_SIMULATION_RUNS_SCHEMA,
  SCENARIO_CHANGES_SCHEMA,
} from "../webmcp/schemas";
import { FACTORY_TOOL_SPECS } from "../webmcp/tools";
import { SandboxFactoryCommandBus } from "./commandBus";
import { buildDecisionPacket } from "./decisionPacket";
import { SandboxStore } from "./store";

const context = {
  signal: new AbortController().signal,
  source: "webmcp" as const,
};

async function emptyStore() {
  const store = new SandboxStore();
  await store.hydrateShowcase();
  store.reset();
  return store;
}

function createScenario(
  store: SandboxStore,
  requestId: string,
  name: string,
) {
  const state = store.getSnapshot();
  return store.createScenario({
    request_id: requestId,
    name,
    factory_version_id: state.factoryVersionId,
    expected_factory_revision: state.factoryRevision,
    expected_lock_revision: state.lockRevision,
  });
}

async function simulateMixerScenario(
  store: SandboxStore,
  requestPrefix: string,
  name: string,
  firstMixerValue: number,
  finalMixerValue = firstMixerValue,
) {
  const created = createScenario(store, `${requestPrefix}-create`, name);
  const initial = store.getSnapshot();
  let revised = store.applyScenarioChanges({
    request_id: `${requestPrefix}-apply-1`,
    scenario_id: created.scenario_id,
    expected_factory_revision: initial.factoryRevision,
    expected_scenario_revision: created.scenario_revision,
    expected_lock_revision: initial.lockRevision,
    changes: { mixer_speed_bps: firstMixerValue },
  });
  if (finalMixerValue !== firstMixerValue) {
    revised = store.applyScenarioChanges({
      request_id: `${requestPrefix}-apply-2`,
      scenario_id: created.scenario_id,
      expected_factory_revision: initial.factoryRevision,
      expected_scenario_revision: revised.scenario_revision,
      expected_lock_revision: initial.lockRevision,
      changes: { mixer_speed_bps: finalMixerValue },
    });
  }
  const run = await store.simulateScenarioVersion({
    request_id: `${requestPrefix}-run`,
    scenario_id: created.scenario_id,
    expected_factory_revision: initial.factoryRevision,
    expected_scenario_revision: revised.scenario_revision,
    expected_lock_revision: initial.lockRevision,
    horizon_shifts: 1,
  });
  return { created, revised, run };
}

describe("Codex review regressions", () => {
  it("derives timing, domains, baseline controls, and schemas from the registry", () => {
    expect(PACKAGING_LOCK_EFFECTIVE_MINUTES).toBe(
      PACKAGING_LOCK_EFFECTIVE_TICK * TICK_MINUTES,
    );
    expect(PACKAGING_CHANGEOVER_MINUTES).toBe(
      CONTROL_DEFINITIONS.packaging_changeover_minutes.domain.values,
    );
    expect(PACKAGING_CALIBRATIONS).toBe(
      CONTROL_DEFINITIONS.packaging_calibration.domain.values,
    );
    expect(SUPPLIER_MODES).toBe(
      CONTROL_DEFINITIONS.supplier_mode.domain.values,
    );
    expect(QUALITY_RATES_UNITS_PER_HOUR).toBe(
      CONTROL_DEFINITIONS.quality_rate_units_per_hour.domain.values,
    );
    expect(WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR).toBe(
      CONTROL_DEFINITIONS.warehouse_dock_units_per_hour.domain.values,
    );
    expect(BASELINE_CONTROLS.mixerSpeedBps).toBe(
      BASELINE_SCENARIO_VALUES.mixer_speed_bps,
    );
    expect(
      SCENARIO_CHANGES_SCHEMA.properties.packaging_calibration,
    ).toMatchObject({
      enum: CONTROL_DEFINITIONS.packaging_calibration.domain.values,
    });
  });

  it("announces the deterministic allocation and retains displaced receipts", async () => {
    const store = await emptyStore();
    const first = await simulateMixerScenario(
      store,
      "archive-a",
      "Current A",
      9_000,
    );
    await simulateMixerScenario(
      store,
      "archive-b",
      "Current B",
      9_500,
    );

    const before = store.getFactorySnapshot();
    expect(before.scenario_workspace.next_create).toMatchObject({
      action: "REPLACE_HEAD",
      reason: "DETERMINISTIC_SLOT_A_REPLACEMENT",
      displaced_scenario_id: first.created.scenario_id,
    });

    const replacement = createScenario(
      store,
      "archive-c-create",
      "Replacement C",
    );
    expect(replacement.archived_scenario_id).toBe(
      before.scenario_workspace.next_create?.displaced_scenario_id,
    );

    const after = store.getFactorySnapshot();
    expect(after.evidence_index).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          run_id: first.run.run_id,
          active_head: false,
          source_is_current: false,
        }),
      ]),
    );
  });

  it("labels a current head without a receipt as UNEVALUATED", async () => {
    const store = await emptyStore();
    const created = createScenario(store, "unevaluated-create", "Draft");
    expect(store.getScenarioSnapshot(created.scenario_id)).toMatchObject({
      authority_is_current: true,
      source_is_current: false,
      currentness: {
        status: "UNEVALUATED",
        invalidated_by: [],
      },
    });
  });

  it("documents the first run as the anchor in schema and tool contract", () => {
    const compare = FACTORY_TOOL_SPECS.find(
      (tool) => tool.name === "compare_simulation_runs",
    );
    expect(compare?.description).toContain("run_ids[0] is the anchor");
    expect(
      COMPARE_SIMULATION_RUNS_SCHEMA.properties.run_ids.description,
    ).toContain("candidate minus anchor");
  });

  it("returns a truthful no-op message without advancing the scenario", async () => {
    const store = await emptyStore();
    const created = createScenario(store, "noop-create", "No-op");
    const bus = new SandboxFactoryCommandBus(store);
    const outcome = bus.applyScenarioChanges({
      request_id: "noop-apply",
      scenario_id: created.scenario_id,
      expected_factory_revision: store.getSnapshot().factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: store.getSnapshot().lockRevision,
      changes: {
        mixer_speed_bps: BASELINE_SCENARIO_VALUES.mixer_speed_bps,
      },
    }, context);

    expect(outcome).toMatchObject({
      status: "ok",
      message: expect.stringContaining("No scenario settings changed"),
      data: {
        committed: false,
        scenario_revision: created.scenario_revision,
      },
    });
  });

  it("normalizes baseline-valued overrides and aligns packet/tool tie-breaks", async () => {
    const store = await emptyStore();
    const edited = await simulateMixerScenario(
      store,
      "tie-a",
      "Edited history",
      9_000,
      9_500,
    );
    const direct = await simulateMixerScenario(
      store,
      "tie-b",
      "Direct history",
      9_500,
    );

    expect(
      store.getScenarioSnapshot(edited.created.scenario_id).patch,
    ).toEqual({ mixer_speed_bps: 9_500 });
    expect(
      store.getScenarioSnapshot(direct.created.scenario_id).patch,
    ).toEqual({ mixer_speed_bps: 9_500 });

    const comparison = store.compareRunSet([
      edited.run.run_id,
      direct.run.run_id,
    ]);
    const packet = JSON.parse(buildDecisionPacket(store.getSnapshot())!.json) as {
      decision: { run_id: string | null };
      mission: { selection_policy: readonly string[] };
    };
    expect(packet.decision.run_id).toBe(comparison.best_evaluated_run_id);
    expect(packet.mission.selection_policy).toEqual(
      comparison.selection_policy,
    );
  });

  it("removes an override when a control is returned to baseline", async () => {
    const store = await emptyStore();
    const created = createScenario(store, "baseline-create", "Return baseline");
    const state = store.getSnapshot();
    const changed = store.applyScenarioChanges({
      request_id: "baseline-away",
      scenario_id: created.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: created.scenario_revision,
      expected_lock_revision: state.lockRevision,
      changes: { mixer_speed_bps: 9_500 },
    });
    const restored = store.applyScenarioChanges({
      request_id: "baseline-back",
      scenario_id: created.scenario_id,
      expected_factory_revision: state.factoryRevision,
      expected_scenario_revision: changed.scenario_revision,
      expected_lock_revision: state.lockRevision,
      changes: {
        mixer_speed_bps: BASELINE_SCENARIO_VALUES.mixer_speed_bps,
      },
    });
    expect(restored.committed).toBe(true);
    expect(store.getScenarioSnapshot(created.scenario_id).patch).toEqual({});
  });
});
''')

for path in [
    "src/shared/simulationDefinitions.ts",
    "src/shared/controlDefinitions.ts",
    "src/webmcp/contract-constants.ts",
    "src/webmcp/schemas.ts",
    "src/app/selectionPolicy.ts",
    "src/app/codexReview.test.ts",
]:
    content = read(path)
    if not content.endswith("\n"):
        write(path, content + "\n")
