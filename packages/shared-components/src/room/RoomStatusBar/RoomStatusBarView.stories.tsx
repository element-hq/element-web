/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { type Meta, type StoryObj } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import {
    RoomStatusBarState,
    RoomStatusBarView,
    type RoomStatusBarViewActions,
    type RoomStatusBarViewSnapshot,
} from "./RoomStatusBarView";

type RoomStatusBarProps = RoomStatusBarViewSnapshot & RoomStatusBarViewActions;

const RoomStatusBarViewWrapperImpl = ({
    onResendAllClick,
    onDeleteAllClick,
    onRetryRoomCreationClick,
    onTermsAndConditionsClicked,
    ...rest
}: RoomStatusBarProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onResendAllClick,
        onDeleteAllClick,
        onRetryRoomCreationClick,
        onTermsAndConditionsClicked,
    });
    return <RoomStatusBarView vm={vm} />;
};
const RoomStatusBarViewWrapper = withViewDocs(RoomStatusBarViewWrapperImpl, RoomStatusBarView);

const meta = {
    title: "room/RoomStatusBarView",
    component: RoomStatusBarViewWrapper,
    tags: ["autodocs"],
    argTypes: {},
    args: {
        onResendAllClick: fn(),
        onDeleteAllClick: fn(),
        onRetryRoomCreationClick: fn(),
        onTermsAndConditionsClicked: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=11019-2353&t=p8SkJGh9tJx09MTJ-4",
        },
    },
} satisfies Meta<typeof RoomStatusBarViewWrapper>;

export default meta;
type Story = StoryObj<typeof RoomStatusBarViewWrapper>;

/**
 * Rendered when the client has lost connection with the server.
 */
export const WithConnectionLost: Story = {
    args: {
        state: RoomStatusBarState.ConnectionLost,
    },
};

/**
 * Rendered when the client needs the user to consent to some terms and conditions before
 * they can perform any room actions.
 */
export const WithConsentLink: Story = {
    args: {
        state: RoomStatusBarState.NeedsConsent,
        consentUri: "#example",
    },
};

/**
 * Rendered when the server has hit a usage limit and is forbidding the user from performing
 * any actions in the room. There is an optional parameter to link to an admin to contact.
 */
export const WithResourceLimit: Story = {
    args: {
        state: RoomStatusBarState.ResourceLimited,
        resourceLimit: "hs_disabled",
        adminContactHref: "#example",
    },
};

/**
 * Rendered when the client has some unsent messages in the room, stored locally.
 */
export const WithUnsentMessages: Story = {
    args: {
        state: RoomStatusBarState.UnsentMessages,
        isResending: false,
    },
};

/**
 * Rendered when the client has some unsent messages in the room, stored locally and is
 * trying to send them.
 */
export const WithUnsentMessagesSending: Story = {
    args: {
        state: RoomStatusBarState.UnsentMessages,
        isResending: true,
    },
};

/**
 * Rendered when a local room has failed to be created.
 */
export const WithLocalRoomRetry: Story = {
    args: {
        state: RoomStatusBarState.LocalRoomFailed,
    },
};
