import { useState } from "react";

import { EvidenceDialog } from "./EvidenceDialog";
import { FactoryBlueprint } from "./FactoryBlueprint";
import { RevisionLedger } from "./RevisionLedger";
import { ScenarioTable } from "./ScenarioTable";
import { TopBar } from "./TopBar";
import type { BlueprintViewModel } from "./types";

interface BlueprintShellProps {
  model: BlueprintViewModel;
  onReset: () => void;
  onTogglePackagingLock: () => void;
  onSelectScenario: (scenarioId: string) => void;
  onRunSelected: () => void;
  onBranch: () => void;
}

export function BlueprintShell({
  model,
  onReset,
  onTogglePackagingLock,
  onSelectScenario,
  onRunSelected,
  onBranch,
}: BlueprintShellProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const selectedScenario = model.scenarios.find((scenario) => scenario.id === model.selectedScenarioId);

  return (
    <main className="app-shell">
      <TopBar
        revision={model.revision}
        webMcpStatus={model.webMcpStatus}
        constraints={model.constraints}
        onReset={onReset}
      />
      <div className="workspace-grid">
        <div className="decision-workspace">
          <FactoryBlueprint
            stations={model.stations}
            scenarios={model.scenarios}
            onTogglePackagingLock={onTogglePackagingLock}
          />
          <ScenarioTable
            scenarios={model.scenarios}
            checks={model.checks}
            selectedScenarioId={model.selectedScenarioId}
            currentRevision={selectedScenario?.revision ?? model.revision}
            latestRevision={model.latestRevision}
            busy={model.busy}
            onSelectScenario={onSelectScenario}
            onRunSelected={onRunSelected}
            onBranch={onBranch}
            onExplain={() => setEvidenceOpen(true)}
          />
        </div>
        <RevisionLedger events={model.ledger} />
      </div>
      <div className="sandbox-disclaimer">
        Deterministic decision sandbox · No machine control · No external side effects
      </div>
      <EvidenceDialog scenario={selectedScenario} open={evidenceOpen} onClose={() => setEvidenceOpen(false)} />
    </main>
  );
}
