import { GoogleGenAI } from "@google/genai";
import { ZodError, type ZodType } from "zod";

/**
 * The only place the app talks to a model. Everything is JSON-in/JSON-out and
 * validated with Zod, so an invalid or partial response is caught here and
 * retried rather than corrupting a kit. Rate limits (the brief's most common
 * failure) are handled with in-process throttling + exponential backoff.
 *
 * Provider seam: swapping to OpenRouter/anything else means reimplementing
 * callModel() only — callers are provider-agnostic.
 */

const MODEL = process.env.LLM_MODEL ?? "gemini-2.0-flash";
const MIN_GAP_MS = Number(process.env.LLM_MIN_GAP_MS ?? 1200);
const MAX_ATTEMPTS = Number(process.env.LLM_MAX_ATTEMPTS ?? 6);

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see .env.example)");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ponytail: one in-process gate serializes calls with a minimum gap so a single
// pipeline stays under the provider's tokens-per-minute limit. A real
// token-bucket per provider only matters if we ever run pipelines concurrently.
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastCall = Date.now();
    }
  };
  const result = chain.then(run, run);
  chain = result.catch(() => {});
  return result;
}

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: number; code?: number; response?: { status?: number } };
  return e?.status ?? e?.code ?? e?.response?.status;
}
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
function isRateLimit(err: unknown): boolean {
  return statusOf(err) === 429 || /RESOURCE_EXHAUSTED|rate limit|quota|too many/i.test(messageOf(err));
}
function isTransient(err: unknown): boolean {
  const s = statusOf(err);
  return (s !== undefined && s >= 500) || /ECONNRESET|ETIMEDOUT|network|fetch failed|overloaded|unavailable/i.test(messageOf(err));
}

/** Honour a server-suggested retry delay if present, else exponential backoff + jitter. */
function backoffMs(attempt: number, err: unknown): number {
  const m = messageOf(err).match(/retry(?:Delay|-after)"?[:\s]+"?(\d+(?:\.\d+)?)(s)?/i);
  if (m) return Math.ceil(parseFloat(m[1]) * (m[2] ? 1000 : 1)) + 250;
  const base = Math.min(1000 * 2 ** attempt, 30_000);
  return base + Math.floor(Math.random() * 500);
}

/** Pull the first JSON value out of a model response, tolerating code fences and prose. */
export function extractJson(text: string): unknown {
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const first = s.search(/[[{]/);
  if (first === -1) throw new Error("no JSON found in model response");
  s = s.slice(first);
  // Walk to the matching closing bracket so trailing prose is ignored.
  const open = s[0];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(0, i + 1));
    }
  }
  return JSON.parse(s); // let JSON.parse throw a useful error
}

async function callModel(system: string | undefined, prompt: string, temperature: number): Promise<string> {
  const res = await throttle(() =>
    getClient().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature,
        ...(system ? { systemInstruction: system } : {}),
      },
    }),
  );
  return res.text ?? "";
}

export async function generateJSON<T>(opts: {
  system?: string;
  prompt: string;
  schema: ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const { system, prompt, schema, temperature = 0.4 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const text = await callModel(system, prompt, temperature);
      return schema.parse(extractJson(text));
    } catch (err) {
      lastErr = err;
      if (isRateLimit(err) || isTransient(err)) {
        await sleep(backoffMs(attempt, err));
        continue;
      }
      // Malformed/invalid-shape response: re-ask a couple of times before giving up.
      if (err instanceof ZodError || err instanceof SyntaxError || /no JSON found/.test(messageOf(err))) {
        await sleep(400);
        continue;
      }
      throw err; // permanent (config, auth, bad request) — fail fast, don't burn retries
    }
  }
  throw new Error(`LLM call failed after ${MAX_ATTEMPTS} attempts: ${messageOf(lastErr)}`);
}
