/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach } from "vitest";
import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from "@storybook/react-vite";
import { vis, visAnnotations } from "storybook-addon-vis/vitest-setup";
import { cdp } from "vitest/browser";

import * as projectAnnotations from "./preview.tsx";

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations, visAnnotations]);

// Playwright 1.62's bundled Chromium (151) stopped clearing :hover/:focus-visible state when the DOM under
// the pointer/active element is swapped out between story renders, so a previous story's real hover or
// keyboard focus can bleed into the next story's screenshot (e.g. a tooltip that should only show on
// hover). Reset both before each story mounts (rather than after) so we don't clobber state a story's own
// `play` function intentionally sets up, e.g. an open menu with a focused item.
//
// We dispatch a raw CDP mouse move to the extreme bottom-right corner of the viewport rather than going
// through `userEvent.hover`/`unhover` on some element: those go through Playwright's normal actionability
// checks, which can hang indefinitely if the *previous* story left a full-screen overlay (an open menu's
// backdrop) covering the target - including a dedicated "parking" element, since a later-appended,
// equal-or-higher-z-index portal can still paint on top of it. A raw `Input.dispatchMouseEvent` has no
// target element and no actionability wait, so it can't hang or silently lose a timeout race under load.
// The corner is used, rather than e.g. (0, 0), because several components render an interactive element in
// the top-left corner (see the linked issue) - the exact bottom-right pixel is very unlikely to ever be one.
// See https://github.com/microsoft/playwright/issues/42270
//
// `vitest`'s `CDPSession` type is intentionally empty (it's provider-agnostic), even though the playwright
// provider's implementation does expose `send` at runtime, so it needs a local type for the method we use.
interface CDPSessionSend {
    send(method: "Input.dispatchMouseEvent", params: { type: string; x: number; y: number }): Promise<void>;
}

beforeEach(async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    await (cdp() as unknown as CDPSessionSend).send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: window.innerWidth - 1,
        y: window.innerHeight - 1,
    });
});

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
                [data-video-body-mask-target] {
                    position: relative;
                }
                [data-video-body-mask-target]::after {
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
