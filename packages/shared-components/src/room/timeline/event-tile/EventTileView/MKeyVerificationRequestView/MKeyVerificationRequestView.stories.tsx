/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { MKeyVerificationRequestView, type MKeyVerificationRequestViewSnapshot } from "./MKeyVerificationRequestView";

type MKeyVerificationRequestViewProps = MKeyVerificationRequestViewSnapshot & {
    className?: string;
};

const MKeyVerificationRequestViewWrapperImpl = ({
    className,
    ...snapshot
}: MKeyVerificationRequestViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, {});

    return <MKeyVerificationRequestView vm={vm} className={className} />;
};

const MKeyVerificationRequestViewWrapper = withViewDocs(
    MKeyVerificationRequestViewWrapperImpl,
    MKeyVerificationRequestView,
);

const meta = {
    title: "Timeline/Timeline Event/MKeyVerificationRequestView",
    component: MKeyVerificationRequestViewWrapper,
    tags: ["autodocs"],
    args: {
        title: "Alice wants to verify",
        subtitle: "Alice (@alice:example.org)",
        className: "",
    },
} satisfies Meta<typeof MKeyVerificationRequestViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Received: Story = {};

export const SentByMe: Story = {
    args: {
        title: "You sent a verification request",
        subtitle: "Bob (@bob:example.org)",
    },
};

export const WithTimestamp: Story = {
    args: {
        timestamp: <span>14:56</span>,
    },
};
