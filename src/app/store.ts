import {
  createBaselineInput,
  createInvalidCostScenarioInput,
  createValidScenarioInput,
  simulateFactory,
  type FactoryOperation,
  type FactorySimulationInput,
  type SimulationReceipt,
} from "../domain";

export type ScenarioPatch = {
  mixer_speed_bps?: number;
  packaging_speed_bps?: number;
  packaging_changeover_minutes?: 15 | 30 | 45;
  packaging_calibration?: "standard" | "enhanced";
  supplier_mode?: "standard" | "expedite";
  quality_rate_units_per_hour?: 600 | 700 | 800 | 900;
  warehouse_dock_units_per_hour?: 800 | 900 | 1000;
};

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
  patch: ScenarioPatch;
  placeholder: boolean;
  receipt: SimulationReceipt | null;
  receiptScenarioRevision: number | null;
  receiptLockRevision: number | null;
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
  ledger: SandboxLedgerEvent[];
}

export type SandboxCommandCode =
  | "STALE_FACTORY"
  | "STALE_SCENARIO"
  | "LOCK_CHANGED"
  | "HUMAN_LOCKED"
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

function scenarioSlot(marker: "A" | "B", factoryVersionId: string): ScenarioRecord {
  const id = `scenario-${marker.toLowerCase()}`;
  return {
    id,
    marker,
    name: `Scenario ${marker}`,
    revision: 0,
    headVersionId: `${id}-empty`,
    baseFactoryVersionId: factoryVersionId,
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
    Object.entries(state.runs).map(([runId, receipt]) => [runId, deepFreeze(receipt)]),
  );
  return Object.freeze({
    ...state,
    baselineReceipt: state.baselineReceipt ? deepFreeze(state.baselineReceipt) : null,
    scenarios: Object.freeze(scenarios) as unknown as ScenarioRecord[],
    ledger: Object.freeze(state.ledger.map((event) => Object.freeze({ ...event }))) as unknown as SandboxLedgerEvent[],
    runs: Object.freeze(runs),
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

function patchToOperations(
  patch: ScenarioPatch,
  prefix: string,
  tick = 0,
): FactoryOperation[] {
  const operations: FactoryOperation[] = [];
  if (patch.mixer_speed_bps !== undefined) {
    operations.push({ operationId: `${prefix}-mixer-speed`, tick, actor: "model", kind: "SET_MIXER_SPEED", valueBps: patch.mixer_speed_bps });
  }
  if (patch.packaging_speed_bps !== undefined) {
    operations.push({ operationId: `${prefix}-packaging-speed`, tick, actor: "model", kind: "SET_PACKAGING_SPEED", valueBps: patch.packaging_speed_bps });
  }
  if (patch.packaging_changeover_minutes !== undefined) {
    operations.push({ operationId: `${prefix}-changeover`, tick, actor: "model", kind: "SET_CHANGEOVER_MINUTES", valueMinutes: patch.packaging_changeover_minutes });
  }
  if (patch.packaging_calibration !== undefined) {
    operations.push({ operationId: `${prefix}-calibration`, tick, actor: "model", kind: "SET_CALIBRATION", value: patch.packaging_calibration });
  }
  if (patch.supplier_mode !== undefined) {
    operations.push({ operationId: `${prefix}-supplier`, tick, actor: "model", kind: "SET_SUPPLIER_MODE", value: patch.supplier_mode });
  }
  if (patch.quality_rate_units_per_hour !== undefined) {
    operations.push({ operationId: `${prefix}-quality`, tick, actor: "model", kind: "SET_QUALITY_RATE", valueUnitsPerHour: patch.quality_rate_units_per_hour });
  }
  if (patch.warehouse_dock_units_per_hour !== undefined) {
    operations.push({ operationId: `${prefix}-warehouse`, tick, actor: "model", kind: "SET_WAREHOUSE_RATE", valueUnitsPerHour: patch.warehouse_dock_units_per_hour });
  }
  return operations;
}

function inputForScenario(scenario: ScenarioRecord, packagingLocked: boolean): FactorySimulationInput {
  const input = createBaselineInput();
  const prefix = `${scenario.id}-r${scenario.revision}`;
  if (!packagingLocked) {
    return { ...input, operations: patchToOperations(scenario.patch, prefix) };
  }

  return {
    ...input,
    operations: [
      {
        operationId: `human-packaging-lock-l${scenario.receiptLockRevision ?? 1}`,
        tick: 16,
        actor: "human",
        kind: "LOCK_RESOURCE",
        resource: "Packaging",
      },
      ...patchToOperations(scenario.patch, prefix, 16),
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

  async hydrateShowcase() {
    if (this.hydratePromise) return this.hydratePromise;
    this.hydratePromise = (async () => {
      const [baselineReceipt, invalidReceipt, validReceipt] = await Promise.all([
        simulateFactory(createBaselineInput()),
        simulateFactory(createInvalidCostScenarioInput()),
        simulateFactory(createValidScenarioInput()),
      ]);

      const factoryVersionId = "factory-v1";
      const scenarioA: ScenarioRecord = {
        ...scenarioSlot("A", factoryVersionId),
        name: "Scenario A · expedite",
        revision: 1,
        headVersionId: "scenario-a-v1",
        patch: { ...INVALID_COST_PATCH },
        placeholder: false,
        receipt: invalidReceipt,
        receiptScenarioRevision: 1,
        receiptLockRevision: 0,
      };
      const scenarioB: ScenarioRecord = {
        ...scenarioSlot("B", factoryVersionId),
        name: "Scenario B · constrained",
        revision: 1,
        headVersionId: "scenario-b-v1",
        patch: { ...VALID_PATCH },
        placeholder: false,
        receipt: validReceipt,
        receiptScenarioRevision: 1,
        receiptLockRevision: 0,
      };

      let next: SandboxState = {
        ...this.state,
        hydrated: true,
        busy: false,
        baselineReceipt,
        scenarios: [scenarioA, scenarioB],
        runs: {
          [baselineReceipt.runId]: baselineReceipt,
          [invalidReceipt.runId]: invalidReceipt,
          [validReceipt.runId]: validReceipt,
        },
      };
      const seededEvents: Array<Omit<SandboxLedgerEvent, "id" | "timestamp" | "revision">> = [
        { kind: "tool", label: "Factory snapshot read", detail: "get_factory_snapshot · factory-v1", tone: "neutral" },
        { kind: "agent", label: "Generated Scenario A", detail: "Expedite supplier + constrained line changes", tone: "primary" },
        { kind: "simulation", label: "Scenario A failed", detail: `Receipt ${invalidReceipt.runId.slice(0, 16)} · cost cap violated`, tone: "danger" },
        { kind: "agent", label: "Generated Scenario B", detail: "Replanned without supplier premium", tone: "primary" },
        { kind: "simulation", label: "Scenario B feasible", detail: `Receipt ${validReceipt.runId.slice(0, 16)} · all constraints pass`, tone: "success" },
      ];
      for (const event of seededEvents) next = this.appendEvent(next, event);

      next = {
        ...next,
        factoryRevision: 2,
        factoryVersionId: "factory-v2",
        lockRevision: 1,
        packagingLocked: true,
      };
      next = this.appendEvent(next, {
        kind: "human",
        label: "Locked Packaging",
        detail: "Human constraint changed · prior receipts are now stale",
        tone: "warning",
      });
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
      detail: locked ? "Agent changes to Packaging now fail closed" : "Packaging is available for future scenario revisions",
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
      const receipt = await simulateFactory(inputForScenario(scenario, source.packagingLocked));
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
        scenarios: this.state.scenarios.map((item) => item.id === scenarioId ? updated : item),
        runs: { ...this.state.runs, [receipt.runId]: receipt },
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
    const branched: ScenarioRecord = {
      ...selected,
      name: `${selected.marker === "B" ? "Scenario B" : "Scenario A"} · branch ${nextRevision}`,
      revision: nextRevision,
      headVersionId: `${selected.id}-v${nextRevision}`,
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
      detail: `Created immutable ${branched.headVersionId}`,
      tone: "primary",
    });
    this.publish(next);
  }

  reset() {
    this.requests.clear();
    const factoryRevision = this.state.factoryRevision + 1;
    let next: SandboxState = {
      ...this.state,
      busy: false,
      factoryRevision,
      factoryVersionId: `factory-v${factoryRevision}`,
      lockRevision: this.state.lockRevision + 1,
      packagingLocked: false,
      selectedScenarioId: "scenario-a",
      scenarios: [scenarioSlot("A", `factory-v${factoryRevision}`), scenarioSlot("B", `factory-v${factoryRevision}`)],
      runs: this.state.baselineReceipt ? { [this.state.baselineReceipt.runId]: this.state.baselineReceipt } : {},
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
    return {
      factory_revision: this.state.factoryRevision,
      factory_version_id: this.state.factoryVersionId,
      lock_revision: this.state.lockRevision,
      locks: this.state.packagingLocked ? [{ resource: "Packaging", scope: "all controls" }] : [],
      mission: {
        output_gain_min_basis_points: 2_000,
        cost_increase_max_basis_points: 800,
        defect_rate_may_increase: false,
        new_machine_limit: 0,
      },
      baseline_run_id: this.state.baselineReceipt?.runId ?? null,
      baseline_metrics: baseline ? {
        good_output_units: baseline.rawCounters.goodOutputUnits,
        gross_units: baseline.rawCounters.grossUnits,
        bad_units: baseline.rawCounters.badUnits,
        total_cost_micro_eur: baseline.totalCostMicroEur,
        defect_rate_fraction: `${baseline.rawCounters.badUnits}/${baseline.rawCounters.grossUnits}`,
      } : null,
      current_controls: controls ? {
        mixer_speed_bps: controls.mixerSpeedBps,
        packaging_speed_bps: controls.packagingSpeedBps,
        packaging_changeover_minutes: controls.changeoverMinutes,
        packaging_calibration: controls.calibration,
        quality_rate_units_per_hour: controls.qualityRateUnitsPerHour,
        warehouse_dock_units_per_hour: controls.warehouseRateUnitsPerHour,
        supplier_mode: controls.supplierMode,
      } : null,
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
      scenario_heads: this.state.scenarios
        .filter((scenario) => !scenario.placeholder)
        .map((scenario) => ({
          scenario_id: scenario.id,
          name: scenario.name,
          revision: scenario.revision,
          head_version_id: scenario.headVersionId,
          latest_run_id: scenario.receipt?.runId ?? null,
          source_is_current: scenario.receiptLockRevision === this.state.lockRevision && scenario.receiptScenarioRevision === scenario.revision,
        })),
    };
  }

  getScenarioSnapshot(scenarioId: string, scenarioVersionId?: string) {
    const scenario = this.state.scenarios.find((item) => item.id === scenarioId && !item.placeholder);
    if (!scenario || (scenarioVersionId && scenarioVersionId !== scenario.headVersionId)) {
      throw new SandboxCommandError("NOT_FOUND", "Scenario version not found.", { scenario_id: scenarioId });
    }
    return {
      scenario_id: scenario.id,
      name: scenario.name,
      scenario_revision: scenario.revision,
      scenario_version_id: scenario.headVersionId,
      base_factory_version_id: scenario.baseFactoryVersionId,
      patch: { ...scenario.patch },
      lock_revision: this.state.lockRevision,
      locks: this.state.packagingLocked ? [{ resource: "Packaging", scope: "all controls" }] : [],
      latest_run_id: scenario.receipt?.runId ?? null,
      latest_receipt: scenario.receipt ? this.simulationResult(scenario.receipt, scenario.id, scenario.headVersionId) : null,
      source_is_current: scenario.receiptLockRevision === this.state.lockRevision && scenario.receiptScenarioRevision === scenario.revision,
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
        throw new SandboxCommandError("STALE_FACTORY", "The factory changed. Read the current snapshot before creating a scenario.", {
          current_factory_revision: this.state.factoryRevision,
          current_factory_version_id: this.state.factoryVersionId,
        });
      }
      if (input.expected_lock_revision !== this.state.lockRevision) {
        throw new SandboxCommandError("LOCK_CHANGED", "The human lock state changed. Read the factory snapshot before creating a scenario.", {
          current_lock_revision: this.state.lockRevision,
        });
      }
      const slot = this.state.scenarios.find((scenario) => scenario.placeholder)
        ?? this.state.scenarios.find((scenario) => scenario.id !== this.state.selectedScenarioId)
        ?? this.state.scenarios[0];
      if (!slot) throw new SandboxCommandError("INTERNAL_ERROR", "The scenario workspace could not allocate a comparison slot.");
      const scenarioId = slot.placeholder ? slot.id : `scenario-${this.state.eventRevision + 1}`;
      const created: ScenarioRecord = {
        ...slot,
        id: scenarioId,
        name: input.name,
        revision: 1,
        headVersionId: `${scenarioId}-v1`,
        baseFactoryVersionId: this.state.factoryVersionId,
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
        detail: `${created.headVersionId} · baseline remains immutable`,
        tone: "primary",
      });
      this.publish(next);
      return {
        scenario_id: created.id,
        scenario_revision: created.revision,
        scenario_version_id: created.headVersionId,
        lock_revision: this.state.lockRevision,
        archived_scenario_id: slot.placeholder ? null : slot.id,
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
        throw new SandboxCommandError("STALE_FACTORY", "The factory changed. Read the current snapshot before revising a scenario.", {
          current_factory_revision: this.state.factoryRevision,
          current_factory_version_id: this.state.factoryVersionId,
        });
      }
      if (input.expected_lock_revision !== this.state.lockRevision) {
        throw new SandboxCommandError("LOCK_CHANGED", "The human lock state changed. Read the factory snapshot and replan.", {
          current_lock_revision: this.state.lockRevision,
        });
      }
      if (input.expected_scenario_revision !== scenario.revision) {
        throw new SandboxCommandError("STALE_SCENARIO", "The scenario head changed. Read the scenario snapshot before retrying.", {
          current_head_version_id: scenario.headVersionId,
          current_scenario_revision: scenario.revision,
        });
      }
      const packagingKeys: Array<keyof ScenarioPatch> = ["packaging_speed_bps", "packaging_changeover_minutes", "packaging_calibration"];
      const blocked = packagingKeys.filter((key) => input.changes[key] !== undefined);
      if (this.state.packagingLocked && blocked.length > 0) {
        throw new SandboxCommandError("HUMAN_LOCKED", "Packaging is locked by the human operator. No scenario changes were applied.", {
          locked_resource: "Packaging",
          blocked_fields: blocked,
          current_lock_revision: this.state.lockRevision,
        });
      }
      const revision = scenario.revision + 1;
      const updated: ScenarioRecord = {
        ...scenario,
        revision,
        headVersionId: `${scenario.id}-v${revision}`,
        patch: { ...scenario.patch, ...input.changes },
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
        detail: `${Object.keys(input.changes).length} bounded changes · ${updated.headVersionId}`,
        tone: "primary",
      });
      this.publish(next);
      return {
        scenario_id: updated.id,
        scenario_revision: updated.revision,
        scenario_version_id: updated.headVersionId,
        lock_revision: this.state.lockRevision,
        applied_fields: Object.keys(input.changes),
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
    if (input.expected_lock_revision !== this.state.lockRevision) throw new SandboxCommandError("LOCK_CHANGED", "The human lock state changed before simulation.", { current_lock_revision: this.state.lockRevision });
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
      source_is_current: current?.headVersionId === data.model_version_id
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

  compareRunSet(runIds: readonly string[]) {
    const [anchorId, ...candidateIds] = runIds;
    const anchor = anchorId ? this.state.runs[anchorId] : undefined;
    if (!anchor || candidateIds.length === 0) {
      throw new SandboxCommandError("NOT_FOUND", "At least two stored simulation runs are required.");
    }
    const candidates = candidateIds.map((runId) => {
      const receipt = this.state.runs[runId];
      if (!receipt) throw new SandboxCommandError("NOT_FOUND", "One or more simulation runs were not found.", { missing_run_id: runId });
      return {
        run_id: runId,
        delta_good_output_units: receipt.rawCounters.goodOutputUnits - anchor.rawCounters.goodOutputUnits,
        delta_bad_units: receipt.rawCounters.badUnits - anchor.rawCounters.badUnits,
        delta_total_cost_micro_eur: (BigInt(receipt.totalCostMicroEur) - BigInt(anchor.totalCostMicroEur)).toString(),
        feasibility: receipt.feasibilityStatus,
        all_constraints_pass: receipt.constraints.every((constraint) => constraint.pass),
        constraints: receipt.constraints.map(({ code, lhs, operator, rhs, unit, pass }) => ({ code, lhs, operator, rhs, unit, pass })),
      };
    });
    return {
      anchor_run_id: anchorId,
      anchor_feasibility: anchor.feasibilityStatus,
      anchor_constraints: anchor.constraints.map(({ code, lhs, operator, rhs, unit, pass }) => ({ code, lhs, operator, rhs, unit, pass })),
      comparisons: candidates,
    };
  }

  async awaitVisibleCommit() {
    const schedule = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => globalThis.setTimeout(() => callback(0), 0);
    await new Promise<void>((resolve) => schedule(() => schedule(() => resolve())));
  }
}

export const sandboxStore = new SandboxStore();
