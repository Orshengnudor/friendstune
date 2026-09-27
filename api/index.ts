/**
 * THE API ON VERCEL
 * -----------------
 * Static import so Vercel traces and bundles packages/web/src/api into the
 * function. A dynamic import left the source path in the compiled file and
 * production then 500'd with ERR_MODULE_NOT_FOUND on every /api/rpc/charts/*.
 */

import type { Hono } from "hono";
import app from "../packages/web/src/api/index.js";

type HonoApp = { fetch: (request: Request) => Response | Promise<Response> };

const honoApp = app as unknown as HonoApp;

function isNodeResponse(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { setHeader?: unknown }).setHeader === "function"
  );
}

function headerValue(req: { headers?: Record<string, unknown> }, name: string): string | undefined {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return raw[0] as string | undefined;
  return typeof raw === "string" ? raw : undefined;
}

function absoluteUrl(req: { url?: string; headers?: Record<string, unknown> }): string {
  const path = req.url ?? "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const proto = headerValue(req, "x-forwarded-proto") ?? "https";
  const host = headerValue(req, "x-forwarded-host") ?? headerValue(req, "host") ?? "localhost";
  return new URL(path, `${proto}://${host}`).toString();
}

async function nodeBody(req: Record<string, unknown>, method: string): Promise<BodyInit | undefined> {
  if (method === "GET" || method === "HEAD") return undefined;
  const body = req.body;
  if (body !== undefined && body !== null && body !== "") {
    if (typeof body === "string") return body;
    if (body instanceof Uint8Array) return body as unknown as BodyInit;
    return JSON.stringify(body);
  }
  const chunks: Uint8Array[] = [];
  const stream = req as unknown as AsyncIterable<Uint8Array | string>;
  if (typeof (stream as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] !== "function") {
    return undefined;
  }
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  }
  if (chunks.length === 0) return undefined;
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged as unknown as BodyInit;
}

function toRequestHeaders(req: { headers?: Record<string, unknown> }): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, String(item));
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}

function diagnostics(): Response {
  return Response.json({
    function: "ok",
    runtime: typeof process !== "undefined" ? process.version : "unknown",
    databaseUrl: process.env.DATABASE_URL ? "set" : "missing",
    databaseAuthToken: process.env.DATABASE_AUTH_TOKEN ? "set" : "missing",
    app: typeof (honoApp as Hono)?.fetch === "function" ? "loaded" : "missing",
  });
}

function failure(error: unknown): Response {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  return new Response(`friendstune api failed\n\n${message}\n`, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function serve(request: Request): Promise<Response> {
  try {
    if (new URL(request.url).pathname === "/api/__diag") return diagnostics();
    return await honoApp.fetch(request);
  } catch (error) {
    return failure(error);
  }
}

async function serveNode(req: Record<string, unknown>, res: Record<string, unknown>): Promise<void> {
  const response = await (async () => {
    try {
      const method = ((req.method as string) ?? "GET").toUpperCase();
      const request = new Request(absoluteUrl(req as { url?: string }), {
        method,
        headers: toRequestHeaders(req as { headers?: Record<string, unknown> }),
        body: await nodeBody(req, method),
      });
      return await serve(request);
    } catch (error) {
      return failure(error);
    }
  })();

  const write = res as unknown as {
    statusCode: number;
    setHeader: (name: string, value: string | string[]) => void;
    end: (chunk?: Uint8Array) => void;
  };
  write.statusCode = response.status;
  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    write.setHeader(key, value);
  });
  if (cookies.length > 0) write.setHeader("set-cookie", cookies);
  const buffer = new Uint8Array(await response.arrayBuffer());
  write.end(buffer);
}

export default function handler(req: unknown, res?: unknown): unknown {
  if (isNodeResponse(res)) {
    return serveNode(req as Record<string, unknown>, res as Record<string, unknown>);
  }
  return serve(req as Request);
}

export const GET = serve;
export const POST = serve;
export const PUT = serve;
export const PATCH = serve;
export const DELETE = serve;
export const HEAD = serve;
export const OPTIONS = serve;
