/**
 * Sync zakai-packs IL rights display_name.he (and en title) from next-intl rights.items.
 * Run: node scripts/sync-zml-hebrew-from-rights.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const he = JSON.parse(readFileSync(join(root, "src/messages/he.json"), "utf8"));
const en = JSON.parse(readFileSync(join(root, "src/messages/en.json"), "utf8"));
const heItems = he.rights?.items ?? {};
const enItems = en.rights?.items ?? {};

const dir = join(root, "zakai-packs/packs/il/rights");
let updated = 0;
let missing = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const path = join(dir, file);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const id = doc.id;
  if (!id?.startsWith("il_")) continue;
  const key = id.slice(3);
  const heTitle = heItems[key]?.title;
  const enTitle = enItems[key]?.title;
  if (!heTitle) {
    missing.push(id);
    continue;
  }
  const beforeHe = doc.display_name?.he;
  const beforeEn = doc.display_name?.en;
  doc.display_name = {
    ...doc.display_name,
    en: enTitle ?? beforeEn ?? key.replace(/_/g, " "),
    he: heTitle,
  };
  if (beforeHe !== doc.display_name.he || beforeEn !== doc.display_name.en) {
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    updated++;
  }
}

console.log(`Updated ${updated} IL rights JSON files.`);
if (missing.length) {
  console.warn(`No rights.items title for ${missing.length} ids (first 10):`, missing.slice(0, 10));
}
