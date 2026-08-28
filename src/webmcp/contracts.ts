export const FACTORY_TOOL_SCHEMA_VERSION = "factory-tools/v1" as const;

export const FACTORY_TOOL_CODES = [
  "OK",
  "STALE_FACTORY",
  "STALE_SCENARIO",
  "LOCK_CHANGED",
  "HUMAN_LOCKED",
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
  signal: AbortSignal;
  source: "webmcp";
}

export type GetFactorySnapshotInput = Record<string, never>;

export interface GetScenarioSnapshotInput {
  scenario_id: string;
}

export interface CreateScenarioInput {
  request_id: string;
  name: string;
  factory_version_id: string;
  expected_factory_revision: number;
  expected_lock_revision: number;
}

export type PackagingCalibration = "standard" | "enhanced";
export type SupplierMode = "standard" | "expedite";

export interface ScenarioChanges {
  mixer_speed_bps?: number;
  packaging_speed_bps?: number;
  packaging_changeover_minutes?: 15 | 30 | 45;
  packaging_calibration?: PackagingCalibration;
  supplier_mode?: SupplierMode;
  quality_rate_units_per_hour?: 600 | 700 | 800 | 900;
  warehouse_dock_units_per_hour?: 800 | 900 | 1000;
}

export interface ApplyScenarioChangesInput {
  request_id: string;
  scenario_id: string;
  expected_factory_revision: number;
  expected_scenario_revision: number;
  expected_lock_revision: number;
  changes: ScenarioChanges;
}

export interface RunFactorySimulationInput {
  request_id: string;
  scenario_id: string;
  expected_factory_revision: number;
  expected_scenario_revision: number;
  expected_lock_revision: number;
  horizon_shifts: 1;
}

export interface CompareSimulationRunsInput {
  run_ids: string[];
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
  signal: AbortSignal;
}

export interface WebMcpToolDescriptor {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: WebMcpToolAnnotations;
  execute(
    input: unknown,
    metadata: WebMcpExecutionMetadata,
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
