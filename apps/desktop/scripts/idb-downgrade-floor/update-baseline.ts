#!/usr/bin/env node
/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Regenerates idb-format-baseline.json for the current Electron, and says plainly whether doing so
 * introduces an IndexedDB downgrade floor.
 *
 *   pnpm idb:baseline            update the baseline
 *   pnpm idb:baseline -- --check report without writing (exit 1 if a floor would be introduced)
 *
 * Deliberately depends on nothing outside Node's standard library, so the scheduled workflow can run
 * it straight from a checkout without installing the workspace.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import desktopPackage from "../../package.json" with { type: "json" };
import {
    type Baseline,
    fetchFormatVersions,
    increasedVersions,
    resolveChromiumVersion,
    toFormatVersions,
} from "./format-versions.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(__dirname, "idb-format-baseline.json");

const checkOnly = process.argv.includes("--check");

const baseline = JSON.parse(await fs.readFile(BASELINE_PATH, "utf8")) as Baseline;
const electron = desktopPackage.devDependencies.electron;

console.log(
    `Electron:  ${electron}${electron === baseline.electron ? "" : `  (baseline recorded ${baseline.electron})`}`,
);

const chromium = await resolveChromiumVersion(electron);
const current = await fetchFormatVersions(chromium);
console.log(`Chromium:  ${chromium}`);
for (const [key, value] of Object.entries(current)) {
    const was = baseline[key as keyof typeof current];
    console.log(`  ${key.padEnd(24)} ${value}${was !== value ? `  (was ${was})` : ""}`);
}

const increased = increasedVersions(toFormatVersions(baseline), current);

console.log("");
if (increased.length) {
    console.log(`DOWNGRADE FLOOR INTRODUCED: ${increased.join(", ")} increased.`);
    console.log(`Users who take this build cannot roll back past it without losing their IndexedDB`);
    console.log(`store for vector://vector, which includes the crypto store. Call this out in the`);
    console.log(`release notes: it sets the oldest version support can ask someone to downgrade to.`);
} else {
    console.log("No downgrade floor introduced: all format versions unchanged.");
}

if (checkOnly) {
    process.exit(increased.length ? 1 : 0);
}

const updated: Baseline = {
    ...baseline,
    ...current,
    electron,
    // Crossing a format boundary starts a new era, so the old floor no longer applies.
    currentFloor: increased.length
        ? {
              $comment: baseline.currentFloor?.$comment,
              elementDesktop: "UNRELEASED - set to the first release shipping this Electron",
              since: `Electron ${electron} / Chromium ${chromium} raised ${increased.join(" and ")}`,
          }
        : baseline.currentFloor,
};

await fs.writeFile(BASELINE_PATH, `${JSON.stringify(updated, null, 4)}\n`);
console.log(`\nWrote ${path.relative(process.cwd(), BASELINE_PATH)}`);
if (increased.length) {
    console.log("Remember to fill in currentFloor.elementDesktop once the release version is known.");
}
