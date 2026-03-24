/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from "@storybook/react-vite";
import { vis, visAnnotations } from "storybook-addon-vis/vitest-setup";

import * as projectAnnotations from "./preview.tsx";

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations, visAnnotations]);

vis.setup({
    async auto() {
        const style = document.createElement("style");
        style.setAttribute("type", "text/css");
        style.appendChild(
            document.createTextNode(`
                /* Inhibit all animations for the screenshot to be more stable */
                *, *::before, *::after {
                    animation: none !important;
                }
                /*
                 * Mask spinner for video overlay during screenshot generation on playwright tests.
                 */
                .container:has(> video) {
                    position: relative;
                }
                .container:has(> video)::after {
                    content: "";
                    position: absolute;
                    inset-inline-start: 50%;
                    inset-block-start: 50%;
                    width: 112px;
                    height: 112px;
                    transform: translate(-50%, -50%);
                    border-radius: 999px;
                    background: #ff4fcf;
                    pointer-events: none;
                }
                /* Hide all storybook elements */
                .sb-wrapper {
                    visibility: hidden !important;
                }
            `),
        );
        document.head.appendChild(style);
    },
});
