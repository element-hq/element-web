/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type DOMNode, type HTMLReactParserOptions, Element as ParserElement, domToReact } from "html-react-parser";

import PlatformPeg from "../PlatformPeg";
import LinkWithTooltip from "../components/views/elements/LinkWithTooltip";

const getSingleTextContentNode = (node: ParserElement): string | null => {
    if (node.childNodes.length === 1 && node.childNodes[0].type === "text") {
        return node.childNodes[0].data;
    }
    return null;
};

export const tooltipifyLinksReplacer = (): HTMLReactParserOptions["replace"] => {
    if (!PlatformPeg.get()?.needsUrlTooltips()) return;

    return (domNode: DOMNode) => {
        if (
            domNode instanceof ParserElement &&
            domNode.attribs["href"] &&
            domNode.attribs["href"] !== getSingleTextContentNode(domNode)
        ) {
            let tooltip = domNode.attribs["href"] as string;
            try {
                tooltip = new URL(domNode.attribs["href"], window.location.href).toString();
            } catch {
                // Not all hrefs will be valid URLs
            }
            return <LinkWithTooltip tooltip={tooltip}>{domToReact([domNode])}</LinkWithTooltip>;
        }
    };
};
