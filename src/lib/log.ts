import fs from "node:fs";
import path from "node:path";
import { getLogPath } from "./config";

export type LogEntry = {
  event: string;
  level?: "info" | "error";
  [key: string]: unknown;
};

const SENSITIVE_KEYS = ["cookie", "authorization", "x-csrftoken"];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function isSensitiveKey(key: string) {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some(
    (token) => lower === token || lower.includes(token),
  );
}

function looksLikeCookie(value: string) {
  if (
    value.includes("csrftoken=") ||
    value.includes("sessionid=") ||
    value.includes("cookie=")
  ) {
    return true;
  }
  return value.includes("=") && value.includes(";");
}

export function redactHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return undefined;
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = isSensitiveKey(key) ? "[redacted]" : value;
  }
  return redacted;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return looksLikeCookie(value) ? "[redacted]" : value;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = sanitizeValue(entry, seen);
  }
  return output;
}

export function sanitizeEntry(entry: Record<string, unknown>) {
  const seen = new WeakSet<object>();
  return sanitizeValue(entry, seen) as Record<string, unknown>;
}

function formatValue(value: unknown) {
  return JSON.stringify(value);
}

function formatEntry(entry: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    ts: new Date().toISOString(),
    ...entry,
  };
  const orderedKeys = [
    "ts",
    "level",
    "event",
    "command",
    "args",
    "json",
    "pid",
    "ppid",
    "cwd",
    "node",
    "configDir",
    "exitCode",
    "durationMs",
  ];
  const seen = new Set(orderedKeys);
  const pairs: string[] = [];
  for (const key of orderedKeys) {
    if (base[key] !== undefined) {
      pairs.push(`${key}=${formatValue(base[key])}`);
    }
  }
  for (const key of Object.keys(base).sort()) {
    if (seen.has(key)) continue;
    const value = base[key];
    if (value !== undefined) {
      pairs.push(`${key}=${formatValue(value)}`);
    }
  }
  return pairs.join(" ");
}

export function appendLog(entry: LogEntry) {
  try {
    const logPath = getLogPath();
    ensureDir(path.dirname(logPath));
    const line = formatEntry(sanitizeEntry(entry));
    fs.appendFileSync(logPath, `${line}\n`, "utf8");
  } catch {
    // Logging must never crash the CLI.
  }
}
