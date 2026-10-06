import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Cache, Config, Session } from "./types";

const DEFAULT_CONFIG: Config = {
  baseUrl: "https://www.ebag.bg",
  algolia: {
    appId: "JMJMDQ9HHX",
    apiKey: "42ca9458d9354298c7016ce9155d8481",
    host: "jmjmdq9hhx-dsn.algolia.net",
  },
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

export function getConfigDir() {
  const override = process.env.EBAG_CONFIG_DIR;
  if (override) {
    return override;
  }
  return path.join(os.homedir(), ".config", "ebag");
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  ensureDir(path.dirname(filePath));
  const fd = fs.openSync(filePath, "w", 0o600);
  try {
    // The creation mode does not change permissions on an existing file.
    fs.fchmodSync(fd, 0o600);
    fs.writeFileSync(fd, JSON.stringify(data, null, 2), "utf8");
  } finally {
    fs.closeSync(fd);
  }
}

export function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

export function getSessionPath() {
  return path.join(getConfigDir(), "session.json");
}

export function getCachePath() {
  return path.join(getConfigDir(), "cache.json");
}

export function getLogPath() {
  return path.join(getConfigDir(), "ebag.log");
}

export function loadConfig(): Config {
  const stored = readJsonFile<Config>(getConfigPath(), {} as Config);
  const algolia = {
    appId:
      stored.algolia?.appId ?? DEFAULT_CONFIG.algolia?.appId ?? "JMJMDQ9HHX",
    apiKey:
      stored.algolia?.apiKey ??
      DEFAULT_CONFIG.algolia?.apiKey ??
      "42ca9458d9354298c7016ce9155d8481",
    host: stored.algolia?.host ?? DEFAULT_CONFIG.algolia?.host,
  };
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    algolia,
  };
}

export function saveConfig(config: Config) {
  writeJsonFile(getConfigPath(), config);
}

export function loadSession(): Session {
  return readJsonFile<Session>(getSessionPath(), {} as Session);
}

export function saveSession(session: Session) {
  writeJsonFile(getSessionPath(), session);
}

export function loadCache(): Cache {
  return readJsonFile<Cache>(getCachePath(), { products: {}, orders: {} });
}

export function saveCache(cache: Cache) {
  writeJsonFile(getCachePath(), cache);
}
