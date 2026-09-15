/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Guards against an Electron bump silently introducing an IndexedDB *downgrade floor*.
 *
 * Chromium destroys an IndexedDB store whose recorded format numbers are newer than the running
 * build knows. Those numbers are compile-time constants fixed by the Electron pin, so raising
 * Electron can make it impossible for users to roll back past the new release without losing every
 * Element database for the origin, crypto store included.
 *
 * Resolving the numbers needs the network, so this only runs when the Electron major has moved away
 * from the one the baseline was recorded against: see `electronMajor`. The scheduled
 * `idb-downgrade-floor.yml` workflow re-checks unconditionally, so a mid-branch surprise upstream
 * still surfaces without every pull request paying for it.
 */

import { describe, expect, it } from "vitest";

import baseline from "./idb-format-baseline.json" with { type: "json" };
import desktopPackage from "../../package.json" with { type: "json" };
import {
    electronMajor,
    fetchFormatVersions,
    type FormatVersions,
    increasedVersions,
    resolveChromiumVersion,
    toFormatVersions,
} from "./format-versions.ts";

/** Resolving through two upstream repositories is not instant; give it room without hanging CI. */
const NETWORK_TIMEOUT_MS = 120_000;

const currentElectron = desktopPackage.devDependencies.electron;
const baselineVersions = toFormatVersions(baseline);

function explainFloor(chromium: string, current: FormatVersions, increased: Array<keyof FormatVersions>): string {
    return [
        ``,
        `Bumping Electron to ${currentElectron} (Chromium to ${chromium})`,
        `raises ${increased.join(" and ")}, which introduces an IndexedDB DOWNGRADE FLOOR.`,
        ``,
        ...increased.map((key) => `  ${key}: ${baselineVersions[key]} -> ${current[key]}`),
        ``,
        `Every user who takes this build will be unable to roll back to any earlier release:`,
        `Chromium will discard the whole vector://vector IndexedDB store, logging them out and`,
        `destroying the crypto store. Recovery needs their key backup.`,
        ``,
        `If that is understood and intended, record it with:  pnpm idb:baseline`,
        `and call it out in the release notes, since it constrains rollback for support.`,
        ``,
    ].join("\n");
}

/** Resolves the current Electron's format numbers and reports which ones grew past the baseline. */
async function resolveIncreases(): Promise<{
    chromium: string;
    current: FormatVersions;
    increased: Array<keyof FormatVersions>;
}> {
    const chromium = await resolveChromiumVersion(currentElectron);
    const current = await fetchFormatVersions(chromium);
    return { chromium, current, increased: increasedVersions(baselineVersions, current) };
}

describe("IndexedDB downgrade floor", () => {
    it("compares two Electron versions that are exact pins", () => {
        // Offline guard on the skip below. If either version stopped being an exact pin — a range
        // such as "^44.0.0", or a typo — the majors would never match and the real check would
        // either never run or run on every pull request.
        expect(currentElectron).toMatch(/^\d+\.\d+\.\d+/);
        expect(baseline.electron).toMatch(/^\d+\.\d+\.\d+/);
    });

    it(
        "is not introduced by the current Electron version",
        async (ctx) => {
            ctx.skip(
                electronMajor(currentElectron) === electronMajor(baseline.electron),
                `Electron major unchanged since the baseline was recorded against ${baseline.electron}; ` +
                    `the format numbers are fixed when Chromium cuts the release branch.`,
            );
            const { chromium, current, increased } = await resolveIncreases();
            // Asserted as text so the failure prints the written explanation rather than an array
            // diff: whoever hits this needs to understand the decision, not see which key changed.
            const floor = increased.length > 0 ? explainFloor(chromium, current, increased) : "";
            expect(floor).toBe("");
        },
        NETWORK_TIMEOUT_MS,
    );
});
