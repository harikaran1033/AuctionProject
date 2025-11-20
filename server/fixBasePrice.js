// fixBasePrice.js (ESM)
// Usage:
//   node fixBasePrice.js data/iplPlayers.js
//   node fixBasePrice.js "data/*.js"

import fs from "fs/promises";
import path from "path";
import { glob } from "glob";

async function fixFile(file) {
  const content = await fs.readFile(file, "utf8");

  const updated = content
    // Match "Base_Price":
    .replace(/"Base_Price"\s*:/g, '"BASE_PRICE":')
    // Match Base_Price:
    .replace(/\bBase_Price\s*:/g, "BASE_PRICE:");

  if (updated !== content) {
    await fs.writeFile(file, updated, "utf8");
    console.log(`✅ Updated: ${file}`);
  } else {
    console.log(`ℹ️ No change needed: ${file}`);
  }
}

async function run() {
  const pattern = process.argv[2];

  if (!pattern) {
    console.error("Usage: node fixBasePrice.js <file-or-glob>");
    process.exit(1);
  }

  const files = await glob(pattern);
  if (files.length === 0) {
    console.error("❌ No matching files:", pattern);
    process.exit(1);
  }

  for (const file of files) {
    await fixFile(file);
  }
}

run();
