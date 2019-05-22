/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

let colrFontSupported = undefined;

async function isColrFontSupported() {
    if (colrFontSupported !== undefined) {
        return colrFontSupported;
    }

    // Firefox has supported COLR fonts since version 26
    // but doesn't support the check below with content blocking enabled.
    if (navigator.userAgent.includes("Firefox")) {
        colrFontSupported = true;
        return colrFontSupported;
    }

    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const img = new Image();
        // eslint-disable-next-line
        const fontCOLR = 'd09GRgABAAAAAAKAAAwAAAAAAowAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABDT0xSAAACVAAAABYAAAAYAAIAJUNQQUwAAAJsAAAAEgAAABLJAAAQT1MvMgAAAYAAAAA6AAAAYBfxJ0pjbWFwAAABxAAAACcAAAAsAAzpM2dseWYAAAH0AAAAGgAAABoNIh0kaGVhZAAAARwAAAAvAAAANgxLumdoaGVhAAABTAAAABUAAAAkCAEEAmhtdHgAAAG8AAAABgAAAAYEAAAAbG9jYQAAAewAAAAGAAAABgANAABtYXhwAAABZAAAABsAAAAgAg4AHW5hbWUAAAIQAAAAOAAAAD4C5wsecG9zdAAAAkgAAAAMAAAAIAADAAB4AWNgZGAAYQ5+qdB4fpuvDNIsDCBwaQGTAIi+VlscBaJZGMDiHAxMIAoAtjIF/QB4AWNgZGBgYQACOAkUQQWMAAGRABAAAAB4AWNgZGBgYGJgAdMMUJILJMQgAWICAAH3AC4AeAFjYGFhYJzAwMrAwDST6QwDA0M/hGZ8zWDMyMmAChgFkDgKQMBw4CXDSwYWEBdIYgAFBgYA/8sIdAAABAAAAAAAAAB4AWNgYGBkYAZiBgYeBhYGBSDNAoRA/kuG//8hpDgjWJ4BAFVMBiYAAAAAAAANAAAAAQAAAAAEAAQAAAMAABEhESEEAPwABAD8AAAAeAEtxgUNgAAAAMHHIQTShTlOAty9/4bf7AARCwlBNhBw4L/43qXjYGUmf19TMuLcj/BJL3XfBg54AWNgZsALAAB9AAR4AWNgYGAEYj4gFgGygGwICQACOwAoAAAAAAABAAEAAQAAAA4AAAAAyP8AAA==';
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

        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

        // FIXME wait for safari load our colr font
        const wait = ms => new Promise((r, j)=>setTimeout(r, ms));
        await wait(500);

        context.drawImage(img, 0, 0);
        colrFontSupported = (context.getImageData(10, 10, 1, 1).data[0] === 200);
    } catch (e) {
        console.error("Couldn't load colr font", e);
        colrFontSupported = false;
    }
    return colrFontSupported;
}

export async function fixupColorFonts() {
    if (colrFontSupported !== undefined) {
        return;
    }

    if (await isColrFontSupported()) {
        const font = new FontFace("Twemoji",
            `url('${require("../../res/fonts/Twemoji_Mozilla/TwemojiMozilla-colr.woff2")}')`, {});
        document.fonts.add(font);
    }
    // if not supported, the browser will fall back to one of the native fonts specified.
}

