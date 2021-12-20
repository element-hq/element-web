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

const cssSelectorTextClassesRegex = /\.[\w-]+/g;

function mutateCssText(css: string): string {
    // replace used fonts so that we don't have to bundle Inter & Inconsalata
    return css
        .replace(
            /font-family: ?(Inter|'Inter'|"Inter")/g,
            `font-family: -apple-system, BlinkMacSystemFont, avenir next,
            avenir, segoe ui, helvetica neue, helvetica, Ubuntu, roboto, noto, arial, sans-serif`,
        )
        .replace(
            /font-family: ?Inconsolata/g,
            "font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace",
        );
}

// naively culls unused css rules based on which classes are present in the html,
// doesn't cull rules which won't apply due to the full selector not matching but gets rid of a LOT of cruft anyway.
const getExportCSS = async (usedClasses: Set<string>): Promise<string> => {
    // only include bundle.css and the data-mx-theme=light styling
    const stylesheets = Array.from(document.styleSheets).filter(s => {
        return s.href?.endsWith("bundle.css") ||
            (s.ownerNode as HTMLStyleElement).dataset.mxTheme.toLowerCase() === "light";
    });

    let css = "";
    for (const stylesheet of stylesheets) {
        for (const rule of stylesheet.cssRules) {
            if (rule instanceof CSSFontFaceRule) continue; // we don't want to bundle any fonts

            const selectorText = (rule as CSSStyleRule).selectorText;

            // only skip the rule if all branches (,) of the selector are redundant
            if (selectorText?.split(",").every(selector => {
                const classes = selector.match(cssSelectorTextClassesRegex);
                if (classes && !classes.every(c => usedClasses.has(c.substring(1)))) {
                    return true; // signal as a redundant selector
                }
            })) {
                continue; // skip this rule as it is redundant
            }

            css += mutateCssText(rule.cssText) + "\n";
        }
    }

    return css + customCSS;
};

export default getExportCSS;
