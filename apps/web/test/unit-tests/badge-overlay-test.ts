/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Unit-test alternative to playwright/e2e/favicon/badge-overlay.spec.ts.
 *
 * Approach:
 *  1. Run under the existing Jest + jsdom setup, transpiled by the same babel
 *     pipeline as production (avoids the esbuild-vs-babel divergence the
 *     Playwright test has).
 *  2. Swap jest-canvas-mock's HTMLCanvasElement stubs for shims backed by
 *     node-canvas so real pixels come out of toBlob().
 *  3. Drive the real BadgeOverlayRenderer and compare the PNG bytes against a
 *     stored baseline via jest-image-snapshot.
 */

import { createCanvas, type Canvas } from "canvas";
import { toMatchImageSnapshot } from "jest-image-snapshot";

import { BadgeOverlayRenderer } from "../../src/favicon";

expect.extend({ toMatchImageSnapshot });

// jest-canvas-mock (configured globally via setupFiles) replaces
// HTMLCanvasElement with stubs that record calls but don't rasterise. For
// pixel-accurate output we re-patch the prototype to delegate to node-canvas.
beforeAll(() => {
    const backing = new WeakMap<HTMLCanvasElement, Canvas>();
    const get = (el: HTMLCanvasElement): Canvas => {
        let c = backing.get(el);
        if (!c) {
            c = createCanvas(1, 1);
            backing.set(el, c);
        }
        return c;
    };

    // Mirror width/height onto the node-canvas. Setting either on a real
    // HTMLCanvasElement resizes and clears it; node-canvas behaves the same
    // when you assign to its width/height.
    Object.defineProperty(HTMLCanvasElement.prototype, "width", {
        configurable: true,
        get(): number {
            return get(this).width;
        },
        set(v: number): void {
            get(this).width = v;
        },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "height", {
        configurable: true,
        get(): number {
            return get(this).height;
        },
        set(v: number): void {
            get(this).height = v;
        },
    });

    HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): any {
        return get(this).getContext(type as "2d");
    };
    HTMLCanvasElement.prototype.toBlob = function (
        this: HTMLCanvasElement,
        cb: BlobCallback,
        type = "image/png",
    ): void {
        const buf = get(this).toBuffer("image/png");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cb(new Blob([buf as any], { type }));
    };
});

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

describe("BadgeOverlayRenderer", () => {
    it.each(SAMPLES)("renders count $name", async ({ value, bgColor }) => {
        const renderer = new BadgeOverlayRenderer();
        const buf = await renderer.render(value, bgColor);
        expect(buf).not.toBeNull();
        expect(Buffer.from(buf!)).toMatchImageSnapshot();
    });

    it("returns null when count is 0", async () => {
        const renderer = new BadgeOverlayRenderer();
        expect(await renderer.render(0)).toBeNull();
    });
});
