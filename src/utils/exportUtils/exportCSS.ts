/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

/* eslint-disable max-len, camelcase */

import customCSS from "!!raw-loader!./exportCustomCSS.css";

const getExportCSS = async (): Promise<string> => {
    const stylesheets: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((e: any) => {
        if (e.href.endsWith("bundle.css") || e.href.endsWith("theme-light.css")) {
            stylesheets.push(e.href);
        }
    });
    let CSS = "";
    for (const stylesheet of stylesheets) {
        const res = await fetch(stylesheet);
        const innerText = await res.text();
        CSS += innerText;
    }
    const fontFaceRegex = /@font-face {.*?}/sg;

    CSS = CSS.replace(fontFaceRegex, '');
    CSS = CSS.replace(
        /font-family: (Inter|'Inter')/g,
        `font-family: -apple-system, BlinkMacSystemFont, avenir next, 
        avenir, segoe ui, helvetica neue, helvetica, Ubuntu, roboto, noto, arial, sans-serif`,
    );
    CSS = CSS.replace(
        /font-family: Inconsolata/g,
        "font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace",
    );

    return CSS + customCSS;
};

export default getExportCSS;
