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

type JsonCloneResult =
  | { ok: true; value: JsonValue }
  | { ok: false };

const JSON_CLONE_FAILED: JsonCloneResult = { ok: false };

function clonePlainJsonValue(
  value: unknown,
  ancestors = new Set<object>(),
  depth = 0,
): JsonCloneResult {
  if (depth > 64) {
    return JSON_CLONE_FAILED;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return { ok: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, value }
      : JSON_CLONE_FAILED;
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    return JSON_CLONE_FAILED;
  }

  try {
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (
      (array && prototype !== Array.prototype && prototype !== null) ||
      (!array && prototype !== Object.prototype && prototype !== null)
    ) {
      return JSON_CLONE_FAILED;
    }

    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) {
      return JSON_CLONE_FAILED;
    }

    ancestors.add(value);
    try {
      if (array) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        if (
          !lengthDescriptor ||
          !("value" in lengthDescriptor) ||
          typeof lengthDescriptor.value !== "number" ||
          !Number.isSafeInteger(lengthDescriptor.value) ||
          lengthDescriptor.value < 0 ||
          lengthDescriptor.enumerable ||
          lengthDescriptor.configurable ||
          keys.length !== lengthDescriptor.value + 1
        ) {
          return JSON_CLONE_FAILED;
        }

        const clone: JsonValue[] = [];
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
          const itemDescriptor = Object.getOwnPropertyDescriptor(
            value,
            String(index),
          );
          if (
            !itemDescriptor ||
            !("value" in itemDescriptor) ||
            !itemDescriptor.enumerable
          ) {
            return JSON_CLONE_FAILED;
          }

          const item = clonePlainJsonValue(
            itemDescriptor.value,
            ancestors,
            depth + 1,
          );
          if (!item.ok) {
            return JSON_CLONE_FAILED;
          }
          clone.push(item.value);
        }

        Object.setPrototypeOf(clone, null);
        Object.freeze(clone);
        return { ok: true, value: clone };
      }

      const clone = Object.create(null) as Record<string, JsonValue>;
      for (const rawKey of keys) {
        const key = rawKey as string;
        if (key === "toJSON") {
          return JSON_CLONE_FAILED;
        }

        const property = Object.getOwnPropertyDescriptor(value, key);
        if (!property || !("value" in property) || !property.enumerable) {
          return JSON_CLONE_FAILED;
        }

        const child = clonePlainJsonValue(property.value, ancestors, depth + 1);
        if (!child.ok) {
          return JSON_CLONE_FAILED;
        }
        Object.defineProperty(clone, key, {
          value: child.value,
          enumerable: true,
          configurable: false,
          writable: false,
        });
      }

      Object.freeze(clone);
      return { ok: true, value: clone };
    } finally {
      ancestors.delete(value);
    }
  } catch {
    return JSON_CLONE_FAILED;
  }
}

function isSafeMessage(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 500;
}

function normalizeOutcome(
  outcome: unknown,
  requestId: string | null,
): FactoryToolEnvelope | null {
  const clonedOutcome = clonePlainJsonValue(outcome);
  if (!clonedOutcome.ok || !isPlainRecord(clonedOutcome.value)) {
    return null;
  }

  const normalized = clonedOutcome.value;
  const keys = Object.keys(normalized).sort();
  if (keys.join("|") !== "code|data|message|status") {
    return null;
  }
  if (
    (normalized.status !== "ok" && normalized.status !== "error") ||
    typeof normalized.code !== "string" ||
    !FACTORY_TOOL_CODE_SET.has(normalized.code as FactoryToolCode) ||
    !isSafeMessage(normalized.message)
  ) {
    return null;
  }

  const code = normalized.code as FactoryToolCode;
  if (
    (normalized.status === "ok" && code !== "OK") ||
    (normalized.status === "error" && code === "OK")
  ) {
    return null;
  }

  return buildEnvelope(
    normalized.status,
    code,
    requestId,
    normalized.message,
    normalized.data as JsonValue,
  );
}

function buildEnvelope(
  status: "ok" | "error",
  code: FactoryToolCode,
  requestId: string | null,
  message: string,
  data: JsonValue,
): FactoryToolEnvelope | null {
  const clonedData = clonePlainJsonValue(data);
  if (!clonedData.ok) {
    return null;
  }

  const envelope = Object.assign(Object.create(null), {
    schema_version: FACTORY_TOOL_SCHEMA_VERSION,
    status,
    code,
    request_id: requestId,
    message,
    data: clonedData.value,
  }) as FactoryToolEnvelope;
  Object.freeze(envelope);

  try {
    return typeof JSON.stringify(envelope) === "string" ? envelope : null;
  } catch {
    return null;
  }
}

function minimalInternalErrorEnvelope(requestId: string | null): FactoryToolEnvelope {
  const envelope = Object.assign(Object.create(null), {
    schema_version: FACTORY_TOOL_SCHEMA_VERSION,
    status: "error",
    code: "INTERNAL_ERROR",
    request_id: requestId,
    message: "The operation could not be completed.",
    data: null,
  }) as FactoryToolEnvelope;
  return Object.freeze(envelope);
}

function errorEnvelope(
  code: Exclude<FactoryToolCode, "OK">,
  requestId: string | null,
  message: string,
  data: JsonValue = null,
): FactoryToolEnvelope {
  return (
    buildEnvelope("error", code, requestId, message, data) ??
    minimalInternalErrorEnvelope(requestId)
  );
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
    const runtimeCode = (error as { code?: unknown }).code;
    const clonedData = clonePlainJsonValue(error.data);
    if (
      typeof runtimeCode !== "string" ||
      runtimeCode === "OK" ||
      !FACTORY_TOOL_CODE_SET.has(runtimeCode as FactoryToolCode) ||
      !isSafeMessage(error.publicMessage) ||
      !clonedData.ok
    ) {
      return internalErrorEnvelope(requestId);
    }

    return errorEnvelope(
      runtimeCode as Exclude<FactoryToolCode, "OK">,
      requestId,
      error.publicMessage,
      clonedData.value,
    );
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

        if (!spec.readOnly && envelope.status === "ok") {
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
