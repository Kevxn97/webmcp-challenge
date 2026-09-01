import {
  createBaselineInput,
  createInvalidCostScenarioInput,
  createValidScenarioInput,
  simulateFactory,
  type FactoryControls,
  type FactoryOperation,
  type FactorySimulationInput,
  type SimulationReceipt,
} from "../domain";
import {
  BASELINE_SCENARIO_VALUES,
  CONTROL_DEFINITIONS,
  PACKAGING_CONTROL_FIELDS,
  PACKAGING_LOCK_EFFECTIVE_MINUTES,
  PACKAGING_LOCK_EFFECTIVE_TICK,
  POST_LOCK_AVAILABLE_CONTROL_FIELDS,
  PRE_SHIFT_CONTROL_FIELDS,
  SCENARIO_CONTROL_FIELDS,
  controlValueFromEngineControls,
  type ScenarioControlField,
  type ScenarioControlPatch,
  type ScenarioControlValueMap,
} from "../shared/controlDefinitions";

export type ScenarioPatch = ScenarioControlPatch;

export type LedgerKind = "human" | "tool" | "agent" | "simulation" | "state" | "system";
export type LedgerTone = "neutral" | "primary" | "success" | "danger" | "warning";

export interface SandboxLedgerEvent {
  id: string;
  kind: LedgerKind;
  label: string;
  detail: string;
  timestamp: string;
  revision: number;
  tone?: LedgerTone;
}

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

export interface ScenarioRunEvidence {
  runId: string;
  scenarioId: string;
  scenarioMarker: "A" | "B";
  scenarioName: string;
  scenarioRevision: number;
  scenarioVersionId: string;
  baseFactoryVersionId: string;
  sourceFactoryRevision: number;
  sourceLockRevision: number;
  patch: ScenarioPatch;
  receipt: SimulationReceipt;
}

export interface SandboxState {
  hydrated: boolean;
  busy: boolean;
  webMcpReady: boolean;
  eventRevision: number;
  factoryRevision: number;
  factoryVersionId: string;
  lockRevision: number;
  packagingLocked: boolean;
  selectedScenarioId: string;
  baselineReceipt: SimulationReceipt | null;
  scenarios: ScenarioRecord[];
  runs: Record<string, SimulationReceipt>;
  runEvidence: Record<string, ScenarioRunEvidence>;
  ledger: SandboxLedgerEvent[];
}

export type SandboxCommandCode =
  | "STALE_FACTORY"
  | "STALE_SCENARIO"
  | "LOCK_CHANGED"
  | "HUMAN_LOCKED"
  | "PHASE_CLOSED"
  | "WORKSPACE_FULL"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "IDEMPOTENCY_KEY_REUSED"
  | "ABORTED"
  | "INTERNAL_ERROR";

export class SandboxCommandError extends Error {
  constructor(
    readonly code: SandboxCommandCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "SandboxCommandError";
  }
}

type Subscriber = () => void;

type RequestOperation = "create_scenario" | "apply_scenario_changes" | "run_factory_simulation";

type StoredRequest = {
  operation: RequestOperation;
  fingerprint: string;
} & (
  | { status: "complete"; result: unknown }
  | { status: "pending"; promise: Promise<unknown> }
);

const VALID_PATCH: ScenarioPatch = Object.freeze({
  mixer_speed_bps: 9_500,
  packaging_speed_bps: 9_000,
  packaging_changeover_minutes: 15,
  packaging_calibration: "enhanced",
});

const INVALID_COST_PATCH: ScenarioPatch = Object.freeze({
  ...VALID_PATCH,
  supplier_mode: "expedite",
});

function scenarioSlot(
  marker: "A" | "B",
  factoryVersionId: string,
  factoryRevision = 1,
  lockRevision = 0,
): ScenarioRecord {
  const id = `scenario-${marker.toLowerCase()}`;
  return {
    id,
    marker,
    name: `Scenario ${marker}`,
    revision: 0,
    headVersionId: `${id}-empty`,
    baseFactoryVersionId: factoryVersionId,
    sourceFactoryRevision: factoryRevision,
    sourceLockRevision: lockRevision,
    patch: {},
    placeholder: true,
    receipt: null,
    receiptScenarioRevision: null,
    receiptLockRevision: null,
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}

function freezeState(state: SandboxState): SandboxState {
  const scenarios = state.scenarios.map((scenario) => Object.freeze({
    ...scenario,
    patch: deepFreeze({ ...scenario.patch }),
    receipt: scenario.receipt ? deepFreeze(scenario.receipt) : null,
  }));
  const runs = Object.fromEntries(
    Object.entries(state.runs).map(([runId, receipt]) => [
      runId,
      deepFreeze(receipt),
    ]),
  );
  const runEvidence = Object.fromEntries(
    Object.entries(state.runEvidence).map(([runId, evidence]) => [
      runId,
      deepFreeze({
        ...evidence,
        patch: { ...evidence.patch },
        receipt: evidence.receipt,
      }),
    ]),
  );
  return Object.freeze({
    ...state,
    baselineReceipt: state.baselineReceipt
      ? deepFreeze(state.baselineReceipt)
      : null,
    scenarios: Object.freeze(scenarios) as unknown as ScenarioRecord[],
    ledger: Object.freeze(
      state.ledger.map((event) => Object.freeze({ ...event })),
    ) as unknown as SandboxLedgerEvent[],
    runs: Object.freeze(runs),
    runEvidence: Object.freeze(runEvidence),
  });
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new SandboxCommandError("ABORTED", "The operation was cancelled before it could commit.");
  }
}

function canonicalFingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalFingerprint).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalFingerprint(nested)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function effectiveScenarioValue<Field extends ScenarioControlField>(
  scenario: ScenarioRecord,
  field: Field,
): ScenarioControlValueMap[Field] {
  const patchValue = scenario.patch[field];
  return (patchValue === undefined
    ? BASELINE_SCENARIO_VALUES[field]
    : patchValue) as ScenarioControlValueMap[Field];
}

function normalizeScenarioChanges(
  scenario: ScenarioRecord,
  requested: ScenarioPatch,
): {
  changed: ScenarioPatch;
  nextPatch: ScenarioPatch;
  noOps: ScenarioControlField[];
} {
  const changed: Record<string, unknown> = {};
  const nextPatch = { ...scenario.patch } as Record<string, unknown>;
  const noOps: ScenarioControlField[] = [];

  for (const field of SCENARIO_CONTROL_FIELDS) {
    const nextValue = requested[field];
    if (nextValue === undefined) continue;
    if (Object.is(nextValue, effectiveScenarioValue(scenario, field))) {
      noOps.push(field);
      continue;
    }

    changed[field] = nextValue;
    if (Object.is(nextValue, BASELINE_SCENARIO_VALUES[field])) {
      delete nextPatch[field];
    } else {
      nextPatch[field] = nextValue;
    }
  }

  return {
    changed: changed as ScenarioPatch,
    nextPatch: nextPatch as ScenarioPatch,
    noOps,
  };
}

function cleanPatchForAuthority(
  patch: ScenarioPatch,
  packagingLocked: boolean,
): ScenarioPatch {
  if (!packagingLocked) return { ...patch };
  const clean: Record<string, unknown> = {};
  for (const field of POST_LOCK_AVAILABLE_CONTROL_FIELDS) {
    const value = patch[field];
    if (value !== undefined) clean[field] = value;
  }
  return clean as ScenarioPatch;
}

function publicControlValue<Field extends ScenarioControlField>(
  controls: FactoryControls,
  field: Field,
): ScenarioControlValueMap[Field] {
  return controlValueFromEngineControls(controls, field);
}

function controlCatalog(controls: FactoryControls, packagingLocked: boolean) {
  return SCENARIO_CONTROL_FIELDS.map((field) => {
    const definition = CONTROL_DEFINITIONS[field];
    const humanLocked = packagingLocked && definition.blockedByPackagingLock;
    const phaseClosed = packagingLocked
      && definition.applicationPhase === "pre_shift"
      && !humanLocked;
    const domain = definition.domain.type === "range"
      ? {
        minimum: definition.domain.minimum,
        maximum: definition.domain.maximum,
      }
      : { enum: [...definition.domain.values] };

    return {
      control_id: field,
      label: definition.label,
      resource: definition.resource,
      current_value: publicControlValue(controls, field),
      unit: definition.unit,
      domain,
      application_phase: definition.applicationPhase,
      availability: {
        status: humanLocked
          ? "HUMAN_LOCKED"
          : phaseClosed
            ? "PHASE_CLOSED"
            : "AVAILABLE",
        reason_code: humanLocked
          ? "HUMAN_AUTHORITY"
          : phaseClosed
            ? "PRE_SHIFT_ONLY"
            : null,
        effective_tick: packagingLocked ? PACKAGING_LOCK_EFFECTIVE_TICK : null,
      },
    };
  });
}

function packagingLockProjection(state: Pick<SandboxState, "packagingLocked" | "lockRevision">) {
  if (!state.packagingLocked) return [];
  return [{
    lock_id: `lock-packaging-l${state.lockRevision}`,
    authority: "human",
    resource: "Packaging",
    scope: "all controls",
    blocked_fields: [...PACKAGING_CONTROL_FIELDS],
    effective_tick: PACKAGING_LOCK_EFFECTIVE_TICK,
    effective_elapsed_minutes: PACKAGING_LOCK_EFFECTIVE_MINUTES,
  }];
}

function scenarioAuthorityIsCurrent(scenario: ScenarioRecord, state: SandboxState): boolean {
  return scenario.sourceFactoryRevision === state.factoryRevision
    && scenario.baseFactoryVersionId === state.factoryVersionId
    && scenario.sourceLockRevision === state.lockRevision;
}

type ScenarioCurrentnessStatus =
  | "CURRENT"
  | "CURRENT_UNEVALUATED"
  | "HISTORICAL";

function scenarioCurrentness(scenario: ScenarioRecord, state: SandboxState) {
  const authorityCurrent = scenarioAuthorityIsCurrent(scenario, state);
  const receiptCurrent = authorityCurrent
    && scenario.receipt !== null
    && scenario.receiptScenarioRevision === scenario.revision
    && scenario.receiptLockRevision === state.lockRevision;
  const status: ScenarioCurrentnessStatus = !authorityCurrent
    ? "HISTORICAL"
    : receiptCurrent
      ? "CURRENT"
      : "CURRENT_UNEVALUATED";
  return {
    status,
    authorityCurrent,
    receiptCurrent,
    invalidatedBy: authorityCurrent ? [] : ["AUTHORITY_EPOCH_CHANGED"],
  };
}

function evidenceForScenario(
  scenario: ScenarioRecord,
  receipt: SimulationReceipt,
): ScenarioRunEvidence {
  return {
    runId: receipt.runId,
    scenarioId: scenario.id,
    scenarioMarker: scenario.marker,
    scenarioName: scenario.name,
    scenarioRevision: scenario.revision,
    scenarioVersionId: scenario.headVersionId,
    baseFactoryVersionId: scenario.baseFactoryVersionId,
    sourceFactoryRevision: scenario.sourceFactoryRevision,
    sourceLockRevision: scenario.sourceLockRevision,
    patch: { ...scenario.patch },
    receipt,
  };
}

export function runEvidenceIsCurrent(
  evidence: ScenarioRunEvidence,
  state: SandboxState,
): boolean {
  const current = state.scenarios.find(
    (scenario) => scenario.id === evidence.scenarioId,
  );
  return Boolean(
    current
    && !current.placeholder
    && current.headVersionId === evidence.scenarioVersionId
    && current.revision === evidence.scenarioRevision
    && current.receipt?.runId === evidence.runId
    && scenarioAuthorityIsCurrent(current, state)
    && current.receiptScenarioRevision === current.revision
    && current.receiptLockRevision === state.lockRevision,
  );
}

type ScenarioAllocation =
  | {
      status: "ALLOCATE_EMPTY_SLOT" | "REPLACE_HISTORICAL_HEAD";
      slot: ScenarioRecord;
    }
  | { status: "WORKSPACE_FULL"; slot: null };

function nextScenarioAllocation(state: SandboxState): ScenarioAllocation {
  const ordered = [...state.scenarios].sort((left, right) =>
    left.marker.localeCompare(right.marker),
  );
  const empty = ordered.find((scenario) => scenario.placeholder);
  if (empty) return { status: "ALLOCATE_EMPTY_SLOT", slot: empty };
  const historical = ordered.find(
    (scenario) => !scenarioAuthorityIsCurrent(scenario, state),
  );
  if (historical) {
    return { status: "REPLACE_HISTORICAL_HEAD", slot: historical };
  }
  return { status: "WORKSPACE_FULL", slot: null };
}

function scenarioWorkspaceProjection(state: SandboxState) {
  const allocation = nextScenarioAllocation(state);
  return {
    capacity: state.scenarios.length,
    occupied: state.scenarios.filter((scenario) => !scenario.placeholder).length,
    allocation_policy: [
      "FIRST_EMPTY_SLOT_BY_MARKER",
      "FIRST_HISTORICAL_HEAD_BY_MARKER",
      "FAIL_WHEN_ALL_HEADS_ARE_CURRENT",
    ],
    next_allocation: allocation.slot
      ? {
          status: allocation.status,
          marker: allocation.slot.marker,
          scenario_id: allocation.slot.id,
          displaced_run_id: allocation.slot.receipt?.runId ?? null,
        }
      : {
          status: allocation.status,
          marker: null,
          scenario_id: null,
          displaced_run_id: null,
        },
  };
}

function continuationForScenario(state: SandboxState, scenario: ScenarioRecord) {
  return {
    factory_version_id: state.factoryVersionId,
    expected_factory_revision: state.factoryRevision,
    expected_lock_revision: state.lockRevision,
    scenario_id: scenario.id,
    expected_scenario_revision: scenario.revision,
  };
}

function patchToOperations(
  patch: ScenarioPatch,
  prefix: string,
  tick = 0,
): FactoryOperation[] {
  const operations: FactoryOperation[] = [];
  for (const field of SCENARIO_CONTROL_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    const definition = CONTROL_DEFINITIONS[field];
    operations.push({
      operationId: `${prefix}-${definition.operation.idSuffix}`,
      tick,
      actor: "model",
      kind: definition.operation.kind,
      [definition.operation.valueKey]: value,
    } as unknown as FactoryOperation);
  }
  return operations;
}

function inputForScenario(
  scenario: ScenarioRecord,
  authority: { packagingLocked: boolean; lockRevision: number },
): FactorySimulationInput {
  const input = createBaselineInput();
  const prefix = `${scenario.id}-r${scenario.revision}`;
  if (!authority.packagingLocked) {
    return { ...input, operations: patchToOperations(scenario.patch, prefix) };
  }

  return {
    ...input,
    operations: [
      {
        operationId: `human-packaging-lock-l${authority.lockRevision}`,
        tick: PACKAGING_LOCK_EFFECTIVE_TICK,
        actor: "human",
        kind: "LOCK_RESOURCE",
        resource: "Packaging",
      },
      ...patchToOperations(
        scenario.patch,
        prefix,
        PACKAGING_LOCK_EFFECTIVE_TICK,
      ),
    ],
  };
}

function fixedTime(sequence: number): string {
  const seconds = 5 + sequence * 7;
  const minute = 20 + Math.floor(seconds / 60);
  return `14:${String(minute).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export class SandboxStore {
  private subscribers = new Set<Subscriber>();
  private hydratePromise: Promise<void> | null = null;
  private requests = new Map<string, StoredRequest>();
  private state: SandboxState = freezeState({
    hydrated: false,
    busy: true,
    webMcpReady: false,
    eventRevision: 0,
    factoryRevision: 1,
    factoryVersionId: "factory-v1",
    lockRevision: 0,
    packagingLocked: false,
    selectedScenarioId: "scenario-b",
    baselineReceipt: null,
    scenarios: [scenarioSlot("A", "factory-v1"), scenarioSlot("B", "factory-v1")],
    runs: {},
    runEvidence: {},
    ledger: [],
  });

  getSnapshot = () => this.state;

  subscribe = (subscriber: Subscriber) => {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  };

  private publish(next: SandboxState) {
    this.state = freezeState(next);
    this.subscribers.forEach((subscriber) => subscriber());
  }

  private event(
    state: SandboxState,
    event: Omit<SandboxLedgerEvent, "id" | "timestamp" | "revision">,
  ): SandboxLedgerEvent {
    const revision = state.eventRevision + 1;
    return {
      ...event,
      id: `event-${revision}`,
      timestamp: fixedTime(revision),
      revision,
    };
  }

  private appendEvent(
    state: SandboxState,
    event: Omit<SandboxLedgerEvent, "id" | "timestamp" | "revision">,
  ): SandboxState {
    const nextEvent = this.event(state, event);
    return {
      ...state,
      eventRevision: nextEvent.revision,
      ledger: [nextEvent, ...state.ledger].slice(0, 18),
    };
  }

  private rejectWrite(
    code: SandboxCommandCode,
    message: string,
    details: Record<string, unknown>,
    auditDetail: string,
  ): never {
    const next = this.appendEvent(this.state, {
      kind: "system",
      label: code.startsWith("STALE") || code === "LOCK_CHANGED"
        ? "Stale write rejected"
        : "Write rejected",
      detail: `NO COMMIT · ${auditDetail}`,
      tone: "warning",
    });
    this.publish(next);
    throw new SandboxCommandError(code, message, {
      ...details,
      committed: false,
      audit_recorded: true,
    });
  }

  async hydrateShowcase() {
    if (this.hydratePromise) return this.hydratePromise;
    this.hydratePromise = (async () => {
      const [baselineReceipt, invalidReceipt, validReceipt] = await Promise.all([
        simulateFactory(createBaselineInput()),
        simulateFactory(createInvalidCostScenarioInput()),
        simulateFactory(createValidScenarioInput()),
      ]);

      const historicalFactoryVersionId = "factory-v1";
      const currentFactoryRevision = 2;
      const currentFactoryVersionId = "factory-v2";
      const currentLockRevision = 1;
      const scenarioA: ScenarioRecord = {
        ...scenarioSlot("A", historicalFactoryVersionId, 1, 0),
        name: "Scenario A · expedite",
        revision: 1,
        headVersionId: "scenario-a-v1",
        patch: { ...INVALID_COST_PATCH },
        placeholder: false,
        receipt: invalidReceipt,
        receiptScenarioRevision: 1,
        receiptLockRevision: 0,
      };
      const historicalScenarioB: ScenarioRecord = {
        ...scenarioSlot("B", historicalFactoryVersionId, 1, 0),
        name: "Scenario B · standard",
        revision: 1,
        headVersionId: "scenario-b-v1",
        patch: { ...VALID_PATCH },
        placeholder: false,
        receipt: validReceipt,
        receiptScenarioRevision: 1,
        receiptLockRevision: 0,
      };
      const recoveryHead: ScenarioRecord = {
        ...scenarioSlot(
          "B",
          currentFactoryVersionId,
          currentFactoryRevision,
          currentLockRevision,
        ),
        name: "Scenario B · post-lock recovery",
        revision: 2,
        headVersionId: "scenario-b-v2",
        patch: { mixer_speed_bps: 9_500 },
        placeholder: false,
        receipt: null,
        receiptScenarioRevision: null,
        receiptLockRevision: null,
      };
      const lockedReceipt = await simulateFactory(inputForScenario(recoveryHead, {
        packagingLocked: true,
        lockRevision: currentLockRevision,
      }));
      const scenarioB: ScenarioRecord = {
        ...recoveryHead,
        receipt: lockedReceipt,
        receiptScenarioRevision: recoveryHead.revision,
        receiptLockRevision: currentLockRevision,
      };

      let next: SandboxState = {
        ...this.state,
        hydrated: true,
        busy: false,
        baselineReceipt,
        factoryRevision: currentFactoryRevision,
        factoryVersionId: currentFactoryVersionId,
        lockRevision: currentLockRevision,
        packagingLocked: true,
        selectedScenarioId: scenarioB.id,
        scenarios: [scenarioA, scenarioB],
        runs: {
          [baselineReceipt.runId]: baselineReceipt,
          [invalidReceipt.runId]: invalidReceipt,
          [validReceipt.runId]: validReceipt,
          [lockedReceipt.runId]: lockedReceipt,
        },
        runEvidence: {
          [invalidReceipt.runId]: evidenceForScenario(
            scenarioA,
            invalidReceipt,
          ),
          [validReceipt.runId]: evidenceForScenario(
            historicalScenarioB,
            validReceipt,
          ),
          [lockedReceipt.runId]: evidenceForScenario(
            scenarioB,
            lockedReceipt,
          ),
        },
      };
      const seededEvents: Array<Omit<SandboxLedgerEvent, "id" | "timestamp" | "revision">> = [
        { kind: "tool", label: "Factory snapshot read", detail: "get_factory_snapshot · factory-v1", tone: "neutral" },
        { kind: "agent", label: "Generated Scenario A", detail: "Expedite supplier + constrained line changes", tone: "primary" },
        { kind: "simulation", label: "Scenario A failed", detail: `Receipt ${invalidReceipt.runId.slice(0, 16)} · cost cap violated`, tone: "danger" },
        { kind: "agent", label: "Generated Scenario B", detail: "Replanned without supplier premium", tone: "primary" },
        { kind: "simulation", label: "Scenario B feasible", detail: `Receipt ${validReceipt.runId.slice(0, 16)} · all constraints pass`, tone: "success" },
        { kind: "human", label: "Locked Packaging", detail: `Human authority changed · modeled effect tick ${PACKAGING_LOCK_EFFECTIVE_TICK} / T+${PACKAGING_LOCK_EFFECTIVE_MINUTES} min`, tone: "warning" },
        { kind: "system", label: "Stale write rejected", detail: "NO COMMIT · earlier factory and lock revisions lost authority", tone: "warning" },
        { kind: "agent", label: "Created post-lock recovery", detail: `${scenarioB.headVersionId} · clean authority branch with Packaging unchanged`, tone: "primary" },
        { kind: "simulation", label: "Current proof stored", detail: `Receipt ${lockedReceipt.runId.slice(0, 16)} · ${lockedReceipt.upperBoundProof?.exactInequality ?? "upper bound stored"}`, tone: "danger" },
      ];
      for (const event of seededEvents) next = this.appendEvent(next, event);
      this.publish(next);
    })().catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown initialization error";
      let next = { ...this.state, hydrated: true, busy: false };
      next = this.appendEvent(next, { kind: "system", label: "Simulation unavailable", detail: message, tone: "danger" });
      this.publish(next);
      throw error;
    });
    return this.hydratePromise;
  }

  setWebMcpReady(ready: boolean) {
    if (this.state.webMcpReady === ready) return;
    this.publish({ ...this.state, webMcpReady: ready });
  }

  selectScenario(scenarioId: string) {
    if (!this.state.scenarios.some((scenario) => scenario.id === scenarioId)) return;
    this.publish({ ...this.state, selectedScenarioId: scenarioId });
  }

  async togglePackagingLock() {
    const locked = !this.state.packagingLocked;
    let next: SandboxState = {
      ...this.state,
      packagingLocked: locked,
      lockRevision: this.state.lockRevision + 1,
      factoryRevision: this.state.factoryRevision + 1,
      factoryVersionId: `factory-v${this.state.factoryRevision + 1}`,
    };
    next = this.appendEvent(next, {
      kind: "human",
      label: `${locked ? "Locked" : "Unlocked"} Packaging`,
      detail: locked
        ? `Human authority changed · Packaging blocked · modeled effect tick ${PACKAGING_LOCK_EFFECTIVE_TICK} / T+${PACKAGING_LOCK_EFFECTIVE_MINUTES} min`
        : "Packaging is available for future scenario revisions",
      tone: locked ? "warning" : "success",
    });
    this.publish(next);
    await this.awaitVisibleCommit();
  }

  async runSelected(signal?: AbortSignal) {
    const selected = this.state.scenarios.find((scenario) => scenario.id === this.state.selectedScenarioId);
    if (!selected || selected.placeholder) return;
    try {
      await this.runScenario(selected.id, signal, "human");
    } catch (error) {
      if (!(error instanceof SandboxCommandError) || !["STALE_FACTORY", "STALE_SCENARIO", "LOCK_CHANGED", "NOT_FOUND"].includes(error.code)) {
        throw error;
      }
      let next = this.appendEvent(this.state, {
        kind: "system",
        label: "Simulation discarded",
        detail: `${error.code} · the live state changed before the receipt could commit`,
        tone: "warning",
      });
      next = { ...next, busy: false };
      this.publish(next);
      await this.awaitVisibleCommit();
    }
  }

  async runScenario(scenarioId: string, signal?: AbortSignal, actor: "human" | "tool" = "tool") {
    assertNotAborted(signal);
    const scenario = this.state.scenarios.find((item) => item.id === scenarioId);
    if (!scenario || scenario.placeholder) {
      throw new SandboxCommandError("NOT_FOUND", "Scenario not found.", { scenario_id: scenarioId });
    }
    const source = {
      factoryRevision: this.state.factoryRevision,
      factoryVersionId: this.state.factoryVersionId,
      lockRevision: this.state.lockRevision,
      packagingLocked: this.state.packagingLocked,
      scenarioRevision: scenario.revision,
      scenarioVersionId: scenario.headVersionId,
    };
    this.publish({ ...this.state, busy: true });
    try {
      const receipt = await simulateFactory(inputForScenario(scenario, {
        packagingLocked: source.packagingLocked,
        lockRevision: source.lockRevision,
      }));
      assertNotAborted(signal);
      const current = this.state.scenarios.find((item) => item.id === scenarioId);
      if (this.state.lockRevision !== source.lockRevision || this.state.packagingLocked !== source.packagingLocked) {
        throw new SandboxCommandError("LOCK_CHANGED", "The human lock state changed while the simulation was running. The receipt was discarded.", {
          expected_lock_revision: source.lockRevision,
          current_lock_revision: this.state.lockRevision,
        });
      }
      if (this.state.factoryRevision !== source.factoryRevision || this.state.factoryVersionId !== source.factoryVersionId) {
        throw new SandboxCommandError("STALE_FACTORY", "The factory changed while the simulation was running. The receipt was discarded.", {
          expected_factory_revision: source.factoryRevision,
          current_factory_revision: this.state.factoryRevision,
          current_factory_version_id: this.state.factoryVersionId,
        });
      }
      if (!current || current.revision !== source.scenarioRevision || current.headVersionId !== source.scenarioVersionId) {
        throw new SandboxCommandError("STALE_SCENARIO", "The scenario changed while the simulation was running. The receipt was discarded.", {
          expected_scenario_revision: source.scenarioRevision,
          current_scenario_revision: current?.revision ?? null,
          current_head_version_id: current?.headVersionId ?? null,
        });
      }
      const updated: ScenarioRecord = {
        ...current,
        receipt,
        receiptScenarioRevision: source.scenarioRevision,
        receiptLockRevision: source.lockRevision,
      };
      let next: SandboxState = {
        ...this.state,
        busy: false,
        scenarios: this.state.scenarios.map((item) =>
          item.id === scenarioId ? updated : item
        ),
        runs: { ...this.state.runs, [receipt.runId]: receipt },
        runEvidence: {
          ...this.state.runEvidence,
          [receipt.runId]: evidenceForScenario(updated, receipt),
        },
      };
      next = this.appendEvent(next, {
        kind: actor === "human" ? "human" : "simulation",
        label: receipt.feasibilityStatus === "FEASIBLE" ? `${current.name} feasible` : `${current.name} not feasible`,
        detail: `Receipt ${receipt.runId.slice(0, 16)} · ${receipt.feasibilityStatus.replaceAll("_", " ").toLowerCase()}`,
        tone: receipt.feasibilityStatus === "FEASIBLE" ? "success" : receipt.feasibilityStatus === "PROVEN_INFEASIBLE_UNDER_LOCKS" ? "warning" : "danger",
      });
      this.publish(next);
      await this.awaitVisibleCommit();
      return receipt;
    } catch (error) {
      this.publish({ ...this.state, busy: false });
      throw error;
    }
  }

  branchSelected() {
    const selected = this.state.scenarios.find((scenario) => scenario.id === this.state.selectedScenarioId);
    if (!selected || selected.placeholder) return;
    const nextRevision = selected.revision + 1;
    const authorityChanged = !scenarioAuthorityIsCurrent(selected, this.state);
    const branched: ScenarioRecord = {
      ...selected,
      name: `${selected.marker === "B" ? "Scenario B" : "Scenario A"} · branch ${nextRevision}`,
      revision: nextRevision,
      headVersionId: `${selected.id}-v${nextRevision}`,
      baseFactoryVersionId: this.state.factoryVersionId,
      sourceFactoryRevision: this.state.factoryRevision,
      sourceLockRevision: this.state.lockRevision,
      patch: authorityChanged
        ? cleanPatchForAuthority(selected.patch, this.state.packagingLocked)
        : { ...selected.patch },
      receipt: null,
      receiptScenarioRevision: null,
      receiptLockRevision: null,
    };
    let next: SandboxState = {
      ...this.state,
      scenarios: this.state.scenarios.map((scenario) => scenario.id === selected.id ? branched : scenario),
    };
    next = this.appendEvent(next, {
      kind: "human",
      label: `Branched ${selected.name}`,
      detail: authorityChanged
        ? `Fresh authority branch ${branched.headVersionId} · historical Packaging and pre-shift overrides removed`
        : `Created immutable ${branched.headVersionId}`,
      tone: "primary",
    });
    this.publish(next);
  }

  reset() {
    this.requests.clear();
    const factoryRevision = this.state.factoryRevision + 1;
    const lockRevision = this.state.lockRevision + 1;
    let next: SandboxState = {
      ...this.state,
      busy: false,
      factoryRevision,
      factoryVersionId: `factory-v${factoryRevision}`,
      lockRevision,
      packagingLocked: false,
      selectedScenarioId: "scenario-a",
      scenarios: [
        scenarioSlot("A", `factory-v${factoryRevision}`, factoryRevision, lockRevision),
        scenarioSlot("B", `factory-v${factoryRevision}`, factoryRevision, lockRevision),
      ],
      runs: this.state.baselineReceipt
        ? { [this.state.baselineReceipt.runId]: this.state.baselineReceipt }
        : {},
      runEvidence: {},
      ledger: [],
    };
    next = this.appendEvent(next, {
      kind: "state",
      label: "Demo reset",
      detail: "Baseline preserved · scenario workspace cleared",
      tone: "neutral",
    });
    this.publish(next);
  }

  private idempotent<T>(operation: RequestOperation, requestId: string, payload: unknown, execute: () => T): T {
    const fingerprint = canonicalFingerprint(payload);
    const previous = this.requests.get(requestId);
    if (previous) {
      if (previous.operation !== operation || previous.fingerprint !== fingerprint) {
        throw new SandboxCommandError("IDEMPOTENCY_KEY_REUSED", "request_id was already used with different arguments.");
      }
      if (previous.status === "pending") {
        throw new SandboxCommandError("IDEMPOTENCY_KEY_REUSED", "request_id is already reserved by an in-flight asynchronous operation.");
      }
      return previous.result as T;
    }
    const result = execute();
    this.requests.set(requestId, { operation, fingerprint, status: "complete", result });
    return result;
  }

  getFactorySnapshot() {
    const baseline = this.state.baselineReceipt;
    const controls = baseline?.ticks[0]?.controls;
    const capacity = (stage: "mixer" | "packaging" | "qualityGate" | "warehouse") => baseline?.ticks.reduce(
      (total, tick) => total + tick[stage].capacity,
      0,
    ) ?? 0;
    const utilizationBasisPoints = (processed: number, available: number) => available > 0
      ? Math.floor((processed * 10_000) / available)
      : 0;
    const bottleneck = (resource: "Supplier" | "Mixer" | "Packaging" | "Quality Gate" | "Warehouse") => baseline?.bottlenecks.find(
      (item) => item.stage === resource,
    );
    const station = (
      id: string,
      resource: "Supplier" | "Mixer" | "Packaging" | "Quality Gate" | "Warehouse",
      processedPerShift: number,
      capacityPerShift: number,
      flowUnit: "grams" | "units",
      endingUpstreamQueue: number,
      queueUnit: "grams" | "units",
    ) => {
      const evidence = bottleneck(resource);
      return {
        id,
        resource,
        locked: resource === "Packaging" && this.state.packagingLocked,
        processed_per_shift: processedPerShift,
        capacity_per_shift: capacityPerShift,
        flow_unit: flowUnit,
        utilization_basis_points: utilizationBasisPoints(processedPerShift, capacityPerShift),
        ending_upstream_queue: endingUpstreamQueue,
        queue_unit: queueUnit,
        bottleneck: evidence ? {
          reason: evidence.reason,
          capacity_limited_ticks: evidence.capacityLimitedTicks,
          blocked_ticks: evidence.blockedTicks,
          ending_upstream_queue: evidence.endingUpstreamQueue,
          queue_unit: evidence.queueUnit,
        } : null,
      };
    };
    const locks = packagingLockProjection(this.state);
    const scenarioHeads = this.state.scenarios
      .filter((scenario) => !scenario.placeholder)
      .map((scenario) => {
        const currentness = scenarioCurrentness(scenario, this.state);
        return {
          scenario_id: scenario.id,
          name: scenario.name,
          revision: scenario.revision,
          head_version_id: scenario.headVersionId,
          source_factory_revision: scenario.sourceFactoryRevision,
          source_lock_revision: scenario.sourceLockRevision,
          authority_is_current: currentness.authorityCurrent,
          latest_run_id: scenario.receipt?.runId ?? null,
          source_is_current: currentness.receiptCurrent,
          currentness: {
            status: currentness.status,
            invalidated_by: currentness.invalidatedBy,
          },
        };
      });

    return {
      factory_revision: this.state.factoryRevision,
      factory_version_id: this.state.factoryVersionId,
      lock_revision: this.state.lockRevision,
      continuation: {
        factory_version_id: this.state.factoryVersionId,
        expected_factory_revision: this.state.factoryRevision,
        expected_lock_revision: this.state.lockRevision,
      },
      authority: {
        owner: "human",
        packaging_locked: this.state.packagingLocked,
        lock_revision: this.state.lockRevision,
        blocked_fields: this.state.packagingLocked ? [...PACKAGING_CONTROL_FIELDS] : [],
        simulation_effect: this.state.packagingLocked ? {
          effective_tick: PACKAGING_LOCK_EFFECTIVE_TICK,
          effective_elapsed_minutes: PACKAGING_LOCK_EFFECTIVE_MINUTES,
        } : null,
      },
      locks,
      scenario_workspace: scenarioWorkspaceProjection(this.state),
      mission: {
        objective: "maximize_good_output_subject_to_hard_constraints",
        output_gain_min_basis_points: 2_000,
        cost_increase_max_basis_points: 800,
        defect_rate_may_increase: false,
        new_machine_limit: 0,
        derived_minimum_good_output_units: baseline?.baselineComparison.targetGoodOutputUnits ?? 10_937,
        selection_policy: [
          "CURRENT_AND_VALID",
          "ALL_HARD_CONSTRAINTS_PASS",
          "MAX_GOOD_OUTPUT",
          "MIN_TOTAL_COST",
          "MIN_DEFECT_RATE",
          "MIN_CHANGED_CONTROLS",
          "CANONICAL_RUN_ID",
        ],
      },
      baseline_run_id: this.state.baselineReceipt?.runId ?? null,
      baseline_metrics: baseline ? {
        good_output_units: baseline.rawCounters.goodOutputUnits,
        gross_units: baseline.rawCounters.grossUnits,
        bad_units: baseline.rawCounters.badUnits,
        total_cost_micro_eur: baseline.totalCostMicroEur,
        defect_rate_fraction: `${baseline.rawCounters.badUnits}/${baseline.rawCounters.grossUnits}`,
      } : null,
      current_controls: controls
        ? Object.fromEntries(
            SCENARIO_CONTROL_FIELDS.map((field) => [
              field,
              publicControlValue(controls, field),
            ]),
          )
        : null,
      control_catalog: controls ? controlCatalog(controls, this.state.packagingLocked) : [],
      stations: baseline ? [
        station(
          "supplier",
          "Supplier",
          baseline.rawCounters.deliveredMaterialGrams,
          baseline.rawCounters.deliveredMaterialGrams,
          "grams",
          baseline.rawCounters.endingRawMaterialGrams,
          "grams",
        ),
        station(
          "mixer",
          "Mixer",
          baseline.rawCounters.mixedMaterialGrams,
          capacity("mixer"),
          "grams",
          baseline.rawCounters.endingRawMaterialGrams,
          "grams",
        ),
        station(
          "packaging",
          "Packaging",
          baseline.rawCounters.grossUnits,
          capacity("packaging"),
          "units",
          baseline.rawCounters.endingMixedMaterialGrams,
          "grams",
        ),
        station(
          "quality-gate",
          "Quality Gate",
          baseline.rawCounters.inspectedUnits,
          capacity("qualityGate"),
          "units",
          baseline.rawCounters.endingPackagedQueueUnits,
          "units",
        ),
        station(
          "warehouse",
          "Warehouse",
          baseline.rawCounters.goodOutputUnits,
          capacity("warehouse"),
          "units",
          baseline.rawCounters.endingGoodQueueUnits,
          "units",
        ),
      ] : [],
      bottlenecks: baseline?.bottlenecks.map((item) => ({
        resource: item.stage,
        reason: item.reason,
        capacity_limited_ticks: item.capacityLimitedTicks,
        blocked_ticks: item.blockedTicks,
        ending_upstream_queue: item.endingUpstreamQueue,
        queue_unit: item.queueUnit,
      })) ?? [],
      scenario_heads: scenarioHeads,
      evidence_index: Object.values(this.state.runEvidence)
        .sort((left, right) => left.runId.localeCompare(right.runId))
        .map((evidence) => ({
          run_id: evidence.runId,
          scenario_id: evidence.scenarioId,
          scenario_marker: evidence.scenarioMarker,
          scenario_revision: evidence.scenarioRevision,
          scenario_version_id: evidence.scenarioVersionId,
          source_factory_version_id: evidence.baseFactoryVersionId,
          source_factory_revision: evidence.sourceFactoryRevision,
          source_lock_revision: evidence.sourceLockRevision,
          display_label: evidence.scenarioName,
          label_trust: "UNTRUSTED_DISPLAY_TEXT",
          patch: { ...evidence.patch },
          source_is_current: runEvidenceIsCurrent(evidence, this.state),
          feasibility: evidence.receipt.feasibilityStatus,
          good_output_units: evidence.receipt.rawCounters.goodOutputUnits,
          total_cost_micro_eur: evidence.receipt.totalCostMicroEur,
          proof: evidence.receipt.upperBoundProof ? {
            exact_inequality:
              evidence.receipt.upperBoundProof.exactInequality,
            proven: evidence.receipt.upperBoundProof.proven,
          } : null,
        })),
    };
  }

  getScenarioSnapshot(scenarioId: string, scenarioVersionId?: string) {
    const scenario = this.state.scenarios.find((item) => item.id === scenarioId && !item.placeholder);
    if (!scenario || (scenarioVersionId && scenarioVersionId !== scenario.headVersionId)) {
      throw new SandboxCommandError("NOT_FOUND", "Scenario version not found.", { scenario_id: scenarioId });
    }
    const currentness = scenarioCurrentness(scenario, this.state);
    return {
      scenario_id: scenario.id,
      name: scenario.name,
      scenario_revision: scenario.revision,
      scenario_version_id: scenario.headVersionId,
      base_factory_version_id: scenario.baseFactoryVersionId,
      source_factory_revision: scenario.sourceFactoryRevision,
      source_lock_revision: scenario.sourceLockRevision,
      authority_is_current: currentness.authorityCurrent,
      patch: { ...scenario.patch },
      lock_revision: this.state.lockRevision,
      locks: packagingLockProjection(this.state),
      latest_run_id: scenario.receipt?.runId ?? null,
      latest_receipt: scenario.receipt ? this.simulationResult(scenario.receipt, scenario.id, scenario.headVersionId) : null,
      source_is_current: currentness.receiptCurrent,
      currentness: {
        status: currentness.status,
        invalidated_by: currentness.invalidatedBy,
      },
      continuation: continuationForScenario(this.state, scenario),
    };
  }

  createScenario(input: {
    request_id: string;
    name: string;
    factory_version_id: string;
    expected_factory_revision: number;
    expected_lock_revision: number;
  }) {
    return this.idempotent("create_scenario", input.request_id, input, () => {
      if (input.expected_factory_revision !== this.state.factoryRevision || input.factory_version_id !== this.state.factoryVersionId) {
        return this.rejectWrite(
          "STALE_FACTORY",
          "The factory changed. Read the current snapshot before creating a scenario.",
          {
            precondition_diff: {
              expected_factory_revision: input.expected_factory_revision,
              current_factory_revision: this.state.factoryRevision,
              expected_factory_version_id: input.factory_version_id,
              current_factory_version_id: this.state.factoryVersionId,
              expected_lock_revision: input.expected_lock_revision,
              current_lock_revision: this.state.lockRevision,
            },
            recovery: {
              tool: "get_factory_snapshot",
              arguments: {},
              fresh_scenario_required: true,
              fresh_request_id_required: true,
            },
          },
          `factory r${input.expected_factory_revision} expected; r${this.state.factoryRevision} current`,
        );
      }
      if (input.expected_lock_revision !== this.state.lockRevision) {
        return this.rejectWrite(
          "LOCK_CHANGED",
          "The human lock state changed. Read the factory snapshot before creating a scenario.",
          {
            precondition_diff: {
              expected_lock_revision: input.expected_lock_revision,
              current_lock_revision: this.state.lockRevision,
            },
            recovery: {
              tool: "get_factory_snapshot",
              arguments: {},
              fresh_scenario_required: true,
              fresh_request_id_required: true,
            },
          },
          `lock r${input.expected_lock_revision} expected; r${this.state.lockRevision} current`,
        );
      }

      const allocation = nextScenarioAllocation(this.state);
      if (!allocation.slot) {
        return this.rejectWrite(
          "WORKSPACE_FULL",
          "Both scenario slots contain current heads. No current hypothesis was displaced.",
          {
            scenario_workspace: scenarioWorkspaceProjection(this.state),
            recovery: {
              tool: "get_factory_snapshot",
              arguments: {},
              reuse_current_scenario_required: true,
              fresh_request_id_required: true,
            },
          },
          "both scenario slots contain current authority-bound heads",
        );
      }
      const slot = allocation.slot;
      const scenarioId = slot.placeholder
        ? slot.id
        : `scenario-${this.state.eventRevision + 1}`;
      const created: ScenarioRecord = {
        ...slot,
        id: scenarioId,
        name: input.name,
        revision: 1,
        headVersionId: `${scenarioId}-v1`,
        baseFactoryVersionId: this.state.factoryVersionId,
        sourceFactoryRevision: this.state.factoryRevision,
        sourceLockRevision: this.state.lockRevision,
        patch: {},
        placeholder: false,
        receipt: null,
        receiptScenarioRevision: null,
        receiptLockRevision: null,
      };
      let next: SandboxState = {
        ...this.state,
        selectedScenarioId: created.id,
        scenarios: this.state.scenarios.map((scenario) => scenario.id === slot.id ? created : scenario),
      };
      next = this.appendEvent(next, {
        kind: "tool",
        label: `Created ${input.name}`,
        detail: `${created.headVersionId} · clean authority branch at lock r${created.sourceLockRevision}`,
        tone: "primary",
      });
      this.publish(next);
      return {
        committed: true,
        scenario_id: created.id,
        scenario_revision: created.revision,
        scenario_version_id: created.headVersionId,
        source_lock_revision: created.sourceLockRevision,
        lock_revision: this.state.lockRevision,
        allocation_status: allocation.status,
        archived_scenario_id: slot.placeholder ? null : slot.id,
        continuation: continuationForScenario(this.state, created),
      };
    });
  }

  applyScenarioChanges(input: {
    request_id: string;
    scenario_id: string;
    expected_factory_revision: number;
    expected_scenario_revision: number;
    expected_lock_revision: number;
    changes: ScenarioPatch;
  }) {
    return this.idempotent("apply_scenario_changes", input.request_id, input, () => {
      const scenario = this.state.scenarios.find((item) => item.id === input.scenario_id && !item.placeholder);
      if (!scenario) throw new SandboxCommandError("NOT_FOUND", "Scenario not found.");
      if (input.expected_factory_revision !== this.state.factoryRevision) {
        return this.rejectWrite(
          "STALE_FACTORY",
          "The factory authority epoch changed. No scenario changes were applied.",
          {
            precondition_diff: {
              expected_factory_revision: input.expected_factory_revision,
              current_factory_revision: this.state.factoryRevision,
              expected_lock_revision: input.expected_lock_revision,
              current_lock_revision: this.state.lockRevision,
            },
            recovery: {
              tool: "get_factory_snapshot",
              arguments: {},
              fresh_scenario_required: true,
              fresh_request_id_required: true,
            },
          },
          `factory r${input.expected_factory_revision} / lock r${input.expected_lock_revision} expected; factory r${this.state.factoryRevision} / lock r${this.state.lockRevision} current`,
        );
      }
      if (input.expected_lock_revision !== this.state.lockRevision) {
        return this.rejectWrite(
          "LOCK_CHANGED",
          "The human lock state changed. Read the factory snapshot and create a fresh scenario.",
          {
            precondition_diff: {
              expected_lock_revision: input.expected_lock_revision,
              current_lock_revision: this.state.lockRevision,
            },
            recovery: {
              tool: "get_factory_snapshot",
              arguments: {},
              fresh_scenario_required: true,
              fresh_request_id_required: true,
            },
          },
          `lock r${input.expected_lock_revision} expected; r${this.state.lockRevision} current`,
        );
      }
      if (input.expected_scenario_revision !== scenario.revision) {
        return this.rejectWrite(
          "STALE_SCENARIO",
          "The scenario head changed. Read the scenario snapshot before retrying.",
          {
            precondition_diff: {
              expected_scenario_revision: input.expected_scenario_revision,
              current_scenario_revision: scenario.revision,
              current_head_version_id: scenario.headVersionId,
            },
            recovery: {
              tool: "get_scenario_snapshot",
              arguments: { scenario_id: scenario.id },
              fresh_scenario_required: false,
              fresh_request_id_required: true,
            },
          },
          `scenario r${input.expected_scenario_revision} expected; r${scenario.revision} current`,
        );
      }
      if (!scenarioAuthorityIsCurrent(scenario, this.state)) {
        return this.rejectWrite(
          "STALE_SCENARIO",
          "This scenario belongs to an earlier human-authority epoch. Create a fresh scenario before replanning.",
          {
            source_factory_revision: scenario.sourceFactoryRevision,
            current_factory_revision: this.state.factoryRevision,
            source_lock_revision: scenario.sourceLockRevision,
            current_lock_revision: this.state.lockRevision,
            recovery: {
              tool: "get_factory_snapshot",
              arguments: {},
              fresh_scenario_required: true,
              fresh_request_id_required: true,
            },
          },
          `scenario ${scenario.headVersionId} is historical under lock r${this.state.lockRevision}`,
        );
      }

      const normalized = normalizeScenarioChanges(scenario, input.changes);
      const changedFields = Object.keys(normalized.changed) as ScenarioControlField[];
      const blocked = PACKAGING_CONTROL_FIELDS.filter(
        (field) => normalized.changed[field] !== undefined,
      );
      if (this.state.packagingLocked && blocked.length > 0) {
        return this.rejectWrite(
          "HUMAN_LOCKED",
          "Packaging is locked by the human operator. No scenario changes were applied.",
          {
            locked_resource: "Packaging",
            blocked_fields: blocked,
            current_lock_revision: this.state.lockRevision,
            recovery: {
              tool: "apply_scenario_changes",
              arguments: {
                scenario_id: scenario.id,
                expected_factory_revision: this.state.factoryRevision,
                expected_scenario_revision: scenario.revision,
                expected_lock_revision: this.state.lockRevision,
              },
              omit_fields: blocked,
              fresh_scenario_required: false,
              fresh_request_id_required: true,
            },
          },
          `human lock blocks ${blocked.join(", ")}`,
        );
      }
      const phaseClosed = PRE_SHIFT_CONTROL_FIELDS.filter(
        (field) => normalized.changed[field] !== undefined,
      );
      if (this.state.packagingLocked && phaseClosed.length > 0) {
        return this.rejectWrite(
          "PHASE_CLOSED",
          "One or more pre-shift controls are no longer available at the modeled lock time.",
          {
            unavailable_fields: phaseClosed,
            reason_code: "PRE_SHIFT_ONLY",
            effective_tick: PACKAGING_LOCK_EFFECTIVE_TICK,
            effective_elapsed_minutes: PACKAGING_LOCK_EFFECTIVE_MINUTES,
            recovery: {
              tool: "apply_scenario_changes",
              arguments: {
                scenario_id: scenario.id,
                expected_factory_revision: this.state.factoryRevision,
                expected_scenario_revision: scenario.revision,
                expected_lock_revision: this.state.lockRevision,
              },
              omit_fields: phaseClosed,
              fresh_scenario_required: false,
              fresh_request_id_required: true,
            },
          },
          `pre-shift phase closed for ${phaseClosed.join(", ")}`,
        );
      }

      if (changedFields.length === 0) {
        return {
          committed: false,
          outcome: "NO_OP",
          scenario_id: scenario.id,
          scenario_revision: scenario.revision,
          scenario_version_id: scenario.headVersionId,
          applied_fields: [],
          normalized_no_op_fields: normalized.noOps,
          cleared_receipt_id: null,
          continuation: continuationForScenario(this.state, scenario),
        };
      }

      const revision = scenario.revision + 1;
      const updated: ScenarioRecord = {
        ...scenario,
        revision,
        headVersionId: `${scenario.id}-v${revision}`,
        patch: normalized.nextPatch,
        receipt: null,
        receiptScenarioRevision: null,
        receiptLockRevision: null,
      };
      let next: SandboxState = {
        ...this.state,
        scenarios: this.state.scenarios.map((item) => item.id === scenario.id ? updated : item),
      };
      next = this.appendEvent(next, {
        kind: "tool",
        label: `Updated ${scenario.name}`,
        detail: `${changedFields.length} bounded changes · ${normalized.noOps.length} no-op · ${updated.headVersionId}`,
        tone: "primary",
      });
      this.publish(next);
      return {
        committed: true,
        outcome: "UPDATED",
        scenario_id: updated.id,
        scenario_revision: updated.revision,
        scenario_version_id: updated.headVersionId,
        lock_revision: this.state.lockRevision,
        applied_fields: changedFields,
        normalized_no_op_fields: normalized.noOps,
        cleared_receipt_id: scenario.receipt?.runId ?? null,
        continuation: continuationForScenario(this.state, updated),
      };
    });
  }

  async simulateScenarioVersion(input: {
    request_id: string;
    scenario_id: string;
    expected_factory_revision: number;
    expected_scenario_revision: number;
    expected_lock_revision: number;
    horizon_shifts: 1;
  }, signal?: AbortSignal) {
    const fingerprint = canonicalFingerprint(input);
    const previous = this.requests.get(input.request_id);
    if (previous) {
      if (previous.operation !== "run_factory_simulation" || previous.fingerprint !== fingerprint) {
        throw new SandboxCommandError("IDEMPOTENCY_KEY_REUSED", "request_id was already used with different arguments.");
      }
      const data = previous.status === "pending"
        ? await previous.promise as ReturnType<SandboxStore["simulationData"]>
        : previous.result as ReturnType<SandboxStore["simulationData"]>;
      return this.withSimulationCurrentness(
        data,
        input.scenario_id,
      );
    }
    const scenario = this.state.scenarios.find((item) => item.id === input.scenario_id && !item.placeholder);
    if (!scenario) throw new SandboxCommandError("NOT_FOUND", "Scenario model version not found.");
    if (input.expected_factory_revision !== this.state.factoryRevision) {
      throw new SandboxCommandError("STALE_FACTORY", "The factory changed before simulation.", { current_factory_revision: this.state.factoryRevision });
    }
    if (input.expected_scenario_revision !== scenario.revision) {
      throw new SandboxCommandError("STALE_SCENARIO", "The scenario changed before simulation.", {
        current_scenario_revision: scenario.revision,
        current_head_version_id: scenario.headVersionId,
      });
    }
    if (input.expected_lock_revision !== this.state.lockRevision) {
      return this.rejectWrite(
        "LOCK_CHANGED",
        "The human lock state changed before simulation.",
        {
          precondition_diff: {
            expected_lock_revision: input.expected_lock_revision,
            current_lock_revision: this.state.lockRevision,
          },
          recovery: {
            tool: "get_factory_snapshot",
            arguments: {},
            fresh_scenario_required: true,
            fresh_request_id_required: true,
          },
        },
        `lock r${input.expected_lock_revision} expected; r${this.state.lockRevision} current`,
      );
    }
    if (!scenarioAuthorityIsCurrent(scenario, this.state)) {
      return this.rejectWrite(
        "STALE_SCENARIO",
        "This scenario belongs to an earlier human-authority epoch. Create a fresh scenario before simulation.",
        {
          source_factory_revision: scenario.sourceFactoryRevision,
          current_factory_revision: this.state.factoryRevision,
          source_lock_revision: scenario.sourceLockRevision,
          current_lock_revision: this.state.lockRevision,
          recovery: {
            tool: "get_factory_snapshot",
            arguments: {},
            fresh_scenario_required: true,
            fresh_request_id_required: true,
          },
        },
        `scenario ${scenario.headVersionId} is historical under lock r${this.state.lockRevision}`,
      );
    }
    const pending = this.runScenario(scenario.id, signal, "tool")
      .then((receipt) => this.simulationData(receipt, scenario.headVersionId));
    const reservation: StoredRequest = {
      operation: "run_factory_simulation",
      fingerprint,
      status: "pending",
      promise: pending,
    };
    this.requests.set(input.request_id, reservation);
    try {
      const data = await pending;
      this.requests.set(input.request_id, {
        operation: "run_factory_simulation",
        fingerprint,
        status: "complete",
        result: data,
      });
      return this.withSimulationCurrentness(data, scenario.id);
    } catch (error) {
      if (this.requests.get(input.request_id) === reservation) this.requests.delete(input.request_id);
      throw error;
    }
  }

  private simulationResult(receipt: SimulationReceipt, scenarioId: string, modelVersionId: string) {
    return this.withSimulationCurrentness(this.simulationData(receipt, modelVersionId), scenarioId);
  }

  private simulationData(receipt: SimulationReceipt, modelVersionId: string) {
    return {
      run_id: receipt.runId,
      simulator_version: receipt.engineVersion,
      input_hash: receipt.inputHash,
      model_version_id: modelVersionId,
      feasibility: receipt.feasibilityStatus,
      good_output_units: receipt.rawCounters.goodOutputUnits,
      gross_units: receipt.rawCounters.grossUnits,
      bad_units: receipt.rawCounters.badUnits,
      total_cost_micro_eur: receipt.totalCostMicroEur,
      constraints: receipt.constraints.map(({ code, lhs, operator, rhs, unit, pass }) => ({ code, lhs, operator, rhs, unit, pass })),
      proof: receipt.upperBoundProof ? {
        good_output_upper_bound: receipt.upperBoundProof.goodOutputUpperBound,
        target_good_output_units: receipt.upperBoundProof.targetGoodOutputUnits,
        exact_inequality: receipt.upperBoundProof.exactInequality,
      } : null,
    };
  }

  private withSimulationCurrentness(
    data: ReturnType<SandboxStore["simulationData"]>,
    scenarioId: string,
  ) {
    const current = this.state.scenarios.find((scenario) => scenario.id === scenarioId);
    return {
      ...data,
      source_is_current: current !== undefined
        && scenarioAuthorityIsCurrent(current, this.state)
        && current.headVersionId === data.model_version_id
        && current.receipt?.runId === data.run_id
        && current.receiptScenarioRevision === current.revision
        && current.receiptLockRevision === this.state.lockRevision,
    };
  }

  compareRuns(leftRunId: string, rightRunId: string) {
    const left = this.state.runs[leftRunId];
    const right = this.state.runs[rightRunId];
    if (!left || !right) throw new SandboxCommandError("NOT_FOUND", "One or both simulation runs were not found.");
    return {
      left_run_id: leftRunId,
      right_run_id: rightRunId,
      delta_good_output_units: right.rawCounters.goodOutputUnits - left.rawCounters.goodOutputUnits,
      delta_bad_units: right.rawCounters.badUnits - left.rawCounters.badUnits,
      delta_total_cost_micro_eur: (BigInt(right.totalCostMicroEur) - BigInt(left.totalCostMicroEur)).toString(),
      constraints: right.constraints.map(({ code, pass }) => ({ code, right_pass: pass })),
      right_feasibility: right.feasibilityStatus,
    };
  }

  private runSourceIsCurrent(runId: string): boolean {
    if (this.state.baselineReceipt?.runId === runId) return true;
    const evidence = this.state.runEvidence[runId];
    return evidence ? runEvidenceIsCurrent(evidence, this.state) : false;
  }

  private runChangedControlCount(runId: string): number {
    const evidence = this.state.runEvidence[runId];
    return evidence ? Object.keys(evidence.patch).length : 0;
  }

  compareRunSet(runIds: readonly string[]) {
    const [anchorId, ...candidateIds] = runIds;
    const anchor = anchorId ? this.state.runs[anchorId] : undefined;
    if (!anchor || candidateIds.length === 0) {
      throw new SandboxCommandError("NOT_FOUND", "At least two stored simulation runs are required.");
    }
    const receipts = runIds.map((runId) => {
      const receipt = this.state.runs[runId];
      if (!receipt) throw new SandboxCommandError("NOT_FOUND", "One or more simulation runs were not found.", { missing_run_id: runId });
      return { runId, receipt, sourceIsCurrent: this.runSourceIsCurrent(runId) };
    });
    const candidates = receipts.slice(1).map(({ runId, receipt, sourceIsCurrent }) => ({
      run_id: runId,
      source_is_current: sourceIsCurrent,
      delta_good_output_units: receipt.rawCounters.goodOutputUnits - anchor.rawCounters.goodOutputUnits,
      delta_bad_units: receipt.rawCounters.badUnits - anchor.rawCounters.badUnits,
      delta_total_cost_micro_eur: (BigInt(receipt.totalCostMicroEur) - BigInt(anchor.totalCostMicroEur)).toString(),
      feasibility: receipt.feasibilityStatus,
      all_constraints_pass: receipt.constraints.every((constraint) => constraint.pass),
      constraints: receipt.constraints.map(({ code, lhs, operator, rhs, unit, pass }) => ({ code, lhs, operator, rhs, unit, pass })),
    }));

    const defectCompare = (left: SimulationReceipt, right: SimulationReceipt) =>
      left.rawCounters.badUnits * right.rawCounters.grossUnits
      - right.rawCounters.badUnits * left.rawCounters.grossUnits;
    const policyCompare = (
      left: { runId: string; receipt: SimulationReceipt },
      right: { runId: string; receipt: SimulationReceipt },
    ) => {
      const output = right.receipt.rawCounters.goodOutputUnits - left.receipt.rawCounters.goodOutputUnits;
      if (output !== 0) return output;
      const cost = BigInt(left.receipt.totalCostMicroEur) - BigInt(right.receipt.totalCostMicroEur);
      if (cost !== 0n) return cost < 0n ? -1 : 1;
      const defects = defectCompare(left.receipt, right.receipt);
      if (defects !== 0) return defects;
      const leftChanges = this.runChangedControlCount(left.runId);
      const rightChanges = this.runChangedControlCount(right.runId);
      return leftChanges - rightChanges || left.runId.localeCompare(right.runId);
    };
    const eligible = receipts.filter(({ receipt, sourceIsCurrent }) =>
      sourceIsCurrent
      && receipt.feasibilityStatus === "FEASIBLE"
      && receipt.constraints.every((constraint) => constraint.pass),
    );
    const best = [...eligible].sort(policyCompare)[0];

    const dominance: Array<{ run_id: string; dominated_by: string; reasons: string[] }> = [];
    for (const left of receipts) {
      for (const right of receipts) {
        if (left.runId === right.runId) continue;
        const outputAtLeast = right.receipt.rawCounters.goodOutputUnits >= left.receipt.rawCounters.goodOutputUnits;
        const costAtMost = BigInt(right.receipt.totalCostMicroEur) <= BigInt(left.receipt.totalCostMicroEur);
        const defectsAtMost = defectCompare(right.receipt, left.receipt) <= 0;
        const strict = right.receipt.rawCounters.goodOutputUnits > left.receipt.rawCounters.goodOutputUnits
          || BigInt(right.receipt.totalCostMicroEur) < BigInt(left.receipt.totalCostMicroEur)
          || defectCompare(right.receipt, left.receipt) < 0;
        if (outputAtLeast && costAtMost && defectsAtMost && strict) {
          const reasons: string[] = [];
          reasons.push(right.receipt.rawCounters.goodOutputUnits === left.receipt.rawCounters.goodOutputUnits
            ? "same_good_output"
            : "higher_good_output");
          reasons.push(BigInt(right.receipt.totalCostMicroEur) === BigInt(left.receipt.totalCostMicroEur)
            ? "same_total_cost"
            : "lower_total_cost");
          reasons.push(defectCompare(right.receipt, left.receipt) === 0
            ? "same_defect_rate"
            : "lower_defect_rate");
          dominance.push({ run_id: left.runId, dominated_by: right.runId, reasons });
          break;
        }
      }
    }

    return {
      anchor_run_id: anchorId,
      delta_semantics: "CANDIDATE_MINUS_ANCHOR",
      anchor_source_is_current: this.runSourceIsCurrent(anchorId),
      anchor_feasibility: anchor.feasibilityStatus,
      anchor_constraints: anchor.constraints.map(({ code, lhs, operator, rhs, unit, pass }) => ({ code, lhs, operator, rhs, unit, pass })),
      comparisons: candidates,
      selection_policy: [
        "CURRENT_AND_VALID",
        "ALL_HARD_CONSTRAINTS_PASS",
        "MAX_GOOD_OUTPUT",
        "MIN_TOTAL_COST",
        "MIN_DEFECT_RATE",
        "MIN_CHANGED_CONTROLS",
        "CANONICAL_RUN_ID",
      ],
      eligible_current_run_ids: eligible.map((item) => item.runId),
      best_evaluated_run_id: best?.runId ?? null,
      claim_level: best ? "BEST_EVALUATED_UNDER_POLICY" : "NO_CURRENT_FEASIBLE_WINNER",
      dominance,
    };
  }

  async awaitVisibleCommit() {
    // A hidden document cannot produce a meaningful visible paint. Domain state
    // is already committed, so the presentation barrier must not hold the tool
    // response open until the tab becomes visible again.
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }

    if (typeof requestAnimationFrame !== "function") {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
      return;
    }

    // Prefer two frames so React can commit and paint, but bound the wait in
    // case the host throttles or suppresses animation frames.
    await new Promise<void>((resolve) => {
      let settled = false;
      let fallbackId: ReturnType<typeof globalThis.setTimeout> | undefined;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (fallbackId !== undefined) {
          globalThis.clearTimeout(fallbackId);
        }
        resolve();
      };

      fallbackId = globalThis.setTimeout(finish, 300);
      requestAnimationFrame(() => requestAnimationFrame(finish));
    });
  }
}

export const sandboxStore = new SandboxStore();
