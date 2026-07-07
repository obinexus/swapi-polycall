const fs = require("fs");

function parsePolycallrc(path = "polycallrc") {
  const text = fs.readFileSync(path, "utf8");
  const config = {};
  let section = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1);
      config[section] = {};
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
  const allowed = new Set([
    "people",
    "planets",
    "starships",
    "films",
    "species",
    "vehicles",
  ]);

  return allowed.has(operation);
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
      verified: true,
    },
    data,
  };
}

async function polycallSwapi(operation, id) {
  const config = parsePolycallrc();

  if (!verifyOperation(operation)) {
    throw new Error(`PolyCall verification failed: invalid operation '${operation}'`);
  }

  if (!verifyId(id)) {
    throw new Error(`PolyCall verification failed: invalid id '${id}'`);
  }

  const baseUrl = config.remote.base_url.replace(/\/$/, "");
  const url = `${baseUrl}/${operation}/${id}/`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`SWAPI request failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data || typeof data !== "object" || !data.url) {
    throw new Error("PolyCall response verification failed");
  }

  return normalizeSwapiResult(operation, data);
}

module.exports = {
  polycallSwapi,
};