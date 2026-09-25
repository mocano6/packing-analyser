import type { WyscoutApiErrorBody } from "@/types/wyscout";

export const WYSCOUT_DEFAULT_BASE_URL = "https://apirest.wyscout.com/v3";
/** Limit Wyscout: 12 req/s — zostawiamy zapas. */
export const WYSCOUT_MIN_REQUEST_GAP_MS = 90;

export interface WyscoutClientConfig {
  username: string;
  password: string;
  baseUrl: string;
  configured: boolean;
}

export function getWyscoutConfig(
  env: NodeJS.ProcessEnv = process.env,
): WyscoutClientConfig {
  const username = env.WYSCOUT_USERNAME?.trim() ?? "";
  const password = env.WYSCOUT_PASSWORD?.trim() ?? "";
  const rawBase = env.WYSCOUT_BASE_URL?.trim() || WYSCOUT_DEFAULT_BASE_URL;
  const baseUrl = rawBase.replace(/\/+$/, "");
  return {
    username,
    password,
    baseUrl,
    configured: Boolean(username && password),
  };
}

export function buildWyscoutAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

export function buildWyscoutUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function parseWyscoutErrorMessage(
  status: number,
  bodyText: string,
): string {
  if (status === 401) return "Nieprawidłowy login lub hasło Wyscout API.";
  if (status === 403) return "Brak uprawnień do tego zasobu Wyscout (licencja).";
  if (status === 429) return "Limit Wyscout (12 żądań/s) — spróbuj za chwilę.";
  try {
    const parsed = JSON.parse(bodyText) as WyscoutApiErrorBody;
    const message = parsed.error?.message?.trim();
    if (message) return `Wyscout ${status}: ${message}`;
  } catch {
    // ignore
  }
  const snippet = bodyText.trim().slice(0, 180);
  return snippet ? `Wyscout ${status}: ${snippet}` : `Wyscout ${status}`;
}

let lastRequestAt = 0;
let requestChain: Promise<void> = Promise.resolve();

export function resetWyscoutThrottleForTests(): void {
  lastRequestAt = 0;
  requestChain = Promise.resolve();
}

async function throttleWyscoutRequest(minGapMs: number): Promise<void> {
  const run = requestChain.then(async () => {
    const wait = lastRequestAt + minGapMs - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
  });
  requestChain = run.catch(() => undefined);
  await run;
}

export class WyscoutClientError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WyscoutClientError";
    this.status = status;
  }
}

export async function wyscoutGet<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  const config = getWyscoutConfig(env);
  if (!config.configured) {
    throw new WyscoutClientError(
      503,
      "Brak WYSCOUT_USERNAME / WYSCOUT_PASSWORD w środowisku serwera.",
    );
  }

  await throttleWyscoutRequest(WYSCOUT_MIN_REQUEST_GAP_MS);
  const url = buildWyscoutUrl(config.baseUrl, path, query);
  const res = await fetch(url, {
    headers: {
      Authorization: buildWyscoutAuthHeader(config.username, config.password),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new WyscoutClientError(res.status, parseWyscoutErrorMessage(res.status, text));
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
