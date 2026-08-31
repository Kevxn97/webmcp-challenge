export const SPEED_BPS_MIN = 5_000 as const;
export const SPEED_BPS_MAX = 10_000 as const;

export const PACKAGING_LOCK_EFFECTIVE_TICK = 16 as const;
export const PACKAGING_LOCK_EFFECTIVE_MINUTES = 240 as const;

export const CONTROL_DEFINITIONS = {
  mixer_speed_bps: {
    label: "Mixer speed",
    resource: "Mixer",
    unit: "basis_points_of_nameplate",
    applicationPhase: "runtime",
    domain: { type: "range", minimum: SPEED_BPS_MIN, maximum: SPEED_BPS_MAX },
    blockedByPackagingLock: false,
  },
  packaging_speed_bps: {
    label: "Packaging speed",
    resource: "Packaging",
    unit: "basis_points_of_nameplate",
    applicationPhase: "runtime",
    domain: { type: "range", minimum: SPEED_BPS_MIN, maximum: SPEED_BPS_MAX },
    blockedByPackagingLock: true,
  },
  packaging_changeover_minutes: {
    label: "Packaging changeover",
    resource: "Packaging",
    unit: "minutes",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: [15, 30, 45] },
    blockedByPackagingLock: true,
  },
  packaging_calibration: {
    label: "Packaging calibration",
    resource: "Packaging",
    unit: "mode",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: ["standard", "enhanced"] },
    blockedByPackagingLock: true,
  },
  supplier_mode: {
    label: "Supplier mode",
    resource: "Supplier",
    unit: "mode",
    applicationPhase: "pre_shift",
    domain: { type: "enum", values: ["standard", "expedite"] },
    blockedByPackagingLock: false,
  },
  quality_rate_units_per_hour: {
    label: "Quality Gate rate",
    resource: "Quality Gate",
    unit: "units_per_hour",
    applicationPhase: "runtime",
    domain: { type: "enum", values: [600, 700, 800, 900] },
    blockedByPackagingLock: false,
  },
  warehouse_dock_units_per_hour: {
    label: "Warehouse dock rate",
    resource: "Warehouse",
    unit: "units_per_hour",
    applicationPhase: "runtime",
    domain: { type: "enum", values: [800, 900, 1000] },
    blockedByPackagingLock: false,
  },
} as const;

export type ScenarioControlField = keyof typeof CONTROL_DEFINITIONS;

export const SCENARIO_CONTROL_FIELDS = Object.freeze(
  Object.keys(CONTROL_DEFINITIONS) as ScenarioControlField[],
);

export const PACKAGING_CONTROL_FIELDS = [
  "packaging_speed_bps",
  "packaging_changeover_minutes",
  "packaging_calibration",
] as const satisfies readonly ScenarioControlField[];

export const PRE_SHIFT_CONTROL_FIELDS = [
  "packaging_changeover_minutes",
  "packaging_calibration",
  "supplier_mode",
] as const satisfies readonly ScenarioControlField[];

export const POST_LOCK_AVAILABLE_CONTROL_FIELDS = [
  "mixer_speed_bps",
  "quality_rate_units_per_hour",
  "warehouse_dock_units_per_hour",
] as const satisfies readonly ScenarioControlField[];
