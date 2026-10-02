"use strict";

// swapi-polycall: a small Star Wars API (swapi.dev) REST client that checks
// its inputs and the response shape before returning. It does NOT use or
// integrate with the Polycall core; the "polycall" block in its result is
// this package's own verification record.

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG = path.join(__dirname, "swapi-polycall.ini");
const OPERATIONS = new Set(["people", "planets", "starships", "films", "species", "vehicles"]);

/** Parse the package's INI settings file (sections of key=value lines). */
function parseConfig(file = process.env.SWAPI_POLYCALL_CONFIG || DEFAULT_CONFIG) {
  const text = fs.readFileSync(file, "utf8");
  const config = {};
  let section = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1);
      config[section] = config[section] || {};
      continue;
    }
    const [key, ...rest] = line.split("=");
    if (section && key && rest.length) {
      config[section][key.trim()] = rest.join("=").trim();
    }
  }
  return config;
}

function verifyOperation(operation) {
  return OPERATIONS.has(operation);
}

function verifyId(id) {
  return Number.isInteger(id) && id > 0;
}

function normalizeSwapiResult(operation, data) {
  return {
    polycall: {
      status: "YES",
      adapter: "swapi-polycall",
      operation,
      verified: true
    },
    data
  };
}

/**
 * Fetch OPERATION/ID from SWAPI. Options: baseUrl and timeoutMs override
 * the settings file; config selects another settings file.
 */
async function polycallSwapi(operation, id, options = {}) {
  if (!verifyOperation(operation)) {
    throw new Error(`verification failed: invalid operation '${operation}'`);
  }
  if (!verifyId(id)) {
    throw new Error(`verification failed: invalid id '${id}'`);
  }

  const config = parseConfig(options.config);
  const remote = config.remote || {};
  const baseUrl = String(options.baseUrl || process.env.SWAPI_BASE_URL || remote.base_url || "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error("configuration error: remote.base_url must be an http(s) URL");
  }
  const timeoutMs = Number(options.timeoutMs || remote.timeout_ms || 5000);
  const url = `${baseUrl}/${operation}/${id}/`;

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`SWAPI request timed out after ${timeoutMs} ms`);
    }
    throw new Error(`SWAPI request failed: ${error && error.message ? error.message : error}`);
  }
  if (!response.ok) {
    throw new Error(`SWAPI request failed: HTTP ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    throw new Error("response verification failed: body is not JSON");
  }
  if (!data || typeof data !== "object" || !data.url) {
    throw new Error("response verification failed");
  }
  return normalizeSwapiResult(operation, data);
}

module.exports = {
  DEFAULT_CONFIG,
  OPERATIONS,
  parseConfig,
  verifyOperation,
  verifyId,
  polycallSwapi
};
