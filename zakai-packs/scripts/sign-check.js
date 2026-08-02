#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");

let changedFiles = [];
try {
  changedFiles = execSync("git diff --name-only HEAD~1", { encoding: "utf8" })
    .split("\n")
    .filter((f) => f.startsWith("packs/") && f.endsWith(".json"));
} catch {
  console.log("No parent commit — skipping sign-check (initial import).");
  process.exit(0);
}

if (changedFiles.length === 0) {
  console.log("No pack files changed.");
  process.exit(0);
}

const registry = JSON.parse(fs.readFileSync("maintainers/_registry.json", "utf8"));

for (const file of changedFiles) {
  const parts = file.split("/");
  const market = parts[1];
  const indexPath = `packs/${market}/index.json`;
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ Missing ${indexPath}`);
    process.exit(1);
  }
  const packIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const maintainerEmail = packIndex.maintainer;

  if (!registry.maintainers[maintainerEmail]) {
    console.error(`❌ Maintainer ${maintainerEmail} not registered for ${market}`);
    process.exit(1);
  }

  console.log(`✅ ${file} — maintainer ${maintainerEmail}`);
}
