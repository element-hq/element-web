/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { PollEndBodyView } from "./PollEndBodyView";

const PollEndBodyViewWrapper = withViewDocs(PollEndBodyView, PollEndBodyView);

const meta = {
    title: "Timeline/Timeline Body/PollEndBodyView",
    component: PollEndBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        text: "The poll has ended. Top answer: yes",
        className: "",
    },
} satisfies Meta<typeof PollEndBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoVotes: Story = {
    args: {
        text: "The poll has ended. No votes were cast.",
    },
};

export const TiedAnswers: Story = {
    args: {
        text: "The poll has ended. Top answer: Pizza, Pasta, Burgers and 2 others",
    },
};
