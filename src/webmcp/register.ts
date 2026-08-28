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
  bus: FactoryCommandBus;
  controller: AbortController;
  refs: number;
  ready: Promise<void>;
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

    state.refs -= 1;
    if (state.refs > 0) {
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

  if (existing?.active) {
    existing.bus = bus;
    existing.refs += 1;
    return {
      supported: true,
      ready: existing.ready,
      cleanup: createCleanup(registry, modelContext, existing),
    };
  }

  const controller = new AbortController();
  const state: ActiveRegistration = {
    active: true,
    bus,
    controller,
    refs: 1,
    ready: Promise.resolve(),
  };
  registry.set(modelContext, state);

  const descriptors = createFactoryToolDescriptors(() => state.bus);
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
    cleanup: createCleanup(registry, modelContext, state),
  };
}
