/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { RedactedBodyView, type RedactedBodyViewSnapshot } from "./RedactedBodyView";

type RedactedBodyProps = RedactedBodyViewSnapshot;

const RedactedBodyViewWrapperImpl = ({
    className,
    ...rest
}: RedactedBodyProps & { className?: string }): JSX.Element => {
    const vm = useMockedViewModel(rest, {});

    return <RedactedBodyView vm={vm} className={className} />;
};

const RedactedBodyViewWrapper = withViewDocs(RedactedBodyViewWrapperImpl, RedactedBodyView);

const meta = {
    title: "MessageBody/RedactedBodyView",
    component: RedactedBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        text: "Message deleted",
        tooltip: "This message was deleted on Thu, 17 Nov 2022, 4:58:32 pm",
        className: "",
    },
} satisfies Meta<typeof RedactedBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.hover(canvas.getByText("Message deleted"));
        await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
    },
};

export const SelfRedaction: Story = {
    args: {
        text: "Message deleted",
        tooltip: undefined,
    },
};

export const RedactedByAnotherUser: Story = {
    args: {
        text: "Message deleted by Alice",
    },
};
