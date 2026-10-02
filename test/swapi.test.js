"use strict";

// swapi-polycall's own behaviour. The SWAPI responses come from a local
// stub HTTP server (this tests the client, not swapi.dev); the one live
// request to https://swapi.dev runs only with SWAPI_LIVE=1 and is otherwise
// reported as skipped. Nothing here involves Polycall: this package is not a
// Polycall binding.

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const swapi = require("..");

async function stub(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}/api`;
}

test("settings are read from the package directory, not the cwd", () => {
  const cwd = process.cwd();
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "swapi-cwd-"));
  try {
    process.chdir(elsewhere);
    const config = swapi.parseConfig();
    assert.equal(config.remote.base_url, "https://swapi.dev/api");
    assert.equal(config.polycall.name, "swapi-polycall");
  } finally {
    process.chdir(cwd);
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
  assert.equal(swapi.DEFAULT_CONFIG, path.join(__dirname, "..", "swapi-polycall.ini"));
});

test("operation and id verification", () => {
  for (const op of ["people", "planets", "starships", "films", "species", "vehicles"]) assert.equal(swapi.verifyOperation(op), true);
  assert.equal(swapi.verifyOperation("droids"), false);
  assert.equal(swapi.verifyId(1), true);
  assert.equal(swapi.verifyId(0), false);
  assert.equal(swapi.verifyId(1.5), false);
  assert.equal(swapi.verifyId(NaN), false);
});

test("fetches OPERATION/ID and wraps the result", async (t) => {
  const seen = [];
  const baseUrl = await stub(t, (req, res) => {
    seen.push(req.url);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ name: "Luke Skywalker", url: "https://swapi.dev/api/people/1/" }));
  });
  const result = await swapi.polycallSwapi("people", 1, { baseUrl });
  assert.deepEqual(seen, ["/api/people/1/"]);
  assert.equal(result.data.name, "Luke Skywalker");
  assert.deepEqual(result.polycall, { status: "YES", adapter: "swapi-polycall", operation: "people", verified: true });
});

test("rejects bad input before any request; HTTP and shape errors are reported", async (t) => {
  let hits = 0;
  const baseUrl = await stub(t, (req, res) => {
    hits += 1;
    if (req.url.startsWith("/api/people/404/")) { res.statusCode = 404; res.end("{}"); return; }
    if (req.url.startsWith("/api/people/2/")) { res.end("not json"); return; }
    res.end(JSON.stringify({ name: "no url field" }));
  });
  await assert.rejects(swapi.polycallSwapi("droids", 1, { baseUrl }), /invalid operation/);
  await assert.rejects(swapi.polycallSwapi("people", -1, { baseUrl }), /invalid id/);
  assert.equal(hits, 0);
  await assert.rejects(swapi.polycallSwapi("people", 404, { baseUrl }), /HTTP 404/);
  await assert.rejects(swapi.polycallSwapi("people", 2, { baseUrl }), /not JSON/);
  await assert.rejects(swapi.polycallSwapi("people", 3, { baseUrl }), /response verification failed/);
});

test("timeouts are enforced", async (t) => {
  const baseUrl = await stub(t, () => { /* never answers */ });
  await assert.rejects(swapi.polycallSwapi("people", 1, { baseUrl, timeoutMs: 200 }), /timed out after 200 ms/);
});

test("the CLI works from any directory", async (t) => {
  const baseUrl = await stub(t, (req, res) => res.end(JSON.stringify({ name: "Tatooine", url: "x" })));
  const cli = path.join(__dirname, "..", "cli.js");
  const r = await new Promise((resolve) => {
    const { execFile } = require("node:child_process");
    execFile(process.execPath, [cli, "planets", "1"], { cwd: os.tmpdir(), env: { ...process.env, SWAPI_BASE_URL: baseUrl } },
      (error, stdout, stderr) => resolve({ status: error ? error.code : 0, stdout, stderr }));
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).data.name, "Tatooine");
  const usage = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(usage.status, 2);
});

test("live swapi.dev request", { skip: process.env.SWAPI_LIVE === "1" ? false : "network test; set SWAPI_LIVE=1 to run" }, async () => {
  const result = await swapi.polycallSwapi("people", 1, { timeoutMs: 15000 });
  assert.equal(result.data.name, "Luke Skywalker");
});
