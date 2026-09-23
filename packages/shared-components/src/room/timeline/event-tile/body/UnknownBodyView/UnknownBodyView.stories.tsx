/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { UnknownBodyView } from "./UnknownBodyView";

const UnknownBodyViewWrapper = withViewDocs(UnknownBodyView, UnknownBodyView);

const meta = {
    title: "Timeline/Timeline Body/UnknownBodyView",
    component: UnknownBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        text: "Unsupported message body",
        className: "",
    },
} satisfies Meta<typeof UnknownBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Multiline: Story = {
    args: {
        text: "Unsupported message body\nwith preserved line breaks",
    },
};
