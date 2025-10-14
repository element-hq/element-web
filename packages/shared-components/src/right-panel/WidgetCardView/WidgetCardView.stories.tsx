/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { ViewWrapper } from "../../ViewWrapper";
import { WidgetCardView, WidgetCardViewActions, WidgetCardViewModel, WidgetCardViewSnapshot } from "./WidgetCardView";
import { Room } from "matrix-js-sdk/src/matrix";

type WidgetCardProps = WidgetCardViewSnapshot & WidgetCardViewActions;

const WidgeCardViewWrapper = (props: WidgetCardProps): JSX.Element => (
    <ViewWrapper<WidgetCardViewSnapshot, WidgetCardViewModel> Component={WidgetCardView} props={props} />
);

export default {
    title: "RightPanel/WidgetCardView",
    component: WidgeCardViewWrapper,
    tags: ["autodocs"],
    args: {
        room: new Room("roomId"),
        app: undefined,
        userId: "@userId",
        widgetPageTitle: "",
        widgetName: "",
        shouldEmptyWidgetCard: true,
        creatorUserId: undefined,
        onClose: () => void
    }
} as Meta<typeof WidgeCardViewWrapper>;

const Template: StoryFn<typeof WidgeCardViewWrapper> = (args) => <WidgeCardViewWrapper {...args} />;

export const Default = Template.bind({});

// export const WidgetCreated = Template.bind({});
// WidgetCreated.args = {
//     room: "roomId",
//     app: undefined,
//     userId: "@userId",
//     widgetPageTitle: "",
//     widgetName: "",
//     shouldEmptyWidgetCard: true,
//     creatorUserId: undefined,
//     onClose: () => void
// };
