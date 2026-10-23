/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarEventView, CalendarEventViewStatus, type CalendarEventViewSnapshot } from "./CalendarEventView";
import { useMockedViewModel } from "../../../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";

type CalendarEventViewProps = CalendarEventViewSnapshot & { sender?: ReactNode; className?: string };

const CalendarEventViewWrapperImpl = ({ sender, className, ...snapshotProps }: CalendarEventViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {});
    return <CalendarEventView vm={vm} sender={sender} className={className} />;
};

/** Stands in for the app's user pill, which is not available to shared components. */
const SenderPill = (
    <span
        style={{
            padding: "0 var(--cpd-space-1-5x)",
            borderRadius: "var(--cpd-space-4x)",
            backgroundColor: "var(--cpd-color-bg-subtle-primary)",
            color: "var(--cpd-color-text-primary)",
        }}
    >
        Alice
    </span>
);

const CalendarEventViewWrapper = withViewDocs(CalendarEventViewWrapperImpl, CalendarEventView);

const meta = {
    title: "Timeline/Timeline Body/CalendarEventView",
    component: CalendarEventViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        status: {
            options: Object.values(CalendarEventViewStatus),
            control: { type: "select" },
        },
        sender: { control: false },
    },
    args: {
        title: "Some event",
        date: "Wednesday, 15 January 2020",
        startMonth: "Jan",
        startDay: "15",
        time: "13:00 – 14:00",
        timeZone: "America/New_York",
        status: CalendarEventViewStatus.CONFIRMED,
    },
} satisfies Meta<typeof CalendarEventViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllDay: Story = {
    args: {
        title: "Company holiday",
        date: "Friday, 25 December 2026",
        startMonth: "Dec",
        startDay: "25",
        time: undefined,
        timeZone: undefined,
    },
};

export const Recurring: Story = {
    args: {
        title: "Daily standup",
        time: "09:30 – 09:45",
        recurrence: "Every weekday",
        participantCount: 6,
    },
};

export const WithDetails: Story = {
    args: {
        title: "Quarterly planning",
        description: "Agenda:\n- Review last quarter\n- Agree goals for the next one",
        locations: ["Meeting room 2", "London office"],
        link: "https://example.org/planning",
        callLink: "https://call.element.io/room/#/planning",
        participantCount: 1,
    },
};

export const WithLink: Story = {
    args: {
        link: "https://example.org/planning",
    },
};

export const WithCallLink: Story = {
    args: {
        callLink: "https://call.element.io/room/#/planning",
    },
};

export const InvitedYou: Story = {
    args: {
        sender: SenderPill,
        invitedYou: true,
        participantCount: 3,
    },
};

export const Scheduled: Story = {
    args: {
        sender: SenderPill,
        invitedYou: false,
    },
};

export const WithoutDateBadge: Story = {
    args: {
        startMonth: undefined,
        startDay: undefined,
    },
};

export const Tentative: Story = {
    args: {
        status: CalendarEventViewStatus.TENTATIVE,
    },
};

export const Cancelled: Story = {
    args: {
        status: CalendarEventViewStatus.CANCELLED,
    },
};

export const Untitled: Story = {
    args: {
        title: "",
    },
};

export const LongContent: Story = {
    args: {
        title: "A very long event title that does not fit on a single line of the timeline",
        description: "A description with a very long word: Donaudampfschifffahrtsgesellschaftskapitänsmütze",
        locations: ["A very long location name that also needs to wrap onto the next line"],
        status: CalendarEventViewStatus.TENTATIVE,
    },
};
