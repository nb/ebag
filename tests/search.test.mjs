import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { searchProducts } from "../dist/lib/search.js";

const config = { baseUrl: "https://www.ebag.bg" };
const session = { cookies: "sessionid=test-session" };
const originalFetch = globalThis.fetch;
const originalConfigDir = process.env.EBAG_CONFIG_DIR;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebag-test-search-"));
process.env.EBAG_CONFIG_DIR = tmpDir;

function mockSearch({
  listStatus = 200,
  algoliaStatus = 200,
  lists = [],
} = {}) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const parsedUrl = new URL(url);
    calls.push(parsedUrl);
    let status = 200;
    let data;
    if (parsedUrl.hostname.endsWith(".algolia.net")) {
      status = algoliaStatus;
      data = {
        results: [
          {
            hits: [
              { id: 1, name_bg: "Шоколад каталог" },
              { id: 2, name_bg: "Шоколад втори" },
            ],
          },
        ],
      };
    } else if (parsedUrl.pathname === "/lists/json") {
      status = listStatus;
      data = lists;
    } else if (parsedUrl.pathname === "/products/1/json") {
      data = { id: 1, name: "Шоколад от списък" };
    } else {
      throw new Error(`Unexpected request: ${parsedUrl}`);
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return calls;
}

try {
  for (const listStatus of [401, 403]) {
    const calls = mockSearch({ listStatus });
    const result = await searchProducts(config, session, "шоколад", {
      limit: 1,
    });
    assert.deepEqual(
      result.results.map((product) => product.id),
      [1],
    );
    assert.equal(result.results[0].source, "algolia");
    assert.deepEqual(result.sourceCounts, { list: 0, algolia: 2 });
    assert.equal(calls.length, 2);
  }

  const anonymousCalls = mockSearch();
  const anonymousSearch = await searchProducts(config, {}, "шоколад");
  assert.equal(anonymousSearch.results.length, 2);
  assert.equal(anonymousCalls.length, 1);
  assert.equal(anonymousCalls[0].hostname.endsWith(".algolia.net"), true);

  const serverErrorCalls = mockSearch({ listStatus: 500 });
  await assert.rejects(searchProducts(config, session, "шоколад"), {
    status: 500,
  });
  assert.equal(serverErrorCalls.length, 1);

  mockSearch({ listStatus: 403, algoliaStatus: 403 });
  await assert.rejects(searchProducts(config, session, "шоколад"), {
    status: 403,
    message: "Algolia request failed 403",
  });

  mockSearch({
    lists: [
      {
        id: 10,
        name: "Любими",
        products: [{ product_id: 1, quantity: 1 }],
      },
    ],
  });
  const listSearch = await searchProducts(config, session, "шоколад");
  assert.deepEqual(
    listSearch.results.map((product) => product.id),
    [1, 2],
  );
  assert.equal(listSearch.results[0].name, "Шоколад от списък");
  assert.equal(listSearch.results[0].source, "list");
  assert.deepEqual(listSearch.results[0].listNames, ["Любими"]);
  assert.deepEqual(listSearch.sourceCounts, { list: 1, algolia: 2 });
} finally {
  globalThis.fetch = originalFetch;
  if (originalConfigDir === undefined) {
    delete process.env.EBAG_CONFIG_DIR;
  } else {
    process.env.EBAG_CONFIG_DIR = originalConfigDir;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log("search.test ok");
