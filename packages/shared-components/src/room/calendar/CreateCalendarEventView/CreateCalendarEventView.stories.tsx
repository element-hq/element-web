/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    CreateCalendarEventView,
    type CreateCalendarEventViewActions,
    type CreateCalendarEventViewSnapshot,
} from "./CreateCalendarEventView";
import { useMockedViewModel } from "../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type CreateCalendarEventViewProps = CreateCalendarEventViewSnapshot & Partial<CreateCalendarEventViewActions>;

const CreateCalendarEventViewWrapperImpl = ({
    setTitle,
    setDescription,
    setDate,
    setAllDay,
    setStartTime,
    setEndTime,
    setLink,
    create,
    ...snapshotProps
}: CreateCalendarEventViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        setTitle: setTitle ?? fn(),
        setDescription: setDescription ?? fn(),
        setDate: setDate ?? fn(),
        setAllDay: setAllDay ?? fn(),
        setStartTime: setStartTime ?? fn(),
        setEndTime: setEndTime ?? fn(),
        setLink: setLink ?? fn(),
        create: create ?? fn(),
    });
    return <CreateCalendarEventView vm={vm} />;
};

const CreateCalendarEventViewWrapper = withViewDocs(CreateCalendarEventViewWrapperImpl, CreateCalendarEventView);

const meta = {
    title: "Room/Calendar/CreateCalendarEventView",
    component: CreateCalendarEventViewWrapper,
    tags: ["autodocs"],
    args: {
        title: "",
        description: "",
        date: "2026-10-23",
        allDay: false,
        startTime: "15:00",
        endTime: "16:00",
        link: "",
        timeZone: "Europe/London",
    },
    decorators: [
        (Story): JSX.Element => (
            <div style={{ width: 480 }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof CreateCalendarEventViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
    args: {
        title: "Quarterly planning",
        description: "Review last quarter and agree goals for the next one",
        link: "https://call.element.io/room/#/planning",
    },
};

export const AllDay: Story = {
    args: {
        title: "Company holiday",
        allDay: true,
    },
};

export const WithErrors: Story = {
    args: {
        endTime: "14:00",
        link: "not a link",
        date: "",
        isTitleMissing: true,
        isDateMissing: true,
        isEndBeforeStart: true,
        isLinkInvalid: true,
    },
};

export const CreateFailed: Story = {
    args: {
        title: "Quarterly planning",
        didCreateFail: true,
    },
};
