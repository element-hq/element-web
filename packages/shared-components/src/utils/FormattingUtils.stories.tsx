/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Markdown } from "@storybook/addon-docs/blocks";

import type { Meta } from "@storybook/react-vite";
import formatBytesDoc from "../../typedoc/functions/formatBytes.md?raw";
import formatSecondsDoc from "../../typedoc/functions/formatSeconds.md?raw";

const meta = {
    title: "utils/FormattingUtils",
    parameters: {
        docs: {
            page: () => (
                <>
                    <h1>Formatting Utilities</h1>
                    <p>A collection of utility functions for formatting data into human-readable strings.</p>

                    <hr />
                    <h2>formatBytes</h2>
                    <Markdown>{formatBytesDoc}</Markdown>

                    <hr />
                    <h2>formatSeconds</h2>
                    <Markdown>{formatSecondsDoc}</Markdown>
                </>
            ),
        },
    },
    tags: ["autodocs"],
} satisfies Meta;

export default meta;

// Docs-only story - renders nothing but triggers autodocs
export const Docs = {
    render: () => null,
};
