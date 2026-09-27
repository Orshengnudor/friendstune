/**
 * TURSO OVER PLAIN HTTP
 * ---------------------
 * The charts reach the database through Turso's HTTP pipeline API and nothing
 * else: one fetch call per query, no driver package, no native sqlite binding,
 * no websocket shim. That matters because the same module runs in three very
 * different places (the Vite dev server, a Vercel Node function, and the
 * typecheck) and the official client drags in code that only survives one of
 * them.
 *
 * Reference: POST {url}/v2/pipeline with a bearer token, a list of requests,
 * and a close, which keeps every call stateless.
 */

/** A value as Turso sends it back inside a row. */
type TursoValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: number }
  | { type: "text"; value: string }
  | { type: "blob"; base64: string };

/** A value as Turso wants it in a statement's argument list. */
type TursoArg = TursoValue;

interface PipelineResponse {
  results?: Array<{
    type: "ok" | "error";
    error?: { message?: string; code?: string };
    response?: {
      type: string;
      result?: { cols?: Array<{ name: string | null }>; rows?: TursoValue[][] };
    };
  }>;
}

/** libsql://host and ws(s)://host both speak HTTP on the same host. */
function httpEndpoint(raw: string): string {
  const url = raw.trim();
  const host = url.replace(/^(libsql|wss|ws|https|http):\/\//, "");
  const secure = !/^(http|ws):\/\//.test(url) || /^(https|wss):\/\//.test(url);
  return `${secure ? "https" : "http"}://${host.replace(/\/+$/, "")}/v2/pipeline`;
}

function toArg(value: unknown): TursoArg {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "bigint") return { type: "integer", value: value.toString() };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { type: "integer", value: String(value) }
      : { type: "float", value };
  }
  if (typeof value === "string") return { type: "text", value };
  if (value instanceof Uint8Array) {
    let binary = "";
    for (const byte of value) binary += String.fromCharCode(byte);
    return { type: "blob", base64: btoa(binary) };
  }
  if (value instanceof Date) return { type: "integer", value: String(value.getTime()) };
  return { type: "text", value: JSON.stringify(value) };
}

function fromValue(value: TursoValue): unknown {
  switch (value.type) {
    case "null":
      return null;
    case "integer": {
      const asNumber = Number(value.value);
      return Number.isSafeInteger(asNumber) ? asNumber : BigInt(value.value);
    }
    case "float":
      return value.value;
    case "text":
      return value.value;
    case "blob": {
      const binary = atob(value.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
  }
}

export interface TursoConfig {
  url: string;
  authToken?: string;
}

/** Runs one statement and returns its rows as positional arrays. */
export async function execute(
  config: TursoConfig,
  sql: string,
  params: unknown[],
): Promise<unknown[][]> {
  if (!config.url) {
    throw new Error("DATABASE_URL is not set, so the charts have no database to read");
  }

  const response = await fetch(httpEndpoint(config.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.authToken ? { authorization: `Bearer ${config.authToken}` } : {}),
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: params.map(toArg) } },
        { type: "close" },
      ],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`turso http ${response.status}: ${detail}`);
  }

  const body = (await response.json()) as PipelineResponse;
  const result = body.results?.[0];
  if (!result || result.type === "error") {
    throw new Error(`turso: ${result?.error?.message ?? "no result returned"}`);
  }

  return (result.response?.result?.rows ?? []).map((row) => row.map(fromValue));
}
