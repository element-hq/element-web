/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { StrictMode } from "react";
import { TooltipProvider } from "@vector-im/compound-web";

import PlatformPeg from "../PlatformPeg";
import LinkWithTooltip from "../components/views/elements/LinkWithTooltip";
import { type ReactRootManager } from "./react";

/**
 * If the platform enabled needsUrlTooltips, recurses depth-first through a DOM tree, adding tooltip previews
 * for link elements. Otherwise, does nothing.
 *
 * @param {Element[]} rootNodes - a list of sibling DOM nodes to traverse to try
 *   to add tooltips.
 * @param {Element[]} ignoredNodes - a list of nodes to not recurse into.
 * @param {ReactRootManager} tooltips - an accumulator of the DOM nodes which contain
 *   React components that have been mounted by this function. The initial caller
 *   should pass in an empty array to seed the accumulator.
 */
export function tooltipifyLinks(
    rootNodes: ArrayLike<Element>,
    ignoredNodes: Element[],
    tooltips: ReactRootManager,
): void {
    if (!PlatformPeg.get()?.needsUrlTooltips()) {
        return;
    }

    let node = rootNodes[0];

    while (node) {
        if (ignoredNodes.includes(node) || tooltips.elements.includes(node)) {
            node = node.nextSibling as Element;
            continue;
        }

        if (
            node.tagName === "A" &&
            node.getAttribute("href") &&
            node.getAttribute("href") !== node.textContent?.trim()
        ) {
            let href = node.getAttribute("href")!;
            try {
                href = new URL(href, window.location.href).toString();
            } catch {
                // Not all hrefs will be valid URLs
            }

            // The node's innerHTML was already sanitized before being rendered in the first place, here we are just
            // wrapping the link with the LinkWithTooltip component, keeping the same children. Ideally we'd do this
            // without the superfluous span but this is not something React trivially supports at this time.
            const tooltip = (
                <StrictMode>
                    <TooltipProvider>
                        <LinkWithTooltip tooltip={href}>
                            <span dangerouslySetInnerHTML={{ __html: node.innerHTML }} />
                        </LinkWithTooltip>
                    </TooltipProvider>
                </StrictMode>
            );

            tooltips.render(tooltip, node, null);
        } else if (node.childNodes?.length) {
            tooltipifyLinks(node.childNodes as NodeListOf<Element>, ignoredNodes, tooltips);
        }

        node = node.nextSibling as Element;
    }
}
