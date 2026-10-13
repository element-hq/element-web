/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Rendering tests for the notification badges drawn onto a <canvas>: the 16x16
 * Windows taskbar overlay (BadgeOverlayRenderer) and the browser-tab favicon
 * (Favicon).
 *
 * These run in a real browser rather than under happy-dom because the drawing
 * code needs a real 2D context, and `circle()` centres the glyph using the font
 * metrics it measures — `actualBoundingBoxAscent` is 0 under a canvas mock, so
 * the vertical placement would go untested.
 *
 * Scope is deliberately limited to what needs real rasterisation. Favicon's
 * behaviour (link creation, sizing, the draw calls it issues) is covered against
 * a canvas mock in the much cheaper favicon.test.ts.
 */

import { afterEach, beforeEach, describe, expect, inject, it } from "vitest";

import Favicon, { BadgeOverlayRenderer } from "./favicon";
import baseFaviconUrl from "../res/vector-icons/144.png";

// The badges are drawn in the generic `sans-serif`, which is a different typeface
// on each OS, so the committed baselines only match where CI renders: on linux.
// Screenshot assertions therefore only run where rendering is pinned. See
// vitest.browser.config.ts — `pnpm test:unit:screenshots` compares (and
// regenerates) them locally in the same container CI uses.
const canCompareScreenshots = inject("canCompareScreenshots");

// The overlay is only 16x16. Blow it up with nearest-neighbour scaling so a
// screenshot diff is legible; nearest-neighbour keeps the comparison exact
// rather than introducing interpolated edge pixels.
const OVERLAY_SCALE = 8;

let container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
});

afterEach(() => {
    container.remove();
});

function pngUrl(bytes: ArrayBuffer): string {
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
}

async function load(src: string): Promise<HTMLImageElement> {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => reject(new Error("Failed to load rendered badge")), { once: true });
    });
    img.src = src;
    await loaded;
    return img;
}

/** Attach `src` to the page at `scale`x, ready to be screenshotted. */
async function show(src: string, scale: number): Promise<HTMLImageElement> {
    const img = await load(src);
    img.style.imageRendering = "pixelated";
    img.style.display = "block";
    img.width = img.naturalWidth * scale;
    img.height = img.naturalHeight * scale;
    container.appendChild(img);
    return img;
}

async function readPixels(src: string): Promise<ImageData> {
    const img = await load(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(img, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Bounding box of the badge's text, which is drawn in white (`textColor`) on a
 * coloured circle. Returns null if no text pixels were found at all.
 */
function textBounds({ data, width, height }: ImageData): { left: number; right: number } | null {
    let left = width;
    let right = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const isWhite = data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200 && data[i + 3] > 200;
            if (!isWhite) continue;
            if (x < left) left = x;
            if (x > right) right = x;
        }
    }
    return right === -1 ? null : { left, right };
}

describe("BadgeOverlayRenderer", () => {
    // Windows' own notification badges clamp at "99+", and so does the overlay,
    // so 100 and 9999 are expected to render identically to each other.
    const samples: Array<{ name: string; value: number | string; bgColor?: string }> = [
        { name: "1", value: 1 },
        { name: "9", value: 9 },
        { name: "10", value: 10 },
        { name: "99", value: 99 },
        { name: "100-clamped", value: 100 },
        { name: "9999-clamped", value: 9999 },
        { name: "error", value: "×", bgColor: "#f00" },
    ];

    it.runIf(canCompareScreenshots).each(samples)("renders $name", async ({ name, value, bgColor }) => {
        const bytes = await new BadgeOverlayRenderer().render(value, bgColor);
        expect(bytes).not.toBeNull();

        const img = await show(pngUrl(bytes!), OVERLAY_SCALE);
        await expect.element(img).toMatchScreenshot(`overlay-${name}`);
    });

    it("returns null when the count is 0", async () => {
        expect(await new BadgeOverlayRenderer().render(0)).toBeNull();
    });

    it("clamps counts above 99 to a single rendering", async () => {
        const hundred = await new BadgeOverlayRenderer().render(100);
        const lots = await new BadgeOverlayRenderer().render(9999);
        expect(new Uint8Array(lots!)).toEqual(new Uint8Array(hundred!));
    });

    // The regression this guards: the overlay used to reuse the favicon's pill
    // expansion, which shifted the badge left of the canvas for multi-digit
    // counts, so "10" rendered as just "0".
    it.each([10, 99, 100])("keeps the text inside the canvas for %s", async (value) => {
        const pixels = await readPixels(pngUrl((await new BadgeOverlayRenderer().render(value))!));
        const bounds = textBounds(pixels);

        expect(bounds).not.toBeNull();
        // Not touching either edge means nothing has been cropped away.
        expect(bounds!.left).toBeGreaterThan(0);
        expect(bounds!.right).toBeLessThan(pixels.width - 1);
        // ...and a clipped glyph would also sit well off-centre.
        const centre = (bounds!.left + bounds!.right) / 2;
        expect(Math.abs(centre - (pixels.width - 1) / 2)).toBeLessThanOrEqual(1);
    });
});

describe("Favicon", () => {
    function iconLink(): HTMLLinkElement {
        return document.head.querySelector<HTMLLinkElement>("link[rel~='icon' i]")!;
    }

    beforeEach(() => {
        document.head.querySelectorAll("link[rel~='icon' i]").forEach((link) => link.remove());
        const link = document.createElement("link");
        link.setAttribute("rel", "icon");
        link.setAttribute("href", baseFaviconUrl);
        document.head.appendChild(link);
    });

    /** Wait for `badge()` to write the re-rendered icon back to the <link>. */
    async function badgedHref(previous: string | null): Promise<string> {
        await expect.poll(() => iconLink().getAttribute("href")).not.toBe(previous);
        return iconLink().getAttribute("href")!;
    }

    it.runIf(canCompareScreenshots).each([1, 10, 99, 100, 1000])("badges the favicon with %s", async (value) => {
        const favicon = new Favicon();
        favicon.badge(value);

        const href = await badgedHref(baseFaviconUrl);
        expect(href).toMatch(/^data:image\/png;base64,/);

        const img = await show(href, 1);
        await expect.element(img).toMatchScreenshot(`favicon-${value}`);
    });
});
