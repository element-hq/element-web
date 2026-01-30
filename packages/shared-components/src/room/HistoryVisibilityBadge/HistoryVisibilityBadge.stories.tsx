/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { HistoryVisibilityBadge } from "./HistoryVisibilityBadge";

const meta = {
    title: "Room/HistoryVisibilityBadge",
    component: HistoryVisibilityBadge,
    tags: ["autodocs"],
    args: { historyVisibility: "invited" },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/IXcnmuaIwtm3F3vBuFCPUp/Room-History-Sharing?node-id=39-10758&t=MKC8KCGCpykDbrcX-1",
        },
    },
} satisfies Meta<typeof HistoryVisibilityBadge>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
