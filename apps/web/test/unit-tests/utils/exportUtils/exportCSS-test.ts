/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/jest";

import getExportCSS from "../../../../src/utils/exportUtils/exportCSS";

describe("exportCSS", () => {
    describe("getExportCSS", () => {
        beforeEach(() => {
            document.head.replaceChildren();
        });

        it("supports documents missing stylesheets", async () => {
            const css = await getExportCSS(new Set());
            expect(css).not.toContain("color-scheme: light");
        });

        it("fetches export stylesheets and filters unused css", async () => {
            document.head.innerHTML = `
                <link rel="stylesheet" href="/bundle.css" />
                <link rel="stylesheet" href="/theme-light.css" />
                <link rel="stylesheet" href="/theme-dark.css" />
            `;

            fetchMock.get(
                "end:/bundle.css",
                `
                @font-face { font-family: Inter; src: url(inter.woff2); }
                body { margin: 0; }
                .mx_Used { font-family: Inter; color: #111111; }
                .mx_Code { font-family: Fira Code; }
                .mx_Unused { color: #123456; }
                .mx_Empty {}
                .mx_Used, .mx_UnusedComma { color: #abcdef; }
                @media screen {
                    .mx_Used { --cpd-font-family-sans: "Inter"; }
                    .mx_UnusedNested { color: #654321; }
                }
                @supports (display: grid) {
                    .mx_UnusedSupported { color: #fedcba; }
                }
            `,
            );
            fetchMock.get("end:/theme-light.css", ".mx_Theme { color: #222222; }");

            const css = await getExportCSS(new Set(["mx_Used", "mx_Code", "mx_Theme"]));

            expect(fetchMock).toHaveFetchedTimes(1, "end:/bundle.css");
            expect(fetchMock).toHaveFetchedTimes(1, "end:/theme-light.css");
            expect(fetchMock).not.toHaveFetched("end:/theme-dark.css");

            expect(css).toContain("margin:0");
            expect(css).toContain("#111");
            expect(css).toContain("#222");
            expect(css).toContain("#abcdef");

            expect(css).not.toContain("@font-face");
            expect(css).not.toContain("#123456");
            expect(css).not.toContain("#654321");
            expect(css).not.toContain("#fedcba");

            expect(css).not.toContain("font-family:Inter");
            expect(css).not.toContain("font-family:Fira Code");
            expect(css).toContain("BlinkMacSystemFont");
            expect(css).toContain("Menlo, Consolas");
        });

        it("keeps export-only css in the app cascade layer after layered font rules", async () => {
            document.head.innerHTML = `
                <link rel="stylesheet" href="/bundle.css" />
            `;

            fetchMock.get(
                "end:/bundle.css",
                `
                @layer compound-tokens, compound-web, shared-components, app-web;
                @layer compound-web {
                    .mx_Typography {
                        font: var(--cpd-font-heading-lg-regular);
                    }
                }
                @layer app-web {
                    body {
                        font: var(--cpd-font-body-md-regular) !important;
                    }
                }
            `,
            );

            const css = await getExportCSS(new Set(["mx_Typography"]));

            expect(css).toContain("@layer compound-web{.mx_Typography{font:var(--cpd-font-heading-lg-regular)}}");
            expect(css).toContain("@layer app-web{body{font:var(--cpd-font-body-md-regular)!important}}");

            const exportCssLayerIndex = css.indexOf("@layer app-web {");
            expect(exportCssLayerIndex).toBeGreaterThan(
                css.indexOf("@layer app-web{body{font:var(--cpd-font-body-md-regular)!important}}"),
            );
            expect(css.slice(exportCssLayerIndex)).toBe("@layer app-web {css-file-stub}");
        });
    });
});
