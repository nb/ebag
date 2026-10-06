import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname;
const checkPath = path.join(root, "scripts/check-package.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ebag-test-package-"));
const cache = path.join(fixture, "npm-cache");
const env = { ...process.env, npm_config_cache: cache };

function write(file, content = "// package test fixture\n") {
  const target = path.join(fixture, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function check() {
  return execFileSync(process.execPath, [checkPath], {
    cwd: fixture,
    env,
    encoding: "utf8",
    stdio: "pipe",
  });
}

try {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  write("package.json", JSON.stringify({ ...pkg, scripts: {} }));
  write("README.md", "# Package fixture\n");
  for (const dir of ["cli", "lib"]) {
    for (const file of fs.readdirSync(path.join(root, "src", dir))) {
      if (!file.endsWith(".ts") || file.endsWith(".d.ts")) continue;
      write(`src/${dir}/${file}`);
      write(`dist/${dir}/${file.slice(0, -3)}.js`);
      write(`dist/${dir}/${file.slice(0, -3)}.d.ts`);
    }
  }
  // These files must never enter a release even if they exist in the workspace.
  for (const file of [
    ".env",
    ".npmrc",
    "cookie",
    "captures/capture.json",
    "tests/.config/ebag/session.json",
    "dist/session.json",
    "dist/lib/session.json",
    "dist/lib/ebag.log",
    "dist/lib/auth.js.map",
  ]) {
    write(file, "sessionid=package-regression-secret\n");
  }
  assert.match(check(), /Package check passed/);
  assert.equal(
    execFileSync(process.execPath, [checkPath], {
      cwd: fixture,
      env: { ...env, npm_lifecycle_event: "prepack" },
      encoding: "utf8",
      stdio: "pipe",
    }),
    "",
    "prepack must preserve npm pack's machine-readable stdout",
  );

  write("dist/lib/secret.js");
  assert.throws(check, (err) => {
    assert.match(err.stderr, /Unexpected package files: dist\/lib\/secret.js/);
    return true;
  });
  fs.unlinkSync(path.join(fixture, "dist/lib/secret.js"));

  const secret = "sessionid=package-regression-secret";
  write("dist/lib/auth.js", `const cookie = '${secret}';\n`);
  assert.throws(check, (err) => {
    assert.match(err.stderr, /Possible session cookie in package file/);
    assert.ok(!`${err.stdout}${err.stderr}`.includes(secret));
    return true;
  });
  write("dist/lib/auth.js");

  write(
    "README.md",
    "ebag order show 0123456789ABCDEF\nebag list add 123456 5128 --qty 1\nebag list show 123456\n",
  );
  assert.match(
    check(),
    /Package check passed/,
    "public example IDs are allowed",
  );
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

console.log("package.test ok");
