import fs from "node:fs";
import path from "node:path";
import { appendLog, sanitizeEntry } from "../dist/lib/log.js";
import { getLogPath } from "../dist/lib/config.js";

const tmpDir = new URL("../.tmp/ebag-test", import.meta.url).pathname;
process.env.EBAG_CONFIG_DIR = tmpDir;

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resetLog() {
  const logPath = getLogPath();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
  return logPath;
}

function testSanitizeEntry() {
  const entry = {
    event: "test",
    headers: {
      cookie: "sessionid=abc; csrftoken=xyz;",
      authorization: "Bearer secret",
      "x-csrftoken": "token",
      accept: "application/json",
    },
    nested: {
      cookies: "should redact",
      items: ["ok", "csrftoken=hidden;"],
    },
  };
  const sanitized = sanitizeEntry(entry);
  expect(
    sanitized.headers.cookie === "[redacted]",
    "cookie should be redacted",
  );
  expect(
    sanitized.headers.authorization === "[redacted]",
    "authorization should be redacted",
  );
  expect(
    sanitized.headers["x-csrftoken"] === "[redacted]",
    "x-csrftoken should be redacted",
  );
  expect(
    sanitized.headers.accept === "application/json",
    "non-sensitive header preserved",
  );
  expect(
    sanitized.nested.cookies === "[redacted]",
    "nested cookie-like key redacted",
  );
  expect(
    sanitized.nested.items[1] === "[redacted]",
    "cookie-like string redacted",
  );
}

function testAppendLogRedaction() {
  const logPath = resetLog();
  appendLog({
    event: "command.start",
    level: "info",
    headers: {
      cookie: "sessionid=abc; csrftoken=xyz;",
    },
    args: ["login", "--cookie", "sessionid=abc;"],
  });
  const logText = fs.readFileSync(logPath, "utf8");
  expect(
    !logText.includes("sessionid=abc"),
    "log should not contain raw cookie value",
  );
  expect(logText.includes('event="command.start"'), "log should include event");
}

function testCookieArgumentsAndPermissions() {
  const logPath = resetLog();
  const singleCookie = "auth=single-secret-value";
  appendLog({
    event: "command.start",
    args: ["login", "--cookie", singleCookie],
  });
  expect((fs.statSync(logPath).mode & 0o777) === 0o600, "log is owner-only");
  fs.chmodSync(logPath, 0o644);
  appendLog({
    event: "command.start",
    args: ["login", `--cookie=${singleCookie}`],
  });
  appendLog({
    event: "command.start",
    args: ["login", "--cookie", "invalid-secret"],
  });
  const text = fs.readFileSync(logPath, "utf8");
  expect(!text.includes(singleCookie), "single cookie argument is redacted");
  expect(
    !text.includes("invalid-secret"),
    "invalid cookie argument is redacted",
  );
  expect(
    (fs.statSync(logPath).mode & 0o777) === 0o600,
    "existing log is owner-only",
  );
}

testSanitizeEntry();
testAppendLogRedaction();
testCookieArgumentsAndPermissions();
console.log("log.test ok");
