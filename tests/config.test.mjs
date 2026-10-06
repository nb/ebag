import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getCachePath,
  getConfigPath,
  getSessionPath,
  loadCache,
  loadConfig,
  loadSession,
  saveCache,
  saveConfig,
  saveSession,
} from "../dist/lib/config.js";

const originalConfigDir = process.env.EBAG_CONFIG_DIR;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebag-test-config-"));
process.env.EBAG_CONFIG_DIR = path.join(tmpDir, "config");

try {
  const cases = [
    [saveSession, loadSession, getSessionPath, { cookies: "auth=test-token" }],
    [saveConfig, loadConfig, getConfigPath, { baseUrl: "https://www.ebag.bg" }],
    [
      saveCache,
      loadCache,
      getCachePath,
      { products: {}, orders: {}, updatedAt: "2026-01-01T00:00:00Z" },
    ],
  ];
  for (const [save, load, getPath, data] of cases) {
    save(data);
    assert.equal(fs.statSync(getPath()).mode & 0o777, 0o600);
    fs.chmodSync(getPath(), 0o644);
    save(data);
    assert.equal(fs.statSync(getPath()).mode & 0o777, 0o600);
    for (const [key, value] of Object.entries(data)) {
      assert.deepEqual(load()[key], value);
    }
  }
  assert.equal(fs.statSync(process.env.EBAG_CONFIG_DIR).mode & 0o777, 0o700);
} finally {
  if (originalConfigDir === undefined) delete process.env.EBAG_CONFIG_DIR;
  else process.env.EBAG_CONFIG_DIR = originalConfigDir;
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log("config.test ok");
