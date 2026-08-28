import type {
  FactoryCommandBus,
  WebMcpDocumentLike,
  WebMcpModelContext,
  WebMcpRegistration,
} from "./contracts";
import { createFactoryToolDescriptors } from "./tools";

const REGISTRY_KEY = Symbol.for("agentic-sandbox.webmcp.registration.v1");

interface ActiveRegistration {
  active: boolean;
  busRegistrations: BusRegistration[];
  controller: AbortController;
  ready: Promise<void>;
}

interface BusRegistration {
  token: symbol;
  bus: FactoryCommandBus;
}

type RegistrationRegistry = WeakMap<WebMcpModelContext, ActiveRegistration>;

function getRegistry(): RegistrationRegistry {
  const host = globalThis as typeof globalThis & Record<PropertyKey, unknown>;
  const existing = host[REGISTRY_KEY];
  if (existing instanceof WeakMap) {
    return existing as RegistrationRegistry;
  }

  const registry: RegistrationRegistry = new WeakMap();
  host[REGISTRY_KEY] = registry;
  return registry;
}

function noOpRegistration(): WebMcpRegistration {
  return {
    supported: false,
    ready: Promise.resolve(),
    cleanup: () => undefined,
  };
}

function resolveDefaultTarget(): WebMcpDocumentLike | undefined {
  return typeof document === "undefined"
    ? undefined
    : (document as unknown as WebMcpDocumentLike);
}

function createCleanup(
  registry: RegistrationRegistry,
  modelContext: WebMcpModelContext,
  state: ActiveRegistration,
  token: symbol,
): () => void {
  let cleaned = false;

  return () => {
    if (cleaned) {
      return;
    }
    cleaned = true;

    if (!state.active) {
      return;
    }

    const registrationIndex = state.busRegistrations.findIndex(
      (registration) => registration.token === token,
    );
    if (registrationIndex === -1) {
      return;
    }
    state.busRegistrations.splice(registrationIndex, 1);

    if (state.busRegistrations.length > 0) {
      return;
    }

    state.active = false;
    state.controller.abort();
    if (registry.get(modelContext) === state) {
      registry.delete(modelContext);
    }
  };
}

export function registerFactoryWebMcpTools(
  bus: FactoryCommandBus,
  target: WebMcpDocumentLike | undefined = resolveDefaultTarget(),
): WebMcpRegistration {
  let candidate: WebMcpDocumentLike["modelContext"];
  try {
    candidate = target?.modelContext;
    if (!candidate || typeof candidate.registerTool !== "function") {
      return noOpRegistration();
    }
  } catch {
    return noOpRegistration();
  }

  const modelContext = candidate as WebMcpModelContext;
  const registry = getRegistry();
  const existing = registry.get(modelContext);
  const token = Symbol("webmcp-bus-registration");

  if (existing?.active) {
    existing.busRegistrations.push({ token, bus });
    return {
      supported: true,
      ready: existing.ready,
      cleanup: createCleanup(registry, modelContext, existing, token),
    };
  }

  const controller = new AbortController();
  const state: ActiveRegistration = {
    active: true,
    busRegistrations: [{ token, bus }],
    controller,
    ready: Promise.resolve(),
  };
  registry.set(modelContext, state);

  const descriptors = createFactoryToolDescriptors(() => {
    const activeBus = state.busRegistrations.at(-1);
    if (!activeBus) {
      throw new Error("No active WebMCP command bus.");
    }
    return activeBus.bus;
  });
  state.ready = Promise.all(
    descriptors.map((descriptor) =>
      Promise.resolve().then(() =>
        modelContext.registerTool(descriptor, { signal: controller.signal }),
      ),
    ),
  )
    .then(() => undefined)
    .catch(() => {
      state.active = false;
      controller.abort();
      if (registry.get(modelContext) === state) {
        registry.delete(modelContext);
      }
      throw new Error("WebMCP tool registration failed.");
    });

  // Keep an unobserved registration failure from becoming a global rejection;
  // callers that need diagnostics can still await `ready`.
  void state.ready.catch(() => undefined);

  return {
    supported: true,
    ready: state.ready,
    cleanup: createCleanup(registry, modelContext, state, token),
  };
}
