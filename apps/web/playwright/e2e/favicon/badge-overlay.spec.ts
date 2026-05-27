/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Tests for BadgeOverlayRenderer (the 16x16 PNG used as the Windows taskbar overlay).
 *
 * Approach:
 *  1. Open about:blank in real Chromium (canvas needs a real browser).
 *  2. Bundle favicon.ts with esbuild and inject it into the page.
 *  3. Call renderer.render(count) inside the page via page.evaluate.
 *  4. Get the PNG bytes back to Node and write them to disk for inspection.
 *  5. Display the PNG scaled-up in an <img> and snapshot it for regression diffs.
 */

import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAVICON_SRC = path.resolve(__dirname, "../../../src/favicon.ts");
const OUT_DIR = path.resolve(__dirname, "../../test-results/favicon-badges");

// Counts that exercise each branch of the multi-digit logic in BadgeOverlayRenderer.
// All cases render as a circle (the overlay is always 16x16), but the font scale
// changes with digit count to keep the text legible.
// - single digit
// - two digits
// - three digits
// - 1000+ falls back to the built-in "Nk+" abbreviation
// - a non-numeric symbol (used for the error overlay)
const SAMPLES: Array<{ name: string; value: number | string; bgColor?: string }> = [
    { name: "1", value: 1 },
    { name: "9", value: 9 },
    { name: "10", value: 10 },
    { name: "12", value: 12 },
    { name: "99", value: 99 },
    { name: "100", value: 100 },
    { name: "999", value: 999 },
    { name: "1000", value: 1000 },
    { name: "error", value: "×", bgColor: "#f00" },
];

let bundledJs: string;

test.beforeAll(async () => {
    // Bundle favicon.ts into an IIFE so we can inject it into about:blank without
    // depending on the webapp dev server having the source available.
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
    await fs.mkdir(OUT_DIR, { recursive: true });
});

test.describe("favicon BadgeOverlayRenderer", () => {
    // The overlay PNG is consumed by Electron (Chromium) on Windows. Rendering
    // it under Firefox/WebKit would just produce slightly different output for
    // no benefit, so skip those projects.
    test.skip(({ browserName }) => browserName !== "chromium", "Chromium-only canvas test");

    for (const sample of SAMPLES) {
        test(`renders count "${sample.name}"`, { tag: "@screenshot" }, async ({ page }) => {
            await page.goto("about:blank");
            await page.addScriptTag({ content: bundledJs });

            // Run the real BadgeOverlayRenderer inside a real Chromium canvas
            // and return the PNG bytes as base64 so we can write them to disk.
            const base64 = await page.evaluate(
                async ({ value, bgColor }) => {
                    const renderer = new (
                        window as unknown as {
                            FaviconModule: {
                                BadgeOverlayRenderer: new () => {
                                    render: (v: number | string, c?: string) => Promise<ArrayBuffer | null>;
                                };
                            };
                        }
                    ).FaviconModule.BadgeOverlayRenderer();
                    const buf = await renderer.render(value, bgColor);
                    if (!buf) return null;
                    const bytes = new Uint8Array(buf);
                    let binary = "";
                    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                    return btoa(binary);
                },
                { value: sample.value, bgColor: sample.bgColor },
            );

            expect(base64, "renderer should produce a PNG for non-zero counts").not.toBeNull();

            const png = Buffer.from(base64!, "base64");

            // Write the PNG to disk for visual inspection. Output lives under
            // playwright/test-results/favicon-badges/ so it survives a normal
            // test run and can be opened directly.
            await fs.writeFile(path.join(OUT_DIR, `badge-${sample.name}.png`), png);

            // Render the badge into a fixed-size <img> we can screenshot,
            // letting us catch visual regressions via Playwright's snapshot
            // diffing. The img is scaled up so small pixel differences are
            // easier to eyeball when a snapshot fails.
            await page.setContent(`
                <html><body style="margin:0;background:#222;">
                    <img id="badge"
                         src="data:image/png;base64,${base64}"
                         style="image-rendering:pixelated;width:128px;height:128px;display:block;" />
                </body></html>
            `);
            await expect(page.locator("#badge")).toHaveScreenshot(`badge-${sample.name}.png`);
        });
    }

    test("renders nothing when count is 0", async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "Chromium-only canvas test");
        await page.goto("about:blank");
        await page.addScriptTag({ content: bundledJs });

        const buf = await page.evaluate(async () => {
            const renderer = new (
                window as unknown as {
                    FaviconModule: {
                        BadgeOverlayRenderer: new () => { render: (v: number) => Promise<ArrayBuffer | null> };
                    };
                }
            ).FaviconModule.BadgeOverlayRenderer();
            return await renderer.render(0);
        });

        expect(buf).toBeNull();
    });
});
