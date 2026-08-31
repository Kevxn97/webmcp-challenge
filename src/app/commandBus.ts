import {
  FactoryCommandError,
  type ApplyScenarioChangesInput,
  type CommandOutcome,
  type CompareSimulationRunsInput,
  type CreateScenarioInput,
  type FactoryCommandBus,
  type FactoryToolCode,
  type GetFactorySnapshotInput,
  type GetScenarioSnapshotInput,
  type JsonValue,
  type RunFactorySimulationInput,
  type ToolExecutionContext,
} from "../webmcp";
import {
  SandboxCommandError,
  type SandboxCommandCode,
  type SandboxStore,
} from "./store";

const PUBLIC_CODES = new Set<FactoryToolCode>([
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
]);

function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

function ok(data: unknown, message: string): CommandOutcome<JsonValue> {
  return { status: "ok", code: "OK", message, data: asJson(data) };
}

function mapCode(code: SandboxCommandCode): Exclude<FactoryToolCode, "OK"> {
  return PUBLIC_CODES.has(code) ? code : "INTERNAL_ERROR";
}

function rethrowPublic(error: unknown): never {
  if (error instanceof FactoryCommandError) throw error;
  if (error instanceof SandboxCommandError) {
    throw new FactoryCommandError(mapCode(error.code), error.message, asJson(error.details));
  }
  throw error;
}

function ensureActive(context: ToolExecutionContext) {
  if (context.signal.aborted) {
    throw new FactoryCommandError("ABORTED", "The operation was cancelled before it could start.");
  }
}

export class SandboxFactoryCommandBus implements FactoryCommandBus {
  constructor(private readonly store: SandboxStore) {}

  getFactorySnapshot(_input: GetFactorySnapshotInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      return ok(this.store.getFactorySnapshot(), "Current factory snapshot returned.");
    } catch (error) {
      return rethrowPublic(error);
    }
  }

  getScenarioSnapshot(input: GetScenarioSnapshotInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      return ok(this.store.getScenarioSnapshot(input.scenario_id), "Scenario snapshot returned.");
    } catch (error) {
      return rethrowPublic(error);
    }
  }

  createScenario(input: CreateScenarioInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      return ok(this.store.createScenario(input), "Scenario created from the immutable factory version.");
    } catch (error) {
      return rethrowPublic(error);
    }
  }

  applyScenarioChanges(input: ApplyScenarioChangesInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      return ok(this.store.applyScenarioChanges(input), "Scenario settings committed atomically.");
    } catch (error) {
      return rethrowPublic(error);
    }
  }

  async runFactorySimulation(input: RunFactorySimulationInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      const result = await this.store.simulateScenarioVersion(input, context.signal);
      return ok(result, "Deterministic simulation receipt stored.");
    } catch (error) {
      return rethrowPublic(error);
    }
  }

  compareSimulationRuns(input: CompareSimulationRunsInput, context: ToolExecutionContext) {
    ensureActive(context);
    try {
      return ok(this.store.compareRunSet(input.run_ids), "Stored simulation receipts compared.");
    } catch (error) {
      return rethrowPublic(error);
    }
  }

  async awaitVisibleCommit(context: ToolExecutionContext) {
    ensureActive(context);
    await this.store.awaitVisibleCommit();
    ensureActive(context);
  }
}
