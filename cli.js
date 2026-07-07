#!/usr/bin/env node

const { polycallSwapi } = require("./index");

async function main() {
  const operation = process.argv[2];
  const id = Number(process.argv[3]);

  if (!operation || !id) {
    console.error("Usage: node cli.js <people|planets|starships|films|species|vehicles> <id>");
    process.exit(1);
  }

  try {
    const result = await polycallSwapi(operation, id);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();