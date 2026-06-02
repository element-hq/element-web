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
import { EventPreviewView, type EventPreviewViewSnapshot } from "./EventPreviewView";

type WrapperProps = EventPreviewViewSnapshot & {
    className?: string;
};

const EventPreviewViewWrapperImpl = ({ className, ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {});

    return <EventPreviewView vm={vm} className={className} />;
};

const EventPreviewViewWrapper = withViewDocs(EventPreviewViewWrapperImpl, EventPreviewView);

const meta = {
    title: "Timeline/EventTile/EventPreviewView",
    component: EventPreviewViewWrapper,
    tags: ["autodocs"],
    args: {
        isVisible: true,
        previewContent: "A short text message preview",
        previewTooltip: "A short text message preview",
    },
} satisfies Meta<typeof EventPreviewViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPrefix: Story = {
    args: {
        previewContent: (
            <>
                <strong>Image:</strong> city-map.png
            </>
        ),
        previewTooltip: undefined,
    },
};

export const Hidden: Story = {
    args: {
        isVisible: false,
    },
};
