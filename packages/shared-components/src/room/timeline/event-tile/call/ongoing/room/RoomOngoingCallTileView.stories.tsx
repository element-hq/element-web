/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type RoomOngoingCallTileViewSnapshot, RoomOngoingCallTileView } from "./RoomOngoingCallTileView";
import { MockViewModel, useMockedViewModel } from "../../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../../.storybook/withViewDocs";
import { type CommonOngoingCallTileViewAction } from "../common";
import { CallDirection } from "../../common";
import profileLink1 from "../../../../../../../static/profile-pics/profile1.png";
import profileLink2 from "../../../../../../../static/profile-pics/profile2.png";
import profileLink3 from "../../../../../../../static/profile-pics/profile3.png";
import { MockFacePileViewModel, MockMemberAvatarViewModel } from "../call-mocks";

const RoomOngoingCallTileViewWrapperImpl = ({
    join,
    ...rest
}: RoomOngoingCallTileViewSnapshot & CommonOngoingCallTileViewAction): React.ReactNode => {
    const vm = useMockedViewModel(rest, { join });
    return <RoomOngoingCallTileView vm={vm} />;
};

const RoomOngoingCallTileViewWrapper = withViewDocs(RoomOngoingCallTileViewWrapperImpl, RoomOngoingCallTileView);

const meta = {
    title: "Timeline/Timeline Event/Call/Ongoing/RoomOngoingCallTileView",
    component: RoomOngoingCallTileViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        callDirection: {
            options: [CallDirection.Incoming, CallDirection.Outgoing],
            control: { type: "radio" },
        },
        isCallIgnored: {
            control: { type: "boolean" },
        },
    },
    args: {
        callDirection: CallDirection.Incoming,
        startedByDisplayName: "Bob",
        durationViewModel: new MockViewModel({ duration: 100 }),
        isCallIgnored: false,
        totalParticipants: 8,
        callHasOtherParticipants: true,
        isJoinable: true,
        isJoined: false,
        join: () => {},
        memberAvatarViewModel: new MockMemberAvatarViewModel({ id: "@bob:m.org", name: "Bob", url: profileLink1 }),
        facePileViewModel: new MockFacePileViewModel([
            { id: "@bob:m.org", name: "Bob", url: profileLink1 },
            { id: "@riley:m.org", name: "Riley", url: profileLink2 },
            { id: "@andi:m.org", name: "Andi", url: profileLink3 },
            { id: "@foo1:m.org", name: "Foo 1" },
            { id: "@foo2:m.org", name: "Foo 2" },
            { id: "@foo3:m.org", name: "Foo 3" },
            { id: "@foo4:m.org", name: "Foo 4" },
            { id: "@foo5:m.org", name: "Foo 5" },
        ]),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=11217-3901&t=OvT1LOc5wH4kXt0a-4",
        },
    },
} satisfies Meta<typeof RoomOngoingCallTileViewWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RoomCallWithoutOtherParticipants: Story = {
    args: {
        callHasOtherParticipants: false,
        totalParticipants: 1,
    },
};

export const RoomCallIgnored: Story = {
    args: {
        isCallIgnored: true,
    },
};

export const RoomCallJoined: Story = {
    args: {
        isJoined: true,
    },
};
