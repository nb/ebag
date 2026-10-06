import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validateSession } from "../dist/lib/auth.js";

const config = { baseUrl: "https://www.ebag.bg" };
const session = { cookies: "sessionid=test-session" };
const originalFetch = globalThis.fetch;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebag-test-auth-"));
const sessionPath = path.join(tmpDir, "session.json");
const mockPath = path.join(tmpDir, "fetch.cjs");
const cliPath = new URL("../dist/cli/index.js", import.meta.url).pathname;

function mockUser(data, status = 200) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
}

function runCli(args, user) {
  return execFileSync(
    process.execPath,
    ["--require", mockPath, cliPath, ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        EBAG_CONFIG_DIR: tmpDir,
        EBAG_TEST_USER_RESPONSE: JSON.stringify(user),
      },
    },
  );
}

try {
  const user = {
    user_id: 123,
    email: "test@example.com",
    first_name: "Test",
    is_authenticated: true,
  };
  // Keep upstream coverage for flat and nested responses over HTTP.
  for (const payload of [user, { user }]) {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const localConfig = {
        baseUrl: `http://127.0.0.1:${server.address().port}`,
      };
      assert.deepEqual(await validateSession(localConfig, session), user);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  }

  for (const anonymousUser of [
    { is_authenticated: false },
    { is_authenticated: false, email: "test@example.com" },
    { email: "test@example.com" },
    { is_authenticated: "true" },
    {},
    null,
  ]) {
    for (const payload of [anonymousUser, { user: anonymousUser }]) {
      mockUser(payload);
      await assert.rejects(validateSession(config, session), (err) => {
        assert.equal(err.status, 401);
        assert.match(err.message, /fresh Cookie header/);
        return true;
      });
    }
  }

  mockUser({ is_authenticated: true, user: { is_authenticated: false } });
  await assert.rejects(validateSession(config, session), { status: 401 });

  mockUser({ detail: "Forbidden" }, 403);
  await assert.rejects(validateSession(config, session), { status: 403 });
  mockUser({ detail: "Server error" }, 500);
  await assert.rejects(validateSession(config, session), { status: 500 });

  fs.writeFileSync(
    mockPath,
    `globalThis.fetch = async () => new Response(process.env.EBAG_TEST_USER_RESPONSE, {
  headers: { "content-type": "application/json" }
});
`,
  );
  fs.writeFileSync(sessionPath, JSON.stringify(session));
  for (const anonymousUser of [
    { is_authenticated: false },
    { user: { is_authenticated: false } },
  ]) {
    assert.deepEqual(JSON.parse(runCli(["--json", "status"], anonymousUser)), {
      status: "logged_out",
    });
    assert.equal(runCli(["status"], anonymousUser), "Logged out.\n");

    const failedLogin = JSON.parse(
      runCli(
        ["--json", "login", "--cookie", "sessionid=expired"],
        anonymousUser,
      ),
    );
    assert.equal(failedLogin.status, "error");
    assert.match(failedLogin.message, /fresh Cookie header/);
    assert.deepEqual(JSON.parse(fs.readFileSync(sessionPath, "utf8")), session);
  }

  for (const payload of [user, { user }]) {
    const loggedIn = JSON.parse(runCli(["--json", "status"], payload));
    assert.equal(loggedIn.status, "logged_in");
    assert.equal(loggedIn.email, user.email);
    assert.deepEqual(loggedIn.user, user);
  }

  const login = JSON.parse(
    runCli(["--json", "login", "--cookie", "sessionid=fresh"], { user }),
  );
  assert.equal(login.status, "ok");
  assert.equal(login.email, user.email);
  assert.deepEqual(login.user, user);
  assert.equal(
    JSON.parse(fs.readFileSync(sessionPath, "utf8")).cookies,
    "sessionid=fresh",
  );
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log("auth.test ok");
