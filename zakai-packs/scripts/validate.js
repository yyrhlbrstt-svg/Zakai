#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync("schema/zakai-rights-schema.json", "utf8"));
delete schema.$schema;
const validateRight = ajv.compile(schema);

let exitCode = 0;

function validateRightFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const valid = validateRight(data);
  if (!valid) {
    console.error(`❌ ${filePath}:`);
    validateRight.errors.forEach((err) =>
      console.error(`   ${err.instancePath}: ${err.message}`),
    );
    exitCode = 1;
  } else {
    console.log(`✅ ${filePath}`);
  }
}

function validateManifest(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const required = ["pack_version", "market", "maintainer", "rights", "engine_requirements"];
  for (const k of required) {
    if (!(k in data)) {
      console.error(`❌ ${filePath}: missing ${k}`);
      exitCode = 1;
      return;
    }
  }
  if (!Array.isArray(data.rights) || data.rights.length === 0) {
    console.error(`❌ ${filePath}: rights must be non-empty array`);
    exitCode = 1;
    return;
  }
  const rightsDir = path.join(path.dirname(filePath), "rights");
  for (const id of data.rights) {
    const rf = path.join(rightsDir, `${id}.json`);
    if (!fs.existsSync(rf)) {
      console.error(`❌ ${filePath}: missing rights file ${id}.json`);
      exitCode = 1;
    }
  }
  console.log(`✅ ${filePath} (manifest)`);
}

const packsDir = "packs";
for (const market of fs.readdirSync(packsDir)) {
  if (market.startsWith("_")) continue;
  const marketDir = path.join(packsDir, market);
  const rightsDir = path.join(marketDir, "rights");
  if (!fs.existsSync(rightsDir)) continue;

  for (const file of fs.readdirSync(rightsDir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    validateRightFile(path.join(rightsDir, file));
  }

  const indexPath = path.join(marketDir, "index.json");
  if (fs.existsSync(indexPath)) validateManifest(indexPath);
}

process.exit(exitCode);
