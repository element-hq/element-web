/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/*
 * Based on...
 * ChromaCheck 1.16
 * author Roel Nieskens, https://pixelambacht.nl
 * MIT license
 */
import { logger } from "matrix-js-sdk/src/logger";

function safariVersionCheck(ua: string): boolean {
    logger.log("Browser is Safari - checking version for COLR support");
    try {
        const safariVersionMatch = ua.match(/Mac OS X ([\d|_]+).*Version\/([\d|.]+).*Safari/);
        if (safariVersionMatch) {
            const macOSVersionStr = safariVersionMatch[1];
            const safariVersionStr = safariVersionMatch[2];
            const macOSVersion = macOSVersionStr.split("_").map((n) => parseInt(n, 10));
            const safariVersion = safariVersionStr.split(".").map((n) => parseInt(n, 10));
            const colrFontSupported = macOSVersion[0] >= 10 && macOSVersion[1] >= 14 && safariVersion[0] >= 12;
            // https://www.colorfonts.wtf/ states safari supports COLR fonts from this version on
            logger.log(
                `COLR support on Safari requires macOS 10.14 and Safari 12, ` +
                    `detected Safari ${safariVersionStr} on macOS ${macOSVersionStr}, ` +
                    `COLR supported: ${colrFontSupported}`,
            );
            return colrFontSupported;
        }
    } catch (err) {
        logger.error("Error in Safari COLR version check", err);
    }
    logger.warn("Couldn't determine Safari version to check COLR font support, assuming no.");
    return false;
}

async function isColrFontSupported(): Promise<boolean> {
    logger.log("Checking for COLR support");

    const { userAgent } = navigator;
    // Firefox has supported COLR fonts since version 26
    // but doesn't support the check below without
    // "Extract canvas data" permissions
    // when content blocking is enabled.
    if (userAgent.includes("Firefox")) {
        logger.log("Browser is Firefox - assuming COLR is supported");
        return true;
    }
    // Safari doesn't wait for the font to load (if it doesn't have it in cache)
    // to emit the load event on the image, so there is no way to not make the check
    // reliable. Instead sniff the version.
    // Excluding "Chrome", as it's user agent unhelpfully also contains Safari...
    if (!userAgent.includes("Chrome") && userAgent.includes("Safari")) {
        return safariVersionCheck(userAgent);
    }

    try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        const img = new Image();
        // eslint-disable-next-line
        const fontCOLR =
            "d09GRgABAAAAAAKAAAwAAAAAAowAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABDT0xSAAACVAAAABYAAAAYAAIAJUNQQUwAAAJsAAAAEgAAABLJAAAQT1MvMgAAAYAAAAA6AAAAYBfxJ0pjbWFwAAABxAAAACcAAAAsAAzpM2dseWYAAAH0AAAAGgAAABoNIh0kaGVhZAAAARwAAAAvAAAANgxLumdoaGVhAAABTAAAABUAAAAkCAEEAmhtdHgAAAG8AAAABgAAAAYEAAAAbG9jYQAAAewAAAAGAAAABgANAABtYXhwAAABZAAAABsAAAAgAg4AHW5hbWUAAAIQAAAAOAAAAD4C5wsecG9zdAAAAkgAAAAMAAAAIAADAAB4AWNgZGAAYQ5+qdB4fpuvDNIsDCBwaQGTAIi+VlscBaJZGMDiHAxMIAoAtjIF/QB4AWNgZGBgYQACOAkUQQWMAAGRABAAAAB4AWNgZGBgYGJgAdMMUJILJMQgAWICAAH3AC4AeAFjYGFhYJzAwMrAwDST6QwDA0M/hGZ8zWDMyMmAChgFkDgKQMBw4CXDSwYWEBdIYgAFBgYA/8sIdAAABAAAAAAAAAB4AWNgYGBkYAZiBgYeBhYGBSDNAoRA/kuG//8hpDgjWJ4BAFVMBiYAAAAAAAANAAAAAQAAAAAEAAQAAAMAABEhESEEAPwABAD8AAAAeAEtxgUNgAAAAMHHIQTShTlOAty9/4bf7AARCwlBNhBw4L/43qXjYGUmf19TMuLcj/BJL3XfBg54AWNgZsALAAB9AAR4AWNgYGAEYj4gFgGygGwICQACOwAoAAAAAAABAAEAAQAAAA4AAAAAyP8AAA==";
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="100" style="background:#fff;fill:#000;">
            <style type="text/css">
                @font-face {
                    font-family: "chromacheck-colr";
                    src: url(data:application/x-font-woff;base64,${fontCOLR}) format("woff");
                }
            </style>
            <text x="0" y="0" font-size="20">
                <tspan font-family="chromacheck-colr" x="0" dy="20">&#xe900;</tspan>
            </text>
        </svg>`;
        canvas.width = 20;
        canvas.height = 100;

        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

        logger.log("Waiting for COLR SVG to load");
        await new Promise((resolve) => (img.onload = resolve));
        logger.log("Drawing canvas to detect COLR support");
        context.drawImage(img, 0, 0);
        const colrFontSupported = context.getImageData(10, 10, 1, 1).data[0] === 200;
        logger.log("Canvas check revealed COLR is supported? " + colrFontSupported);
        return colrFontSupported;
    } catch (e) {
        logger.error("Couldn't load COLR font", e);
        return false;
    }
}

let colrFontCheckStarted = false;
export async function fixupColorFonts(): Promise<void> {
    if (colrFontCheckStarted) {
        return;
    }
    colrFontCheckStarted = true;

    if (await isColrFontSupported()) {
        const path = `url('${require("../../res/fonts/Twemoji_Mozilla/TwemojiMozilla-colr.woff2")}')`;
        document.fonts.add(new FontFace("Twemoji", path, {}));
        // For at least Chrome on Windows 10, we have to explictly add extra
        // weights for the emoji to appear in bold messages, etc.
        document.fonts.add(new FontFace("Twemoji", path, { weight: "600" }));
        document.fonts.add(new FontFace("Twemoji", path, { weight: "700" }));
    } else {
        // fall back to SBIX, generated via https://github.com/matrix-org/twemoji-colr/tree/matthew/sbix
        const path = `url('${require("../../res/fonts/Twemoji_Mozilla/TwemojiMozilla-sbix.woff2")}')`;
        document.fonts.add(new FontFace("Twemoji", path, {}));
        document.fonts.add(new FontFace("Twemoji", path, { weight: "600" }));
        document.fonts.add(new FontFace("Twemoji", path, { weight: "700" }));
    }
    // ...and if SBIX is not supported, the browser will fall back to one of the native fonts specified.
}
