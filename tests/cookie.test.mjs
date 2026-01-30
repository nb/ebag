import assert from "node:assert/strict";
import {
  normalizeCookieInput,
  validateCookieInput,
} from "../dist/lib/cookies.js";

assert.equal(normalizeCookieInput("  a=b; c=d  "), "a=b; c=d");
assert.equal(normalizeCookieInput("Cookie: a=b; c=d"), "a=b; c=d");
assert.equal(normalizeCookieInput("cookie: a=b"), "a=b");

assert.equal(validateCookieInput(""), "Cookie value is empty.");
assert.equal(
  validateCookieInput("a=b\nc=d"),
  "Cookie value should be a single header line without newlines.",
);
assert.equal(
  validateCookieInput("invalid"),
  'Cookie value should look like "name=value" pairs from the Cookie header.',
);
assert.equal(
  validateCookieInput("baba"),
  'Cookie value should look like "name=value" pairs from the Cookie header.',
);
assert.equal(
  validateCookieInput("a="),
  'Cookie value should look like "name=value" pairs from the Cookie header.',
);
assert.equal(
  validateCookieInput("=b"),
  'Cookie value should look like "name=value" pairs from the Cookie header.',
);
assert.equal(validateCookieInput("a=b; c=d"), null);

console.log("cookie.test ok");
