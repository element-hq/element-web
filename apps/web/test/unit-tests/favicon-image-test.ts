/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Tests for the Favicon class (browser-tab favicon with a badge drawn over
 * the Element logo).
 *
 * Approach:
 *  1. Swap jest-canvas-mock's HTMLCanvasElement stubs for shims backed by
 *     node-canvas so real pixels come out.
 *  2. Pre-load the real Element favicon (apps/web/res/vector-icons/144.png)
 *     as a node-canvas Image, then have document.createElement("img") return
 *     it so Favicon's internal baseImage is already populated.
 *  3. Drive the real Favicon class, run timers, then read the badged PNG out
 *     of the <link rel=icon>'s href and compare via jest-image-snapshot.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createCanvas, loadImage, type Canvas, type Image } from "canvas";
import { toMatchImageSnapshot } from "jest-image-snapshot";

import Favicon from "../../src/favicon";

expect.extend({ toMatchImageSnapshot });
jest.useFakeTimers();

const BASE_FAVICON = path.resolve(__dirname, "../../res/vector-icons/144.png");
let baseImage: Image;

beforeAll(async () => {
    baseImage = await loadImage(await fs.readFile(BASE_FAVICON));

    // Replace jest-canvas-mock's HTMLCanvasElement stubs with shims backed by
    // node-canvas so toDataURL produces real PNG bytes.
    const backing = new WeakMap<HTMLCanvasElement, Canvas>();
    const get = (el: HTMLCanvasElement): Canvas => {
        let c = backing.get(el);
        if (!c) {
            c = createCanvas(1, 1);
            backing.set(el, c);
        }
        return c;
    };

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
    HTMLCanvasElement.prototype.toDataURL = function (this: HTMLCanvasElement, type = "image/png"): string {
        return "data:" + type + ";base64," + get(this).toBuffer("image/png").toString("base64");
    };
});

beforeEach(() => {
    // Reset the document <head> between tests so each starts from a clean slate.
    document.getElementsByTagName("head")[0]?.remove();
    const head = document.createElement("head");
    document.documentElement.prepend(head);

    // Add a <link rel=icon> for Favicon to discover.
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = "favicon.png";
    document.head.appendChild(link);

    // Intercept Favicon's internal document.createElement("img") and return
    // the pre-loaded node-canvas Image so its bytes are ready for drawImage.
    // We add the jsdom-flavoured shims (setAttribute, onload trigger) that
    // Favicon relies on.
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag !== "img") return originalCreateElement(tag);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const img = baseImage as any;
        img.setAttribute = (name: string, _value: string): void => {
            if (name === "src" && typeof img.onload === "function") {
                // src is already loaded; fire the next-tick onload Favicon expects.
                queueMicrotask(() => img.onload?.());
            }
        };
        return img;
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

const SAMPLES = [
    { name: "1", value: 1 },
    { name: "10", value: 10 },
    { name: "99", value: 99 },
    { name: "100", value: 100 },
    { name: "1000", value: 1000 },
];

const linkHref = (): string => document.querySelector("link[rel='icon']")!.getAttribute("href")!;

describe("Favicon (over base image)", () => {
    it.each(SAMPLES)("badges favicon with $name", async ({ value }) => {
        const fav = new Favicon();
        fav.badge(value);
        await jest.runAllTimersAsync();

        const href = linkHref();
        expect(href).toMatch(/^data:image\/png;base64,/);
        const png = Buffer.from(href.split(",")[1], "base64");
        expect(png).toMatchImageSnapshot();
    });

    it("badge(0) clears the badge and rewrites the link", async () => {
        const fav = new Favicon();
        fav.badge(5);
        await jest.runAllTimersAsync();
        const withBadge = linkHref();

        fav.badge(0);
        await jest.runAllTimersAsync();
        const cleared = linkHref();

        expect(withBadge).not.toEqual(cleared);
    });
});
