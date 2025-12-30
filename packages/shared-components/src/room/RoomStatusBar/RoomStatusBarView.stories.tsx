/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { type Meta, type StoryFn } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { useMockedViewModel } from "../../useMockedViewModel";
import {
    RoomStatusBarState,
    RoomStatusBarView,
    type RoomStatusBarViewActions,
    type RoomStatusBarViewSnapshot,
} from "./RoomStatusBarView";

type RoomStatusBarProps = RoomStatusBarViewSnapshot & RoomStatusBarViewActions;

const RoomStatusBarViewWrapper = ({
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

export default {
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
} as Meta<typeof RoomStatusBarViewWrapper>;

const Template: StoryFn<typeof RoomStatusBarViewWrapper> = (args) => <RoomStatusBarViewWrapper {...args} />;

/**
 * Rendered when the client has lost connection with the server.
 */
export const WithConnectionLost = Template.bind({});
WithConnectionLost.args = {
    state: RoomStatusBarState.ConnectionLost,
};

/**
 * Rendered when the client needs the user to consent to some terms and conditions before
 * they can perform any room actions.
 */
export const WithConsentLink = Template.bind({});
WithConsentLink.args = {
    state: RoomStatusBarState.NeedsConsent,
    consentUri: "#example",
};

/**
 * Rendered when the server has hit a usage limit and is forbidding the user from performing
 * any actions in the room. There is an optional parameter to link to an admin to contact.
 */
export const WithResourceLimit = Template.bind({});
WithResourceLimit.args = {
    state: RoomStatusBarState.ResourceLimited,
    resourceLimit: "hs_disabled",
    adminContactHref: "#example",
};

/**
 * Rendered when the client has some unsent messages in the room, stored locally.
 */
export const WithUnsentMessages = Template.bind({});
WithUnsentMessages.args = {
    state: RoomStatusBarState.UnsentMessages,
    isResending: false,
};

/**
 * Rendered when the client has some unsent messages in the room, stored locally and is
 * trying to send them.
 */
export const WithUnsentMessagesSending = Template.bind({});
WithUnsentMessagesSending.args = {
    state: RoomStatusBarState.UnsentMessages,
    isResending: true,
};
/**
 * Rendered when a local room has failed to be created.
 */
export const WithLocalRoomRetry = Template.bind({});
WithLocalRoomRetry.args = {
    state: RoomStatusBarState.LocalRoomFailed,
};

/**
 * Rendered when a message was rejected by the server, and cannot be reattempted.
 */
export const WithMessageRejected = Template.bind({});
WithMessageRejected.args = {
    state: RoomStatusBarState.MessageRejected,
    harms: ["org.matrix.msc4387.harassment"],
};

/**
 * Rendered when a message was rejected by the server, and can be reattempted later.
 */
export const WithMessageRejectedCanRetryInTime = Template.bind({});
WithMessageRejectedCanRetryInTime.args = {
    state: RoomStatusBarState.MessageRejected,
    onResendAllClick: undefined,
    canRetryInSeconds: 5,
    harms: [],
    isResending: false,
};

/**
 * Rendered when a message was rejected by the server, and can be reattempted.
 */
export const WithMessageRejectedCanRetry = Template.bind({});
WithMessageRejectedCanRetry.args = {
    state: RoomStatusBarState.MessageRejected,
    harms: [],
    isResending: false,
};

/**
 * Rendered when a message was rejected by the server, and is being resent.
 */
export const WithMessageRejectedSending = Template.bind({});
WithMessageRejectedSending.args = {
    state: RoomStatusBarState.MessageRejected,
    harms: [],
    isResending: true,
};

/**
 * Rendered when a message was rejected by the server, and we use the generic message.
 */
export const WithMessageRejectedWithKnownHarm = Template.bind({});
WithMessageRejectedWithKnownHarm.args = {
    state: RoomStatusBarState.MessageRejected,
    harms: ["org.matrix.msc4387.spam"],
    isResending: false,
};

/**
 * Rendered when a message was rejected by the server with a specific message.
 */
export const WithMessageRejectedWithServerMessage = Template.bind({});
WithMessageRejectedWithServerMessage.args = {
    state: RoomStatusBarState.MessageRejected,
    harms: ["any.old.harm"],
    serverError: "OurServer rejects this content",
    isResending: false,
};
