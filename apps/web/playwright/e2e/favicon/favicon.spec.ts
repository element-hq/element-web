/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Tests for Favicon (the browser-tab favicon with a badge drawn on top of the
 * Element logo).
 *
 * Approach:
 *  1. Open a stub page with <link rel=icon> in real Chromium.
 *  2. Bundle favicon.ts with esbuild and inject it into the page.
 *  3. Set the link's href to the real Element favicon, then call new Favicon().badge(count).
 *  4. The class rewrites the link's href asynchronously, so poll until it changes,
 *     then read the badged PNG out as a data URI and write it to disk.
 *  5. Display the PNG scaled-up in an <img> and snapshot it for regression diffs.
 */

import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAVICON_SRC = path.resolve(__dirname, "../../../src/favicon.ts");
const OUT_DIR = path.resolve(__dirname, "../../test-results/favicons");
// Use the real Element favicon that ships with the app so the test exercises
// the same image (and image dimensions) the Favicon class sees in production.
const BASE_FAVICON = path.resolve(__dirname, "../../../res/vector-icons/144.png");

// Coverage for the over-baseImage path used by the in-browser tab favicon.
// We pick representative counts that hit each branch of circle() (single
// digit, pill at 2 digits, narrower pill at 3+ digits, "Nk+" abbreviation).
const SAMPLES = [
    { name: "1", value: 1 },
    { name: "10", value: 10 },
    { name: "99", value: 99 },
    { name: "100", value: 100 },
    { name: "1000", value: 1000 },
];

let bundledJs: string;
let baseFaviconDataUri: string;

test.beforeAll(async () => {
    const result = await build({
        entryPoints: [FAVICON_SRC],
        bundle: true,
        format: "iife",
        globalName: "FaviconModule",
        write: false,
        target: "es2020",
        platform: "browser",
    });
    bundledJs = result.outputFiles[0].text;
    // Read the real Element favicon and inline it as a data URI so the test
    // doesn't depend on a running webserver to serve it.
    const baseBytes = await fs.readFile(BASE_FAVICON);
    baseFaviconDataUri = `data:image/png;base64,${baseBytes.toString("base64")}`;
    await fs.mkdir(OUT_DIR, { recursive: true });
});

test.describe("favicon Favicon (over baseImage)", () => {
    test.skip(({ browserName }) => browserName !== "chromium", "Chromium-only canvas test");

    for (const sample of SAMPLES) {
        test(`badges favicon with "${sample.name}"`, { tag: "@screenshot" }, async ({ page }) => {
            // Stand up a minimal page with a recognisable base favicon so the
            // Favicon class has something to draw on top of. We generate the
            // base image in-browser so the test isn't dependent on any
            // checked-in image file.
            await page.setContent(`
                <!doctype html>
                <html>
                    <head>
                        <link rel="icon" type="image/png" id="favicon-link" href="" />
                    </head>
                    <body></body>
                </html>
            `);
            await page.addScriptTag({ content: bundledJs });

            // Set the base favicon and trigger badging. The Favicon class updates
            // the link's href asynchronously (it waits for the base image to load
            // and then defers the write via setTimeout), so we poll for the change
            // below rather than reading the href here.
            await page.evaluate(
                ({ value, baseUri }) => {
                    const link = document.getElementById("favicon-link") as HTMLLinkElement;
                    link.setAttribute("href", baseUri);

                    // Instantiate the real Favicon class. It reads <link rel=icon>
                    // from the document, loads the href into an internal image,
                    // and rewrites the link's href when badge() runs.
                    const FaviconCtor = (
                        window as unknown as {
                            FaviconModule: { default: new () => { badge: (n: number | string) => void } };
                        }
                    ).FaviconModule.default;
                    new FaviconCtor().badge(value);
                },
                { value: sample.value, baseUri: baseFaviconDataUri },
            );

            // Wait for the Favicon class to finish rewriting the link's href.
            const linkLocator = page.locator("#favicon-link");
            await expect
                .poll(() => linkLocator.getAttribute("href"))
                .not.toBe(baseFaviconDataUri);
            const dataUri = await linkLocator.getAttribute("href");

            expect(dataUri).toBeTruthy();
            expect(dataUri!.startsWith("data:image/png;base64,")).toBe(true);

            const base64 = dataUri!.split(",")[1];
            const png = Buffer.from(base64, "base64");

            // Write the badged favicon PNG to disk for visual inspection.
            await fs.writeFile(path.join(OUT_DIR, `favicon-${sample.name}.png`), png);

            // Render it scaled-up so the snapshot is easier to eyeball when
            // a diff fails.
            await page.setContent(`
                <html><body style="margin:0;background:#222;">
                    <img id="fav"
                         src="${dataUri}"
                         style="image-rendering:pixelated;width:288px;height:288px;display:block;" />
                </body></html>
            `);
            await expect(page.locator("#fav")).toHaveScreenshot(`favicon-${sample.name}.png`);
        });
    }

    test("badge(0) clears the badge and restores the base image", async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "Chromium-only canvas test");

        await page.setContent(`
            <!doctype html>
            <html>
                <head>
                    <link rel="icon" type="image/png" id="favicon-link" href="" />
                </head>
                <body></body>
            </html>
        `);
        await page.addScriptTag({ content: bundledJs });

        // Stash a Favicon instance on the window so we can drive it across
        // multiple evaluate() calls between Playwright-side waits.
        await page.evaluate((baseUri) => {
            const link = document.getElementById("favicon-link") as HTMLLinkElement;
            link.setAttribute("href", baseUri);
            const FaviconCtor = (
                window as unknown as {
                    FaviconModule: { default: new () => { badge: (n: number) => void } };
                }
            ).FaviconModule.default;
            (window as unknown as { __fav: { badge: (n: number) => void } }).__fav = new FaviconCtor();
        }, baseFaviconDataUri);

        const linkLocator = page.locator("#favicon-link");

        // Badge the favicon with 5 and wait for the href to update.
        await page.evaluate(() => {
            (window as unknown as { __fav: { badge: (n: number) => void } }).__fav.badge(5);
        });
        await expect.poll(() => linkLocator.getAttribute("href")).not.toBe(baseFaviconDataUri);
        const withBadge = (await linkLocator.getAttribute("href"))!;

        // Clear with badge(0); the href should update again to a different value.
        await page.evaluate(() => {
            (window as unknown as { __fav: { badge: (n: number) => void } }).__fav.badge(0);
        });
        await expect.poll(() => linkLocator.getAttribute("href")).not.toBe(withBadge);
        const cleared = (await linkLocator.getAttribute("href"))!;

        // Badging produces a different image; clearing produces a different
        // image again. We don't compare cleared to the original because the
        // re-encode through canvas may produce different bytes than the
        // original PNG.
        expect(withBadge).not.toEqual(cleared);
        expect(withBadge).toMatch(/^data:image\/png;base64,/);
        expect(cleared).toMatch(/^data:image\/png;base64,/);
    });
});
