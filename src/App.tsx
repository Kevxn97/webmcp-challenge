import { useEffect, useMemo, useSyncExternalStore } from "react";

import { SandboxFactoryCommandBus } from "./app/commandBus";
import { sandboxStore } from "./app/store";
import { createBlueprintViewModel } from "./app/viewModel";
import { BlueprintShell } from "./ui/BlueprintShell";
import { registerFactoryWebMcpTools, type WebMcpRegistration } from "./webmcp";

const commandBus = new SandboxFactoryCommandBus(sandboxStore);

export function App() {
  const state = useSyncExternalStore(
    sandboxStore.subscribe,
    sandboxStore.getSnapshot,
    sandboxStore.getSnapshot,
  );
  const model = useMemo(() => createBlueprintViewModel(state), [state]);

  useEffect(() => {
    let active = true;
    let registration: WebMcpRegistration | undefined;

    void sandboxStore.hydrateShowcase().then(() => {
      if (!active) return;
      registration = registerFactoryWebMcpTools(commandBus);
      return registration.ready.then(() => {
        if (active) sandboxStore.setWebMcpReady(registration?.supported ?? false);
      });
    }).catch(() => {
      if (active) sandboxStore.setWebMcpReady(false);
    });

    return () => {
      active = false;
      registration?.cleanup();
    };
  }, []);

  return (
    <BlueprintShell
      model={model}
      onReset={() => sandboxStore.reset()}
      onTogglePackagingLock={() => void sandboxStore.togglePackagingLock()}
      onSelectScenario={(scenarioId) => sandboxStore.selectScenario(scenarioId)}
      onRunSelected={() => void sandboxStore.runSelected()}
      onBranch={() => sandboxStore.branchSelected()}
    />
  );
}
