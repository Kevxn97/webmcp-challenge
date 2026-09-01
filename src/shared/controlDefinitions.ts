import {
  PACKAGING_LOCK_EFFECTIVE_MINUTES,
  PACKAGING_LOCK_EFFECTIVE_TICK,
} from "./simulationContract";

export {
  PACKAGING_LOCK_EFFECTIVE_MINUTES,
  PACKAGING_LOCK_EFFECTIVE_TICK,
} from "./simulationContract";

export const SPEED_BPS_MIN = 5_000 as const;
export const SPEED_BPS_MAX = 10_000 as const;

export type ControlResource =
  | "Supplier"
  | "Mixer"
  | "Packaging"
  | "Quality Gate"
  | "Warehouse";

export type ControlUnit =
  | "basis_points_of_nameplate"
  | "minutes"
  | "mode"
  | "units_per_hour";

export type ControlApplicationPhase = "pre_shift" | "runtime";

type RangeDomain = {
  readonly type: "range";
  readonly minimum: number;
  readonly maximum: number;
};

type EnumDomain<TValue extends string | number = string | number> = {
  readonly type: "enum";
  readonly values: readonly TValue[];
};

export type ControlDomain = RangeDomain | EnumDomain;

type DomainValue<TDomain extends ControlDomain> =
  TDomain extends RangeDomain
    ? number
    : TDomain extends EnumDomain<infer TValue>
      ? TValue
      : never;

interface ControlDefinition<
  TDomain extends ControlDomain,
  TEngineControlKey extends string,
  TOperationKind extends string,
  TOperationValueKey extends string,
> {
  readonly label: string;
  readonly description: string;
  readonly resource: ControlResource;
  readonly unit: ControlUnit;
  readonly applicationPhase: ControlApplicationPhase;
  readonly domain: TDomain;
  readonly baselineValue: DomainValue<TDomain>;
  readonly engineControlKey: TEngineControlKey;
  readonly blockedByPackagingLock: boolean;
  readonly operation: {
    readonly kind: TOperationKind;
    readonly valueKey: TOperationValueKey;
    readonly idSuffix: string;
  };
}

function defineControl<
  const TDomain extends ControlDomain,
  const TEngineControlKey extends string,
  const TOperationKind extends string,
  const TOperationValueKey extends string,
>(
  definition: ControlDefinition<
    TDomain,
    TEngineControlKey,
    TOperationKind,
    TOperationValueKey
  >,
) {
  return definition;
}

export const CONTROL_DEFINITIONS = {
  mixer_speed_bps: defineControl({
    label: "Mixer speed",
    description:
      "Mixer speed as basis points of equipment nameplate (10000 = 100%).",
    resource: "Mixer",
    unit: "basis_points_of_nameplate",
    applicationPhase: "runtime",
    domain: {
      type: "range",
      minimum: SPEED_BPS_MIN,
      maximum: SPEED_BPS_MAX,
    },
    baselineValue: 8_750,
    engineControlKey: "mixerSpeedBps",
    blockedByPackagingLock: false,
    operation: {
      kind: "SET_MIXER_SPEED",
      valueKey: "valueBps",
      idSuffix: "mixer-speed",
    },
  }),
  packaging_speed_bps: defineControl({
    label: "Packaging speed",
    description:
      "Packaging speed as basis points of equipment nameplate (10000 = 100%).",
    resource: "Packaging",
    unit: "basis_points_of_nameplate",
    applicationPhase: "runtime",
    domain: {
      type: "range",
      minimum: SPEED_BPS_MIN,
      maximum: SPEED_BPS_MAX,
    },
    baselineValue: 7_500,
    engineControlKey: "packagingSpeedBps",
    blockedByPackagingLock: true,
    operation: {
      kind: "SET_PACKAGING_SPEED",
      valueKey: "valueBps",
      idSuffix: "packaging-speed",
    },
  }),
  packaging_changeover_minutes: defineControl({
    label: "Packaging changeover",
    description: "Packaging changeover duration in minutes.",
    resource: "Packaging",
    unit: "minutes",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: [15, 30, 45] },
    baselineValue: 30,
    engineControlKey: "changeoverMinutes",
    blockedByPackagingLock: true,
    operation: {
      kind: "SET_CHANGEOVER_MINUTES",
      valueKey: "valueMinutes",
      idSuffix: "changeover",
    },
  }),
  packaging_calibration: defineControl({
    label: "Packaging calibration",
    description: "Packaging calibration mode.",
    resource: "Packaging",
    unit: "mode",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: ["standard", "enhanced"] },
    baselineValue: "standard",
    engineControlKey: "calibration",
    blockedByPackagingLock: true,
    operation: {
      kind: "SET_CALIBRATION",
      valueKey: "value",
      idSuffix: "calibration",
    },
  }),
  supplier_mode: defineControl({
    label: "Supplier mode",
    description: "Supplier service mode.",
    resource: "Supplier",
    unit: "mode",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: ["standard", "expedite"] },
    baselineValue: "standard",
    engineControlKey: "supplierMode",
    blockedByPackagingLock: false,
    operation: {
      kind: "SET_SUPPLIER_MODE",
      valueKey: "value",
      idSuffix: "supplier",
    },
  }),
  quality_rate_units_per_hour: defineControl({
    label: "Quality Gate rate",
    description: "Quality-gate inspection capacity in units per hour.",
    resource: "Quality Gate",
    unit: "units_per_hour",
    applicationPhase: "runtime",
    domain: { type: "enum", values: [600, 700, 800, 900] },
    baselineValue: 800,
    engineControlKey: "qualityRateUnitsPerHour",
    blockedByPackagingLock: false,
    operation: {
      kind: "SET_QUALITY_RATE",
      valueKey: "valueUnitsPerHour",
      idSuffix: "quality",
    },
  }),
  warehouse_dock_units_per_hour: defineControl({
    label: "Warehouse dock rate",
    description: "Warehouse dock capacity in units per hour.",
    resource: "Warehouse",
    unit: "units_per_hour",
    applicationPhase: "runtime",
    domain: { type: "enum", values: [800, 900, 1000] },
    baselineValue: 900,
    engineControlKey: "warehouseRateUnitsPerHour",
    blockedByPackagingLock: false,
    operation: {
      kind: "SET_WAREHOUSE_RATE",
      valueKey: "valueUnitsPerHour",
      idSuffix: "warehouse",
    },
  }),
} as const;

export type ScenarioControlField = keyof typeof CONTROL_DEFINITIONS;

export type ScenarioControlValueMap = {
  [Field in ScenarioControlField]: DomainValue<
    (typeof CONTROL_DEFINITIONS)[Field]["domain"]
  >;
};

export type ScenarioControlPatch = Partial<ScenarioControlValueMap>;

export type EngineControlValueMap = {
  [Field in ScenarioControlField as
    (typeof CONTROL_DEFINITIONS)[Field]["engineControlKey"]]:
      ScenarioControlValueMap[Field];
};

export type ScenarioOperationKind =
  (typeof CONTROL_DEFINITIONS)[ScenarioControlField]["operation"]["kind"];

export const SCENARIO_CONTROL_FIELDS = Object.freeze(
  Object.keys(CONTROL_DEFINITIONS) as ScenarioControlField[],
);

export const CONTROL_OPERATION_KINDS = Object.freeze(
  SCENARIO_CONTROL_FIELDS.map(
    (field) => CONTROL_DEFINITIONS[field].operation.kind,
  ),
) as readonly ScenarioOperationKind[];

export const CONTROL_RESOURCES = Object.freeze(
  Array.from(
    new Set(
      SCENARIO_CONTROL_FIELDS.map(
        (field) => CONTROL_DEFINITIONS[field].resource,
      ),
    ),
  ),
) as readonly ControlResource[];

export const BASELINE_SCENARIO_VALUES = Object.freeze(
  Object.fromEntries(
    SCENARIO_CONTROL_FIELDS.map((field) => [
      field,
      CONTROL_DEFINITIONS[field].baselineValue,
    ]),
  ),
) as Readonly<ScenarioControlValueMap>;

export const BASELINE_ENGINE_CONTROLS = Object.freeze(
  Object.fromEntries(
    SCENARIO_CONTROL_FIELDS.map((field) => [
      CONTROL_DEFINITIONS[field].engineControlKey,
      BASELINE_SCENARIO_VALUES[field],
    ]),
  ),
) as Readonly<EngineControlValueMap>;

export const PACKAGING_CONTROL_FIELDS = Object.freeze(
  SCENARIO_CONTROL_FIELDS.filter(
    (field) => CONTROL_DEFINITIONS[field].blockedByPackagingLock,
  ),
) as readonly ScenarioControlField[];

export const PRE_SHIFT_CONTROL_FIELDS = Object.freeze(
  SCENARIO_CONTROL_FIELDS.filter(
    (field) => CONTROL_DEFINITIONS[field].applicationPhase === "pre_shift",
  ),
) as readonly ScenarioControlField[];

export const POST_LOCK_AVAILABLE_CONTROL_FIELDS = Object.freeze(
  SCENARIO_CONTROL_FIELDS.filter((field) => {
    const definition = CONTROL_DEFINITIONS[field];
    return !definition.blockedByPackagingLock
      && definition.applicationPhase === "runtime";
  }),
) as readonly ScenarioControlField[];

const CONTROL_FIELD_BY_OPERATION_KIND = Object.freeze(
  Object.fromEntries(
    SCENARIO_CONTROL_FIELDS.map((field) => [
      CONTROL_DEFINITIONS[field].operation.kind,
      field,
    ]),
  ),
) as Readonly<Record<ScenarioOperationKind, ScenarioControlField>>;

export function controlFieldForOperationKind(
  kind: string,
): ScenarioControlField | null {
  return CONTROL_FIELD_BY_OPERATION_KIND[kind as ScenarioOperationKind] ?? null;
}

export function controlFieldsForResource(
  resource: ControlResource,
): readonly ScenarioControlField[] {
  return SCENARIO_CONTROL_FIELDS.filter(
    (field) => CONTROL_DEFINITIONS[field].resource === resource,
  );
}

export function isScenarioControlValue<Field extends ScenarioControlField>(
  field: Field,
  value: unknown,
): value is ScenarioControlValueMap[Field] {
  const domain = CONTROL_DEFINITIONS[field].domain;
  if (domain.type === "range") {
    return typeof value === "number"
      && Number.isSafeInteger(value)
      && value >= domain.minimum
      && value <= domain.maximum;
  }
  return (domain.values as readonly unknown[]).includes(value);
}

export function expectedControlDomain(field: ScenarioControlField): string {
  const domain = CONTROL_DEFINITIONS[field].domain;
  return domain.type === "range"
    ? `an integer from ${domain.minimum} to ${domain.maximum}`
    : `one of: ${domain.values.join(", ")}`;
}

export function controlValueFromEngineControls<Field extends ScenarioControlField>(
  controls: EngineControlValueMap,
  field: Field,
): ScenarioControlValueMap[Field] {
  const engineKey = CONTROL_DEFINITIONS[field].engineControlKey;
  return controls[engineKey] as ScenarioControlValueMap[Field];
}
