/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Markdown } from "@storybook/addon-docs/blocks";

import type { Meta } from "@storybook/react-vite";
import LinkifyMatrixOpaqueIdType from "../../../typedoc/enumerations/LinkifyMatrixOpaqueIdType.md?raw";
import findLinksInString from "../../../typedoc/functions/findLinksInString.md?raw";
import isLinkable from "../../../typedoc/functions/isLinkable.md?raw";
import linkifyHtml from "../../../typedoc/functions/linkifyHtml.md?raw";
import linkifyString from "../../../typedoc/functions/linkifyString.md?raw";
import generateLinkedTextOptions from "../../../typedoc/functions/generateLinkedTextOptions.md?raw";
import LinkedTextOptions from "../../../typedoc/interfaces/LinkedTextOptions.md?raw";

const meta = {
    title: "utils/linkify",
    parameters: {
        docs: {
            page: () => (
                <>
                    <h1>Linkify utilities</h1>
                    <p>Supporting functions and types for parsing links from HTML/strings.</p>
                    <h2>LinkifyMatrixOpaqueIdType</h2>
                    <Markdown>{LinkifyMatrixOpaqueIdType}</Markdown>
                    <h2>findLinksInString</h2>
                    <Markdown>{findLinksInString}</Markdown>
                    <h2>isLinkable</h2>
                    <Markdown>{isLinkable}</Markdown>
                    <h2>linkifyHtml</h2>
                    <Markdown>{linkifyHtml}</Markdown>
                    <h2>linkifyString</h2>
                    <Markdown>{linkifyString}</Markdown>
                    <h2>generateLinkedTextOptions</h2>
                    <Markdown>{generateLinkedTextOptions}</Markdown>
                    <h3>LinkedTextOptions</h3>
                    <Markdown>{LinkedTextOptions}</Markdown>
                </>
            ),
        },
    },
    tags: ["autodocs", "skip-test"],
} satisfies Meta;

export default meta;

// Docs-only story - renders nothing but triggers autodocs
export const Docs = {
    render: () => null,
};
