import assert from "node:assert/strict";
import { validateSession } from "../dist/lib/auth.js";

// Mock requestEbag by replacing the module's dependency
// Instead, test the unwrapping logic directly by calling validateSession
// with a fake config and session that hits a mock server

import http from "node:http";

const mockUser = {
  user_id: 123,
  email: "test@example.com",
  first_name: "Test",
  is_authenticated: true,
};

// Test 1: /user/json returns { user: { email: ... } } (current ebag.bg format)
{
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ user: mockUser }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;

  const config = { baseUrl: `http://127.0.0.1:${port}` };
  const session = { cookies: "sessionid=fake" };
  const result = await validateSession(config, session);
  assert.equal(result.email, "test@example.com");
  assert.equal(result.user_id, 123);

  server.close();
}

// Test 2: /user/json returns { email: ... } directly (flat format)
{
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(mockUser));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;

  const config = { baseUrl: `http://127.0.0.1:${port}` };
  const session = { cookies: "sessionid=fake" };
  const result = await validateSession(config, session);
  assert.equal(result.email, "test@example.com");

  server.close();
}

console.log("auth.test ok");
