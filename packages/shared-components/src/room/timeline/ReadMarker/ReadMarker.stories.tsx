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
        // The list's own default indent would push the marker off-centre, which is
        // not how it sits in a timeline; the timeline resets it the same way.
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
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
    title: "Timeline/Timeline Meta/ReadMarker",
    component: ReadMarkerWrapper,
    tags: ["autodocs"],
    // The marker is a hairline that a timeline draws inset between messages, and
    // it deliberately takes no vertical space of its own. Give it the same inset
    // and some room above, so the rule is visible rather than pressed against the
    // top edge of the frame.
    decorators: [
        (Story): JSX.Element => (
            <div style={{ padding: "18px" }}>
                <Story />
            </div>
        ),
    ],
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

/** The labelled style: a line with the label at its right-hand end. */
export const Labelled: Story = {
    args: {
        label: "New",
    },
};

export const Ghost: Story = {
    args: {
        kind: "ghost",
    },
};
