import {
  FACTORY_TOOL_CODES,
  FACTORY_TOOL_SCHEMA_VERSION,
  FactoryCommandError,
  type ApplyScenarioChangesInput,
  type CommandOutcome,
  type CompareSimulationRunsInput,
  type CreateScenarioInput,
  type FactoryCommandBus,
  type FactoryToolCode,
  type FactoryToolEnvelope,
  type GetFactorySnapshotInput,
  type GetScenarioSnapshotInput,
  type JsonSchema,
  type JsonValue,
  type RunFactorySimulationInput,
  type ToolExecutionContext,
  type WebMcpToolDescriptor,
} from "./contracts";
import {
  APPLY_SCENARIO_CHANGES_SCHEMA,
  COMPARE_SIMULATION_RUNS_SCHEMA,
  CREATE_SCENARIO_SCHEMA,
  GET_FACTORY_SNAPSHOT_SCHEMA,
  GET_SCENARIO_SNAPSHOT_SCHEMA,
  RUN_FACTORY_SIMULATION_SCHEMA,
} from "./schemas";
import {
  extractRequestId,
  validateApplyScenarioChangesInput,
  validateCompareSimulationRunsInput,
  validateCreateScenarioInput,
  validateGetFactorySnapshotInput,
  validateGetScenarioSnapshotInput,
  validateRunFactorySimulationInput,
  type ValidationResult,
} from "./validation";

export const FACTORY_TOOL_NAMES = [
  "get_factory_snapshot",
  "get_scenario_snapshot",
  "create_scenario",
  "apply_scenario_changes",
  "run_factory_simulation",
  "compare_simulation_runs",
] as const;

export type FactoryToolName = (typeof FACTORY_TOOL_NAMES)[number];

interface FactoryToolSpec<TInput> {
  name: FactoryToolName;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  readOnly: boolean;
  validate(input: unknown): ValidationResult<TInput>;
  invoke(
    bus: FactoryCommandBus,
    input: TInput,
    context: ToolExecutionContext,
  ): CommandOutcome | Promise<CommandOutcome>;
}

const GET_FACTORY_SNAPSHOT_SPEC: FactoryToolSpec<GetFactorySnapshotInput> = {
  name: "get_factory_snapshot",
  title: "Inspect current factory",
  description:
    "Read the current immutable factory version, live revision, human locks, stations, baseline metrics, and constraint brief. This does not change state.",
  inputSchema: GET_FACTORY_SNAPSHOT_SCHEMA,
  readOnly: true,
  validate: validateGetFactorySnapshotInput,
  invoke: (bus, input, context) => bus.getFactorySnapshot(input, context),
};

const GET_SCENARIO_SNAPSHOT_SPEC: FactoryToolSpec<GetScenarioSnapshotInput> = {
  name: "get_scenario_snapshot",
  title: "Inspect scenario",
  description:
    "Read one scenario, its absolute changes, source revisions, staleness state, and latest simulation receipt. This does not change state.",
  inputSchema: GET_SCENARIO_SNAPSHOT_SCHEMA,
  readOnly: true,
  validate: validateGetScenarioSnapshotInput,
  invoke: (bus, input, context) => bus.getScenarioSnapshot(input, context),
};

const CREATE_SCENARIO_SPEC: FactoryToolSpec<CreateScenarioInput> = {
  name: "create_scenario",
  title: "Create planning scenario",
  description:
    "Create a named scenario from the specified immutable factory version. Fails closed if the factory or human-lock revision changed. This writes local planning state but never changes human locks.",
  inputSchema: CREATE_SCENARIO_SCHEMA,
  readOnly: false,
  validate: validateCreateScenarioInput,
  invoke: (bus, input, context) => bus.createScenario(input, context),
};

const APPLY_SCENARIO_CHANGES_SPEC: FactoryToolSpec<ApplyScenarioChangesInput> = {
  name: "apply_scenario_changes",
  title: "Apply scenario settings",
  description:
    "Atomically apply absolute operating settings to a scenario. Fails closed on stale factory, scenario, or lock revisions and when a human-locked resource would change. This never overrides or edits human locks.",
  inputSchema: APPLY_SCENARIO_CHANGES_SCHEMA,
  readOnly: false,
  validate: validateApplyScenarioChangesInput,
  invoke: (bus, input, context) => bus.applyScenarioChanges(input, context),
};

const RUN_FACTORY_SIMULATION_SPEC: FactoryToolSpec<RunFactorySimulationInput> = {
  name: "run_factory_simulation",
  title: "Run deterministic simulation",
  description:
    "Run and store a deterministic receipt for one 16-hour, 64-tick factory shift. Fails closed on stale factory, scenario, or human-lock revisions.",
  inputSchema: RUN_FACTORY_SIMULATION_SCHEMA,
  readOnly: false,
  validate: validateRunFactorySimulationInput,
  invoke: (bus, input, context) => bus.runFactorySimulation(input, context),
};

const COMPARE_SIMULATION_RUNS_SPEC: FactoryToolSpec<CompareSimulationRunsInput> = {
  name: "compare_simulation_runs",
  title: "Compare simulation receipts",
  description:
    "Compare two to four stored simulation receipts, including feasibility, constraint evidence, source revisions, and whether each source is still current. This does not change state.",
  inputSchema: COMPARE_SIMULATION_RUNS_SCHEMA,
  readOnly: true,
  validate: validateCompareSimulationRunsInput,
  invoke: (bus, input, context) => bus.compareSimulationRuns(input, context),
};

export const FACTORY_TOOL_SPECS = [
  GET_FACTORY_SNAPSHOT_SPEC,
  GET_SCENARIO_SNAPSHOT_SPEC,
  CREATE_SCENARIO_SPEC,
  APPLY_SCENARIO_CHANGES_SPEC,
  RUN_FACTORY_SIMULATION_SPEC,
  COMPARE_SIMULATION_RUNS_SPEC,
] as const;

const FACTORY_TOOL_CODE_SET = new Set<FactoryToolCode>(FACTORY_TOOL_CODES);

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

function isPlainJsonValue(
  value: unknown,
  ancestors = new Set<object>(),
  depth = 0,
): value is JsonValue {
  if (depth > 64) {
    return false;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  let result: boolean;
  if (Array.isArray(value)) {
    result = value.every((item) => isPlainJsonValue(item, ancestors, depth + 1));
  } else if (
    isPlainRecord(value) &&
    Object.getOwnPropertySymbols(value).length === 0
  ) {
    result = Object.keys(value).every((key) =>
      isPlainJsonValue(value[key], ancestors, depth + 1),
    );
  } else {
    result = false;
  }
  ancestors.delete(value);
  return result;
}

function isSafeMessage(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 500;
}

function normalizeOutcome(
  outcome: unknown,
  requestId: string | null,
): FactoryToolEnvelope | null {
  if (!isPlainRecord(outcome)) {
    return null;
  }
  const allowedKeys = new Set(["status", "code", "message", "data"]);
  if (Object.keys(outcome).some((key) => !allowedKeys.has(key))) {
    return null;
  }
  if (
    (outcome.status !== "ok" && outcome.status !== "error") ||
    typeof outcome.code !== "string" ||
    !FACTORY_TOOL_CODE_SET.has(outcome.code as FactoryToolCode) ||
    !isSafeMessage(outcome.message) ||
    !isPlainJsonValue(outcome.data)
  ) {
    return null;
  }

  const code = outcome.code as FactoryToolCode;
  if (
    (outcome.status === "ok" && code !== "OK") ||
    (outcome.status === "error" && code === "OK")
  ) {
    return null;
  }

  return {
    schema_version: FACTORY_TOOL_SCHEMA_VERSION,
    status: outcome.status,
    code,
    request_id: requestId,
    message: outcome.message,
    data: outcome.data,
  };
}

function errorEnvelope(
  code: Exclude<FactoryToolCode, "OK">,
  requestId: string | null,
  message: string,
  data: JsonValue = null,
): FactoryToolEnvelope {
  return {
    schema_version: FACTORY_TOOL_SCHEMA_VERSION,
    status: "error",
    code,
    request_id: requestId,
    message,
    data,
  };
}

function abortedEnvelope(requestId: string | null): FactoryToolEnvelope {
  return errorEnvelope(
    "ABORTED",
    requestId,
    "The operation was aborted before completion.",
  );
}

function isAbortError(error: unknown): boolean {
  try {
    return (
      (typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError") ||
      (isPlainRecord(error) && error.name === "AbortError")
    );
  } catch {
    return false;
  }
}

function expectedErrorEnvelope(
  error: FactoryCommandError,
  requestId: string | null,
): FactoryToolEnvelope {
  try {
    if (!isSafeMessage(error.publicMessage) || !isPlainJsonValue(error.data)) {
      return internalErrorEnvelope(requestId);
    }

    return errorEnvelope(error.code, requestId, error.publicMessage, error.data);
  } catch {
    return internalErrorEnvelope(requestId);
  }
}

function internalErrorEnvelope(requestId: string | null): FactoryToolEnvelope {
  return errorEnvelope(
    "INTERNAL_ERROR",
    requestId,
    "The operation could not be completed.",
  );
}

function createDescriptor<TInput>(
  spec: FactoryToolSpec<TInput>,
  getBus: () => FactoryCommandBus,
): WebMcpToolDescriptor {
  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: {
      readOnlyHint: spec.readOnly,
      untrustedContentHint: true,
    },
    execute: async (input, { signal }) => {
      let requestId: string | null = null;
      try {
        requestId = spec.readOnly ? null : extractRequestId(input);
      } catch {
        return errorEnvelope(
          "VALIDATION_ERROR",
          null,
          "The tool input did not match the required contract.",
          { issues: ["input must be a readable plain JSON object."] },
        );
      }
      if (signal.aborted) {
        return abortedEnvelope(requestId);
      }

      let validation: ValidationResult<TInput>;
      try {
        validation = spec.validate(input);
      } catch {
        return errorEnvelope(
          "VALIDATION_ERROR",
          requestId,
          "The tool input did not match the required contract.",
          { issues: ["input must be a readable plain JSON object."] },
        );
      }
      if (!validation.ok) {
        return errorEnvelope(
          "VALIDATION_ERROR",
          requestId,
          "The tool input did not match the required contract.",
          { issues: validation.issues },
        );
      }

      const context: ToolExecutionContext = { signal, source: "webmcp" };

      try {
        const bus = getBus();
        const rawOutcome = await spec.invoke(bus, validation.value, context);
        if (signal.aborted) {
          return abortedEnvelope(requestId);
        }

        const envelope = normalizeOutcome(rawOutcome, requestId);
        if (!envelope) {
          return internalErrorEnvelope(requestId);
        }

        if (!spec.readOnly && envelope.status === "ok" && bus.awaitVisibleCommit) {
          await bus.awaitVisibleCommit(context);
          if (signal.aborted) {
            return abortedEnvelope(requestId);
          }
        }

        return envelope;
      } catch (error) {
        if (signal.aborted || isAbortError(error)) {
          return abortedEnvelope(requestId);
        }
        if (error instanceof FactoryCommandError) {
          return expectedErrorEnvelope(error, requestId);
        }
        return internalErrorEnvelope(requestId);
      }
    },
  };
}

export function createFactoryToolDescriptors(
  getBus: () => FactoryCommandBus,
): readonly WebMcpToolDescriptor[] {
  return [
    createDescriptor(GET_FACTORY_SNAPSHOT_SPEC, getBus),
    createDescriptor(GET_SCENARIO_SNAPSHOT_SPEC, getBus),
    createDescriptor(CREATE_SCENARIO_SPEC, getBus),
    createDescriptor(APPLY_SCENARIO_CHANGES_SPEC, getBus),
    createDescriptor(RUN_FACTORY_SIMULATION_SPEC, getBus),
    createDescriptor(COMPARE_SIMULATION_RUNS_SPEC, getBus),
  ];
}
