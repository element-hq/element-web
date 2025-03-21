/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Element as ParserElement, domToReact } from "html-react-parser";

import LinkWithTooltip from "../components/views/elements/LinkWithTooltip";
import { type ReplacerMap } from "./reactHtmlParser.tsx";

const getSingleTextContentNode = (node: ParserElement): string | null => {
    if (node.childNodes.length === 1 && node.childNodes[0].type === "text") {
        return node.childNodes[0].data;
    }
    return null;
};

export const tooltipifyAmbiguousLinksReplacer: ReplacerMap = {
    a: (anchor, { tooltipifyAmbiguousUrls, isHtml }) => {
        // Ambiguous URLs are only possible in HTML content
        if (!tooltipifyAmbiguousUrls || !isHtml) return;

        const href = anchor.attribs["href"];
        if (href && href !== getSingleTextContentNode(anchor)) {
            let tooltip = href as string;
            try {
                tooltip = new URL(href, window.location.href).toString();
            } catch {
                // Not all hrefs will be valid URLs
            }
            return <LinkWithTooltip tooltip={tooltip}>{domToReact([anchor])}</LinkWithTooltip>;
        }
    },
};
