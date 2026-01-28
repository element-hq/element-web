/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Markdown } from "@storybook/addon-docs/blocks";

import type { Meta } from "@storybook/react-vite";
import clampDoc from "../../typedoc/functions/clamp.md?raw";
import defaultNumberDoc from "../../typedoc/functions/defaultNumber.md?raw";
import percentageOfDoc from "../../typedoc/functions/percentageOf.md?raw";
import percentageWithinDoc from "../../typedoc/functions/percentageWithin.md?raw";
import sumDoc from "../../typedoc/functions/sum.md?raw";

const meta = {
    title: "utils/numbers",
    parameters: {
        docs: {
            page: () => (
                <>
                    <h1>Number Utilities</h1>
                    <p>
                        A collection of utility functions for working with numbers, including validation, clamping, and
                        percentage calculations.
                    </p>

                    <hr />
                    <h2>defaultNumber</h2>
                    <Markdown>{defaultNumberDoc}</Markdown>

                    <hr />
                    <h2>clamp</h2>
                    <Markdown>{clampDoc}</Markdown>

                    <hr />
                    <h2>sum</h2>
                    <Markdown>{sumDoc}</Markdown>

                    <hr />
                    <h2>percentageWithin</h2>
                    <Markdown>{percentageWithinDoc}</Markdown>

                    <hr />
                    <h2>percentageOf</h2>
                    <Markdown>{percentageOfDoc}</Markdown>
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
