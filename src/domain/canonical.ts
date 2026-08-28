import type { JsonValue } from "./types";

/**
 * RFC-8259-compatible stable JSON with lexicographically sorted object keys.
 * Bigints are deliberately encoded as quoted base-10 strings so receipts remain
 * portable across browsers, Node, storage engines, and JSON-only transports.
 */
export function canonicalStableStringify(value: unknown): string {
  const ancestors = new Set<object>();

  const encode = (candidate: unknown, inArray: boolean): string | undefined => {
    if (candidate === null) return "null";

    switch (typeof candidate) {
      case "string":
      case "boolean":
        return JSON.stringify(candidate);
      case "number":
        if (!Number.isFinite(candidate)) {
          throw new TypeError("Canonical JSON cannot encode non-finite numbers");
        }
        return JSON.stringify(Object.is(candidate, -0) ? 0 : candidate);
      case "bigint":
        return JSON.stringify(candidate.toString(10));
      case "undefined":
      case "function":
      case "symbol":
        return inArray ? "null" : undefined;
      case "object":
        break;
      default:
        throw new TypeError("Unsupported canonical JSON value");
    }

    const object = candidate as object;
    if (ancestors.has(object)) {
      throw new TypeError("Canonical JSON cannot encode circular structures");
    }
    ancestors.add(object);

    let encoded: string;
    if (Array.isArray(object)) {
      const array = object as unknown[];
      const items = Array.from({ length: array.length }, (_, index) =>
        encode(array[index], true) ?? "null",
      );
      encoded = `[${items.join(",")}]`;
    } else {
      const record = object as Record<string, unknown>;
      const pairs: string[] = [];
      for (const key of Object.keys(record).sort()) {
        const encodedValue = encode(record[key], false);
        if (encodedValue !== undefined) {
          pairs.push(`${JSON.stringify(key)}:${encodedValue}`);
        }
      }
      encoded = `{${pairs.join(",")}}`;
    }

    ancestors.delete(object);
    return encoded;
  };

  const encoded = encode(value, false);
  if (encoded === undefined) {
    throw new TypeError("Canonical JSON requires a serializable root value");
  }
  return encoded;
}
export function canonicalJsonClone<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalStableStringify(value)) as T;
}

/** Uses the platform Web Crypto implementation available in browsers and Node 20+. */
export async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("SHA-256 requires Web Crypto (browser or Node 20+)");
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
