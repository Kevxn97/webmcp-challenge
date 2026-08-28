import {
  CheckCircle,
  GitBranch,
  Info,
  Play,
  Warning,
  XCircle,
} from "@phosphor-icons/react";

import type { ConstraintCheckView, ScenarioView } from "./types";

interface ScenarioTableProps {
  scenarios: ScenarioView[];
  checks: ConstraintCheckView[];
  selectedScenarioId: string;
  currentRevision: number;
  latestRevision: number;
  busy: boolean;
  onSelectScenario: (scenarioId: string) => void;
  onRunSelected: () => void;
  onBranch: () => void;
  onExplain: () => void;
}

function PassState({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="check-state check-state--pending">Not run</span>;
  return pass ? (
    <span className="check-state check-state--pass"><CheckCircle aria-hidden="true" size={15} weight="fill" />Pass</span>
  ) : (
    <span className="check-state check-state--fail"><XCircle aria-hidden="true" size={15} weight="fill" />Fail</span>
  );
}

function scenarioForMarker(scenarios: ScenarioView[], marker: string) {
  return scenarios.find((scenario) => scenario.marker === marker);
}

export function ScenarioTable({
  scenarios,
  checks,
  selectedScenarioId,
  currentRevision,
  latestRevision,
  busy,
  onSelectScenario,
  onRunSelected,
  onBranch,
  onExplain,
}: ScenarioTableProps) {
  const baseline = scenarioForMarker(scenarios, "BL");
  const scenarioA = scenarioForMarker(scenarios, "A");
  const scenarioB = scenarioForMarker(scenarios, "B");
  const selected = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarioB ?? baseline;
  const hasReceipt = Boolean(selected?.receiptId);
  const stale = hasReceipt && (latestRevision > currentRevision || selected?.status === "STALE");

  return (
    <section className="scenario-comparison" aria-labelledby="scenario-comparison-title">
      <div className="comparison-heading">
        <div>
          <span className="section-eyebrow">Decision evidence</span>
          <h2 id="scenario-comparison-title">Scenario comparison</h2>
        </div>
        <button className="quiet-button" type="button" onClick={onExplain} disabled={!hasReceipt}>
          <Info aria-hidden="true" size={16} weight="bold" />
          Why this result?
        </button>
      </div>

      <div className="comparison-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Baseline</th>
              <th scope="col">
                <button
                  type="button"
                  className={selectedScenarioId === scenarioA?.id ? "scenario-column scenario-column--selected" : "scenario-column"}
                  onClick={() => scenarioA && onSelectScenario(scenarioA.id)}
                >
                  <span>A</span> Scenario A
                </button>
              </th>
              <th scope="col">
                <button
                  type="button"
                  className={selectedScenarioId === scenarioB?.id ? "scenario-column scenario-column--selected" : "scenario-column"}
                  onClick={() => scenarioB && onSelectScenario(scenarioB.id)}
                >
                  <span>B</span> Scenario B
                </button>
              </th>
              <th scope="col">Constraint</th>
              <th scope="col">A status</th>
              <th scope="col">B status</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.id}>
                <th scope="row">
                  <strong>{check.label}</strong>
                  <small>{check.id}</small>
                </th>
                <td>{check.baseline}</td>
                <td className="scenario-a-value">{check.scenarioA}</td>
                <td className="scenario-b-value">{check.scenarioB}</td>
                <td><code>{check.rule}</code></td>
                <td><PassState pass={check.scenarioAPass} /></td>
                <td><PassState pass={check.scenarioBPass} /></td>
                <td className="evidence-cell">
                  <span className={check.scenarioAPass === false ? "evidence-fail" : ""}>{check.scenarioAEvidence}</span>
                  <span className={check.scenarioBPass === true ? "evidence-pass" : ""}>{check.scenarioBEvidence}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="decision-bar">
        <div className="selected-scenario">
          <span className={`scenario-badge scenario-badge--${selected?.tone ?? "baseline"}`}>{selected?.marker ?? "BL"}</span>
          <span>
            <small>Selected scenario</small>
            <strong>{selected?.name ?? "Baseline"}</strong>
          </span>
          <b className={`scenario-status scenario-status--${selected?.tone ?? "baseline"}`}>{selected?.status ?? "BASELINE"}</b>
        </div>
        <button className="primary-action" type="button" onClick={onRunSelected} disabled={busy || !selected?.runnable}>
          <Play aria-hidden="true" size={20} weight="fill" />
          {busy ? "Running deterministic simulation…" : "Run selected scenario"}
        </button>
        <button className="secondary-action" type="button" onClick={onBranch} disabled={busy || !selected?.branchable}>
          <GitBranch aria-hidden="true" size={20} weight="bold" />
          Branch from here
        </button>
        <div className={`revision-warning${stale ? " revision-warning--visible" : ""}`} role="status">
          {hasReceipt ? <Warning aria-hidden="true" size={24} weight="fill" /> : <Info aria-hidden="true" size={24} weight="fill" />}
          <span>
            <strong>{!hasReceipt ? "No receipt yet" : stale ? "Revision mismatch" : "Revision current"}</strong>
            <small>{!hasReceipt ? `Ready at lock revision v${latestRevision}` : stale ? `Viewing v${currentRevision}; latest is v${latestRevision}` : `Receipt verified at v${currentRevision}`}</small>
          </span>
        </div>
      </footer>
    </section>
  );
}
