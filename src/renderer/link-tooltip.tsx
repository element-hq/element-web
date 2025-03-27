/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { domToReact } from "html-react-parser";

import LinkWithTooltip from "../components/views/elements/LinkWithTooltip";
import { getSingleTextContentNode, type RendererMap } from "./utils.tsx";

/**
 * Wraps ambiguous links in a tooltip trigger that shows the full URL.
 */
export const ambiguousLinkTooltipRenderer: RendererMap = {
    a: (anchor, { isHtml }) => {
        // Ambiguous URLs are only possible in HTML content
        if (!isHtml) return;

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
