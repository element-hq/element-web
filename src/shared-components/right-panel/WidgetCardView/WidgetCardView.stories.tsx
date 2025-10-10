/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { ViewWrapper } from "../../ViewWrapper";
import { WidgetCardView, WidgetCardViewModel, WidgetCardViewSnapshot } from "./WidgetCardView";

const WidgeCardViewWrapper = (props: WidgetCardViewModel): JSX.Element => (
    <ViewWrapper<WidgetCardViewSnapshot, WidgetCardViewModel> Component={WidgetCardView} props={props} />
);

export default {
    title: "RightPanel/WidgetCardView",
    component: WidgetCardView,
    tags: ["autodocs"],
    args: {
        room: "roomId",
        app: undefined,
        userId: "@userId",
        widgetPageTitle: "",
        widgetName: "",
        shouldEmptyWidgetCard: true,
        creatorUserId: undefined,
        onClose: () => void
    }
} as unknown as Meta<typeof WidgeCardViewWrapper>;

const Template: StoryFn<typeof WidgeCardViewWrapper> = (args) => <WidgeCardViewWrapper {...args} />;

export const Default = Template.bind({});

export const WidgetCreated = Template.bind({});
WidgetCreated.args = {
    room: "roomId",
    app: undefined,
    userId: "@userId",
    widgetPageTitle: "",
    widgetName: "",
    shouldEmptyWidgetCard: true,
    creatorUserId: undefined,
    onClose: () => void
};
