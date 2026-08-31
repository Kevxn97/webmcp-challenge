import {
  PACKAGING_CALIBRATIONS,
  PACKAGING_CHANGEOVER_MINUTES,
  QUALITY_RATES_UNITS_PER_HOUR,
  SIMULATION_HORIZON_SHIFTS,
  SUPPLIER_MODES,
  WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR,
} from "./contract-constants";

export const FACTORY_TOOL_SCHEMA_VERSION = "factory-tools/v1" as const;

export const FACTORY_TOOL_CODES = [
  "OK",
  "STALE_FACTORY",
  "STALE_SCENARIO",
  "LOCK_CHANGED",
  "HUMAN_LOCKED",
  "PHASE_CLOSED",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "IDEMPOTENCY_KEY_REUSED",
  "ABORTED",
  "INTERNAL_ERROR",
] as const;

export type FactoryToolCode = (typeof FACTORY_TOOL_CODES)[number];
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface FactoryToolEnvelope<TData extends JsonValue = JsonValue> {
  schema_version: typeof FACTORY_TOOL_SCHEMA_VERSION;
  status: "ok" | "error";
  code: FactoryToolCode;
  request_id: string | null;
  message: string;
  data: TData;
}

export interface CommandOutcome<TData = unknown> {
  status: "ok" | "error";
  code: FactoryToolCode;
  message: string;
  data: TData;
}

export interface ToolExecutionContext {
  readonly signal: AbortSignal;
  readonly source: "webmcp";
}

export type GetFactorySnapshotInput = Readonly<Record<string, never>>;

export interface GetScenarioSnapshotInput {
  readonly scenario_id: string;
}

export interface CreateScenarioInput {
  readonly request_id: string;
  readonly name: string;
  readonly factory_version_id: string;
  readonly expected_factory_revision: number;
  readonly expected_lock_revision: number;
}

export type PackagingChangeoverMinutes =
  (typeof PACKAGING_CHANGEOVER_MINUTES)[number];
export type PackagingCalibration = (typeof PACKAGING_CALIBRATIONS)[number];
export type SupplierMode = (typeof SUPPLIER_MODES)[number];
export type QualityRateUnitsPerHour =
  (typeof QUALITY_RATES_UNITS_PER_HOUR)[number];
export type WarehouseDockUnitsPerHour =
  (typeof WAREHOUSE_DOCK_RATES_UNITS_PER_HOUR)[number];
export type SimulationHorizonShifts =
  (typeof SIMULATION_HORIZON_SHIFTS)[number];

export interface ScenarioChanges {
  readonly mixer_speed_bps?: number;
  readonly packaging_speed_bps?: number;
  readonly packaging_changeover_minutes?: PackagingChangeoverMinutes;
  readonly packaging_calibration?: PackagingCalibration;
  readonly supplier_mode?: SupplierMode;
  readonly quality_rate_units_per_hour?: QualityRateUnitsPerHour;
  readonly warehouse_dock_units_per_hour?: WarehouseDockUnitsPerHour;
}

export interface ApplyScenarioChangesInput {
  readonly request_id: string;
  readonly scenario_id: string;
  readonly expected_factory_revision: number;
  readonly expected_scenario_revision: number;
  readonly expected_lock_revision: number;
  readonly changes: ScenarioChanges;
}

export interface RunFactorySimulationInput {
  readonly request_id: string;
  readonly scenario_id: string;
  readonly expected_factory_revision: number;
  readonly expected_scenario_revision: number;
  readonly expected_lock_revision: number;
  readonly horizon_shifts: SimulationHorizonShifts;
}

export interface CompareSimulationRunsInput {
  readonly run_ids: readonly string[];
}

export interface FactoryCommandBus {
  getFactorySnapshot(
    input: GetFactorySnapshotInput,
    context: ToolExecutionContext,
  ): CommandOutcome | Promise<CommandOutcome>;
  getScenarioSnapshot(
    input: GetScenarioSnapshotInput,
    context: ToolExecutionContext,
  ): CommandOutcome | Promise<CommandOutcome>;
  createScenario(
    input: CreateScenarioInput,
    context: ToolExecutionContext,
  ): CommandOutcome | Promise<CommandOutcome>;
  applyScenarioChanges(
    input: ApplyScenarioChangesInput,
    context: ToolExecutionContext,
  ): CommandOutcome | Promise<CommandOutcome>;
  runFactorySimulation(
    input: RunFactorySimulationInput,
    context: ToolExecutionContext,
  ): CommandOutcome | Promise<CommandOutcome>;
  compareSimulationRuns(
    input: CompareSimulationRunsInput,
    context: ToolExecutionContext,
  ): CommandOutcome | Promise<CommandOutcome>;
  awaitVisibleCommit(context: ToolExecutionContext): void | Promise<void>;
}

export class FactoryCommandError extends Error {
  readonly code: Exclude<FactoryToolCode, "OK">;
  readonly publicMessage: string;
  readonly data: unknown;

  constructor(
    code: Exclude<FactoryToolCode, "OK">,
    publicMessage: string,
    data: unknown = null,
  ) {
    super(publicMessage);
    this.name = "FactoryCommandError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.data = data;
  }
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required: readonly string[];
  additionalProperties: false;
  minProperties?: number;
  maxProperties?: number;
}

export type JsonSchemaProperty =
  | {
      type: "string";
      description: string;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      enum?: readonly string[];
    }
  | {
      type: "integer";
      description: string;
      minimum?: number;
      maximum?: number;
      enum?: readonly number[];
    }
  | {
      type: "array";
      description: string;
      items: JsonSchemaProperty;
      minItems: number;
      maxItems: number;
      uniqueItems?: boolean;
    }
  | (JsonSchema & { description: string });

export interface WebMcpToolAnnotations {
  readOnlyHint: boolean;
  untrustedContentHint: boolean;
}

export interface WebMcpExecutionMetadata {
  readonly signal: AbortSignal;
}

export interface WebMcpToolDescriptor {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: WebMcpToolAnnotations;
  execute(
    input: unknown,
    metadata?: WebMcpExecutionMetadata,
  ): FactoryToolEnvelope | Promise<FactoryToolEnvelope>;
}

export interface WebMcpModelContext {
  registerTool(
    descriptor: WebMcpToolDescriptor,
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}

export interface WebMcpDocumentLike {
  modelContext?: Partial<WebMcpModelContext> | null;
}

export interface WebMcpRegistration {
  readonly supported: boolean;
  readonly ready: Promise<void>;
  cleanup(): void;
}
