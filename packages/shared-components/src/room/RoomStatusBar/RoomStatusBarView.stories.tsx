/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { type Meta, type StoryFn } from "@storybook/react-vite";
import React, { type JSX } from "react";

import { useMockedViewModel } from "../../useMockedViewModel";
import { RoomStatusBarView, type RoomStatusBarViewActions, type RoomStatusBarViewSnapshot } from "./RoomStatusBarView";
import { fn } from "storybook/test";

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
    state: {
        connectionLost: true,
    },
};

/**
 * Rendered when the client needs the user to consent to some terms and conditions before
 * they can perform any room actions.
 */
export const WithConsentLink = Template.bind({});
WithConsentLink.args = {
    state: {
        consentUri: "#example",
    },
};

/**
 * Rendered when the server has hit a usage limit and is forbidding the user from performing
 * any actions in the room. There is an optional parameter to link to an admin to contact.
 */
export const WithResourceLimit = Template.bind({});
WithResourceLimit.args = {
    state: {
        resourceLimit: "hs_disabled",
        adminContactHref: "#example",
    },
};

/**
 * Rendered when the client has some unsent messages in the room, stored locally.
 */
export const WithUnsentMessages = Template.bind({});
WithUnsentMessages.args = {
    state: {
        isResending: false,
    },
};

/**
 * Rendered when the client has some unsent messages in the room, stored locally and is
 * trying to send them.
 */
export const WithUnsentMessagesSending = Template.bind({});
WithUnsentMessagesSending.args = {
    state: {
        isResending: true,
    },
};
/**
 * Rendered when a local room has failed to be created.
 */
export const WithLocalRoomRetry = Template.bind({});
WithLocalRoomRetry.args = {
    state: {
        shouldRetryRoomCreation: false,
    },
};
