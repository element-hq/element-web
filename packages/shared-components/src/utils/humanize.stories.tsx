/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Markdown } from "@storybook/addon-docs/blocks";

import type { Meta } from "@storybook/react-vite";

const meta = {
    title: "utils/humanize",
    parameters: {
        docs: {
            page: () => (
                <>
                    <h1>linkifyjs</h1>
                    <Markdown>**Here is some md**</Markdown>
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
