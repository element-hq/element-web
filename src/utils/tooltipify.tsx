/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import ReactDOM from "react-dom";

import PlatformPeg from "../PlatformPeg";
import LinkWithTooltip from "../components/views/elements/LinkWithTooltip";

/**
 * If the platform enabled needsUrlTooltips, recurses depth-first through a DOM tree, adding tooltip previews
 * for link elements. Otherwise, does nothing.
 *
 * @param {Element[]} rootNodes - a list of sibling DOM nodes to traverse to try
 *   to add tooltips.
 * @param {Element[]} ignoredNodes: a list of nodes to not recurse into.
 * @param {Element[]} containers: an accumulator of the DOM nodes which contain
 *   React components that have been mounted by this function. The initial caller
 *   should pass in an empty array to seed the accumulator.
 */
export function tooltipifyLinks(rootNodes: ArrayLike<Element>, ignoredNodes: Element[], containers: Element[]): void {
    if (!PlatformPeg.get()?.needsUrlTooltips()) {
        return;
    }

    let node = rootNodes[0];

    while (node) {
        if (ignoredNodes.includes(node) || containers.includes(node)) {
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
            } catch (e) {
                // Not all hrefs will be valid URLs
            }

            // The node's innerHTML was already sanitized before being rendered in the first place, here we are just
            // wrapping the link with the LinkWithTooltip component, keeping the same children. Ideally we'd do this
            // without the superfluous span but this is not something React trivially supports at this time.
            const tooltip = (
                <LinkWithTooltip tooltip={href}>
                    <span dangerouslySetInnerHTML={{ __html: node.innerHTML }} />
                </LinkWithTooltip>
            );

            ReactDOM.render(tooltip, node);
            containers.push(node);
        } else if (node.childNodes?.length) {
            tooltipifyLinks(node.childNodes as NodeListOf<Element>, ignoredNodes, containers);
        }

        node = node.nextSibling as Element;
    }
}

/**
 * Unmount tooltip containers created by tooltipifyLinks.
 *
 * It's critical to call this after tooltipifyLinks, otherwise
 * tooltips will leak.
 *
 * @param {Element[]} containers - array of tooltip containers to unmount
 */
export function unmountTooltips(containers: Element[]): void {
    for (const container of containers) {
        ReactDOM.unmountComponentAtNode(container);
    }
}
