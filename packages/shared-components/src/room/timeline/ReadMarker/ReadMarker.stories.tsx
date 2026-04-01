/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReadMarker, type ReadMarkerProps } from "./ReadMarker";

const ReadMarkerWrapper = ({
    className,
    onCurrentMarkerRef,
    onGhostLineRef,
    onGhostTransitionEnd,
    ...props
}: Readonly<ReadMarkerProps>): JSX.Element => {
    return (
        <ul>
            <ReadMarker
                {...props}
                className={className}
                onCurrentMarkerRef={onCurrentMarkerRef ?? fn()}
                onGhostLineRef={onGhostLineRef ?? fn()}
                onGhostTransitionEnd={onGhostTransitionEnd ?? fn()}
            />
        </ul>
    );
};

const meta = {
    title: "Timeline/ReadMarker",
    component: ReadMarkerWrapper,
    tags: ["autodocs"],
    args: {
        eventId: "$event",
        kind: "current",
        showLine: true,
    },
} satisfies Meta<typeof ReadMarkerWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Current: Story = {};

export const HiddenCurrent: Story = {
    args: {
        showLine: false,
    },
};

export const Ghost: Story = {
    args: {
        kind: "ghost",
    },
};
