import { BASELINE_ENGINE_CONTROLS } from "../shared/controlDefinitions";
import type { AssetRecord, FactoryControls, MaterialDelivery } from "./types";

export { TICK_MINUTES, TOTAL_TICKS } from "../shared/simulationContract";

export const INPUT_VERSION = "factory-input/v1" as const;
export const RECEIPT_VERSION = "factory-receipt/v1" as const;
export const ENGINE_VERSION = "factory-engine/1.0.0" as const;
export const ENERGY_MODEL_VERSION = "factory-energy/v1" as const;

export const UNIT_MASS_GRAMS = 1_000;
export const MIXER_NAMEPLATE_GRAMS_PER_HOUR = 800_000;
export const PACKAGING_NAMEPLATE_UNITS_PER_HOUR = 800;

export const BASELINE_CONTROLS: Readonly<FactoryControls> =
  BASELINE_ENGINE_CONTROLS;

export const BASELINE_DELIVERIES: readonly MaterialDelivery[] = Object.freeze(
  [0, 16, 32, 48].map((tick) =>
    Object.freeze({
      deliveryId: `delivery-${String(tick).padStart(2, "0")}`,
      tick,
      grams: 3_200_000,
    }),
  ),
);

export const ASSET_INVENTORY: readonly AssetRecord[] = Object.freeze([
  Object.freeze({
    assetId: "mixer-01",
    resource: "Mixer",
    assetType: "800kg-per-hour-mixer",
  }),
  Object.freeze({
    assetId: "packaging-01",
    resource: "Packaging",
    assetType: "800-unit-per-hour-packaging-line",
  }),
  Object.freeze({
    assetId: "quality-gate-01",
    resource: "Quality Gate",
    assetType: "inline-quality-gate",
  }),
  Object.freeze({
    assetId: "warehouse-line-01",
    resource: "Warehouse",
    assetType: "warehouse-receiving-line",
  }),
]);

export const BASELINE_GROSS_UNITS = 9_300;
export const BASELINE_BAD_UNITS = 186;
export const BASELINE_GOOD_OUTPUT_UNITS = 9_114;
export const TARGET_GOOD_OUTPUT_UNITS = 10_937;
export const BASE_DEFECT_PROPENSITY_BPS = 200;

export const COST_RATES = Object.freeze({
  fixedMicroEurPerRun: 32_000_000_000n,
  rawMaterialMicroEurPerGram: 750n,
  packagingMicroEurPerGrossUnit: 150_000n,
  inspectionMicroEurPerInspectedUnit: 80_000n,
  scrapMicroEurPerBadUnit: 250_000n,
  electricityMicroEurPerKwh: 250_000n,
  enhancedCalibrationMicroEurPerRun: 350_000_000n,
  fifteenMinuteSmedMicroEurPerRun: 250_000_000n,
  expediteMicroEurPerRun: 2_500_000_000n,
});

export const ENERGY_POWER_WATTS = Object.freeze({
  mixerAtFullCommand: 120_000,
  packagingAtFullCommand: 60_000,
  qualityGateAtNameplate: 20_000,
  warehouseAtNameplate: 15_000,
});

export const LOCK_PROOF_DEFECT_HORIZON_UNITS = 300;
