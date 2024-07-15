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

import type { Rule, StyleSheet } from "css-tree";

import customCSS from "!!raw-loader!./exportCustomCSS.css";

const cssSelectorTextClassesRegex = /\.[\w-]+/g;

function mutateCssText(css: string): string {
    // replace used fonts so that we don't have to bundle Inter & Inconsalata
    const sansFont = `-apple-system, BlinkMacSystemFont, avenir next,
            avenir, segoe ui, helvetica neue, helvetica, Ubuntu, roboto, noto, arial, sans-serif`;
    return css
        .replace(/font-family: ?(Inter|'Inter'|"Inter")/g, `font-family: ${sansFont}`)
        .replace(/--cpd-font-family-sans: ?(Inter|'Inter'|"Inter")/g, `--cpd-font-family-sans: ${sansFont}`)
        .replace(
            /font-family: ?Inconsolata/g,
            "font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace",
        );
}

function includeRule(rule: Rule, usedClasses: Set<string>): boolean {
    if (rule.prelude.type === "Raw") {
        // cull empty rules
        if (rule.block.children.isEmpty) return false;

        return rule.prelude.value.split(",").some((subselector) => {
            const classes = subselector.trim().match(cssSelectorTextClassesRegex);
            if (classes && !classes.every((c) => usedClasses.has(c.substring(1)))) {
                return false;
            }
            return true;
        });
    }
    return true;
}

// naively culls unused css rules based on which classes are present in the html,
// doesn't cull rules which won't apply due to the full selector not matching but gets rid of a LOT of cruft anyway.
// We cannot use document.styleSheets as it does not handle variables in shorthand properties sanely,
// see https://github.com/element-hq/element-web/issues/26761
const getExportCSS = async (usedClasses: Set<string>): Promise<string> => {
    const csstree = await import("css-tree");

    // only include bundle.css and light theme styling
    const hrefs = ["bundle.css", "theme-light.css"].map((name) => {
        return document.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href$="${name}"]`)?.href;
    });

    let css = "";

    for (const href of hrefs) {
        if (!href) continue;
        const res = await fetch(href);
        const text = await res.text();

        const ast = csstree.parse(text, {
            context: "stylesheet",
            parseAtrulePrelude: false,
            parseRulePrelude: false,
            parseValue: false,
            parseCustomProperty: false,
        }) as StyleSheet;

        for (const rule of ast.children) {
            if (rule.type === "Atrule") {
                if (rule.name === "font-face") {
                    continue;
                }
            }

            if (rule.type === "Rule" && !includeRule(rule, usedClasses)) {
                continue;
            }

            css += mutateCssText(csstree.generate(rule));
        }
    }

    return css + customCSS;
};

export default getExportCSS;
