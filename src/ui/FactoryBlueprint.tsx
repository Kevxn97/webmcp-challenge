import { ArrowRight, LockSimple, LockSimpleOpen } from "@phosphor-icons/react";

import type { ScenarioView, StationView } from "./types";

interface FactoryBlueprintProps {
  stations: StationView[];
  scenarios: ScenarioView[];
  onTogglePackagingLock: () => void;
}

function TraceLane({
  marker,
  label,
  laneTone,
  stateTone,
  stateLabel,
  stations,
}: {
  marker: "BL" | "A" | "B";
  label: string;
  laneTone: "baseline" | "danger" | "primary";
  stateTone: ScenarioView["tone"];
  stateLabel: string;
  stations: StationView[];
}) {
  return (
    <div className={`trace-lane trace-lane--${laneTone}`}>
      <div className="trace-label">
        <span className="trace-marker">{marker}</span>
        <span>
          <strong>{label}</strong>
          <small className={`trace-state trace-state--${stateTone}`}>{stateLabel}</small>
        </span>
      </div>
      <div className="trace-track" aria-hidden="true">
        {stations.map((station) => (
          <span className="trace-node" key={`${marker}-${station.id}`}>
            <i />
            <small>{marker === "A" ? station.deltaA : marker === "B" ? station.deltaB : "0%"}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function traceState(scenario: ScenarioView | undefined): string {
  switch (scenario?.status) {
    case "FEASIBLE": return "Feasible";
    case "FAILED": return "Violates";
    case "STALE": return "Stale receipt";
    case "PROVEN INFEASIBLE": return "Locked infeasible";
    case "NOT RUN": return "Not run";
    default: return "Not run";
  }
}

export function FactoryBlueprint({
  stations,
  scenarios,
  onTogglePackagingLock,
}: FactoryBlueprintProps) {
  const scenarioA = scenarios.find((scenario) => scenario.marker === "A");
  const scenarioB = scenarios.find((scenario) => scenario.marker === "B");

  return (
    <section className="blueprint" aria-labelledby="factory-blueprint-title">
      <div className="blueprint-toolbar">
        <div>
          <span className="section-eyebrow">Live factory model</span>
          <h1 id="factory-blueprint-title">Packaging line · Shift 01</h1>
        </div>
        <div className="blueprint-legend" aria-label="Scenario legend">
          <span><i className="legend-line legend-line--baseline" />Baseline</span>
          <span><i className="legend-line legend-line--danger" />Scenario A</span>
          <span><i className="legend-line legend-line--primary" />Scenario B</span>
          <span><b>Units</b> per shift unless noted</span>
        </div>
      </div>

      <div className="station-flow">
        {stations.map(({ Icon, ...station }, index) => (
          <article
            className={`station-card${station.bottleneck ? " station-card--bottleneck" : ""}${station.locked ? " station-card--locked" : ""}`}
            key={station.id}
          >
            <div className="station-heading">
              <span>{station.ordinal}</span>
              <div>
                <strong>{station.name}</strong>
                <small>{station.subtitle}</small>
              </div>
            </div>
            <Icon className="station-icon" aria-hidden="true" size={52} weight="thin" />
            {station.id === "packaging" && (
              <button
                className={`station-lock${station.locked ? " station-lock--active" : ""}`}
                type="button"
                onClick={onTogglePackagingLock}
                aria-pressed={station.locked}
                title={station.locked ? "Unlock Packaging as the human operator" : "Lock Packaging as the human operator"}
              >
                {station.locked ? (
                  <LockSimple aria-hidden="true" size={16} weight="bold" />
                ) : (
                  <LockSimpleOpen aria-hidden="true" size={16} weight="bold" />
                )}
                {station.locked ? "Locked by human" : "Lock resource"}
              </button>
            )}
            {station.bottleneck && <span className="bottleneck-label">Capacity bottleneck</span>}
            <dl className="station-metrics">
              <div>
                <dt>Queue</dt>
                <dd>{station.queue}</dd>
              </div>
              <div>
                <dt>Utilization</dt>
                <dd>{station.utilization}</dd>
              </div>
            </dl>
            <p className="throughput-band">{station.throughputBand}</p>
            {index < stations.length - 1 && (
              <span className="flow-arrow" aria-hidden="true">
                <ArrowRight size={22} weight="bold" />
              </span>
            )}
          </article>
        ))}
      </div>

      <div className="trace-stack">
        <TraceLane marker="BL" label="Baseline" laneTone="baseline" stateTone="baseline" stateLabel="Current" stations={stations} />
        <TraceLane marker="A" label={scenarioA?.name ?? "Scenario A"} laneTone="danger" stateTone={scenarioA?.tone ?? "primary"} stateLabel={traceState(scenarioA)} stations={stations} />
        <TraceLane marker="B" label={scenarioB?.name ?? "Scenario B"} laneTone="primary" stateTone={scenarioB?.tone ?? "primary"} stateLabel={traceState(scenarioB)} stations={stations} />
      </div>

      <footer className="blueprint-scale">
        <span>0 m</span>
        <i aria-hidden="true" />
        <span>40 m</span>
        <strong>Scale 1:250</strong>
      </footer>
    </section>
  );
}
