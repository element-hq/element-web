/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { type Meta, type StoryFn } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { useMockedViewModel } from "../../viewmodel";
import { WidgetPipView, type WidgetPipViewActions, type WidgetPipViewSnapshot } from "./WidgetPipView";

type WidgetPipViewProps = WidgetPipViewSnapshot & WidgetPipViewActions;

// Helper components that are provided outside of this storybook
const RoomAvatarMock: React.FC = () => (
    <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "grey" }} />
);
const PersistentAppMock: React.FC = () => <div style={{ backgroundColor: "grey", flexGrow: 1 }} />;

const WidgetPipViewWrapper = ({
    onBackClick,
    persistentAppComponent,
    setViewingRoom: onViewedRoomChanged,
    ...rest
}: WidgetPipViewProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onBackClick,
        persistentAppComponent,
        setViewingRoom,
    });
    return (
        <WidgetPipView
            vm={vm}
            RoomAvatar={RoomAvatarMock}
            movePersistedElement={React.createRef()}
            onStartMoving={() => {}}
        />
    );
};

export default {
    title: "room/WidgetPipView",
    component: WidgetPipViewWrapper,
    tags: ["autodocs"],
    argTypes: {},
    args: {
        widgetId: "xyz",
        roomId: "roomId",
        roomName: "Room Name",
        onBackClick: fn(),
        persistentAppComponent: PersistentAppMock,
        setViewingRoom: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/aOEkaJtaBmPy058V7uoqVr/Element-Call-Updates---Q1-2026--New-?node-id=21-31333&p=f&t=zBuFi63PKdQ0Nhab-0",
        },
    },
} satisfies Meta<typeof WidgetPipViewWrapper>;

const Template: StoryFn<typeof WidgetPipViewWrapper> = (args) => <WidgetPipViewWrapper {...args} />;

/**
 * Rendered when using a widget with just a grey background.
 */
export const WithGreyWidget = Template.bind({});
WithGreyWidget.args = {};

/**
 * Rendered when using a transparent bg widget like element call
 */
export const WithElementCallWidgetMock = Template.bind({});
const CallPill: React.FC = () => (
    <div style={{ borderRadius: "50%", width: "50px", height: "50px", backgroundColor: "grey" }} />
);
WithElementCallWidgetMock.args = {
    roomName: "Element Call Room",
    persistentAppComponent: () => (
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ flexGrow: 4, backgroundColor: "gray", borderRadius: "24px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", margin: "10px" }}>
                <CallPill />
                <CallPill />
                <CallPill />
                <CallPill />
            </div>
        </div>
    ),
};
