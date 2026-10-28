/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryFn } from "@storybook/react-vite";
import { fn } from "storybook/test";
import React, { type JSX } from "react";

import { useMockedViewModel } from "../../core/viewmodel";
import {
    ElementCallMockView,
    type ElementCallMockViewActions,
    type ElementCallMockViewSnapshot,
} from "./ElementCallMockView";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type ElementCallMockViewProps = ElementCallMockViewSnapshot & ElementCallMockViewActions;

const ElementCallMockViewWrapperImpl = ({
    toggleJoined,
    toggleAlwaysOnScreen,
    toggleAudio,
    toggleVideo,
    close,
    ...snapshot
}: ElementCallMockViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { toggleJoined, toggleAlwaysOnScreen, toggleAudio, toggleVideo, close });
    return <ElementCallMockView vm={vm} />;
};

const ElementCallMockViewWrapper = withViewDocs(ElementCallMockViewWrapperImpl, ElementCallMockView);

const roomId = "!call:example.org";
const configJson = JSON.stringify(
    {
        intent: "start_call",
        config: {},
        effective: { callIntent: "video", skipLobby: false, hideScreensharing: false },
    },
    null,
    2,
);

export default {
    title: "Room/ElementCallMockView",
    component: ElementCallMockViewWrapper,
    tags: ["autodocs"],
    argTypes: {},
    args: {
        unknownRoom: false,
        roomId,
        intent: "start_call",
        joined: false,
        themeLabel: "default",
        languageLabel: "en",
        participants: [],
        audioEnabled: true,
        videoEnabled: true,
        alwaysOnScreen: false,
        canClose: true,
        supportsReactions: true,
        allowJoinUnmutedViaIntent: false,
        log: [{ id: 1, text: "→ contentLoaded" }],
        configJson,
        initializedWith: "not called",
        toggleJoined: fn(),
        toggleAlwaysOnScreen: fn(),
        toggleAudio: fn(),
        toggleVideo: fn(),
        close: fn(),
    },
} satisfies Meta<typeof ElementCallMockViewWrapper>;

const Template: StoryFn<typeof ElementCallMockViewWrapper> = (args) => <ElementCallMockViewWrapper {...args} />;

/**
 * The mock before joining: no one is in the call yet, and the host has only been told the content loaded.
 */
export const Lobby = Template.bind({});
Lobby.args = {};

/**
 * The mock in the call with another device, audio muted and pinned on screen; the log shows both directions.
 */
export const InCall = Template.bind({});
InCall.args = {
    joined: true,
    audioEnabled: false,
    alwaysOnScreen: true,
    participants: [
        { id: "alice", label: "@alice:example.org (ALICEDEVICE) – you" },
        { id: "bob", label: "@bob:example.org (BOBDEVICE)" },
    ],
    log: [
        { id: 1, text: "→ contentLoaded" },
        { id: 2, text: "→ notifyJoined" },
        { id: 3, text: "→ setAlwaysOnScreen(true)" },
        { id: 4, text: "→ notifyDeviceMute({ audio_enabled: false, video_enabled: true })" },
        { id: 5, text: "← hangUp" },
    ],
    initializedWith: JSON.stringify({ rageshake: { submit_url: "https://rageshake.example.org" } }),
};

/**
 * A host bridge that offers no `close`: the tile has no close button and says so.
 */
export const WithoutClose = Template.bind({});
WithoutClose.args = { canClose: false };

/**
 * The mock asked to call in a room the host's client does not know: only an error is shown.
 */
export const UnknownRoom = Template.bind({});
UnknownRoom.args = { unknownRoom: true, roomId: "!unknown:example.org" };
