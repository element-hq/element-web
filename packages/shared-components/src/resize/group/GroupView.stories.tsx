/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupView, GroupViewActions, Panel, Separator } from "..";
import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { Flex } from "../../utils/Flex";

type GroupViewProps = GroupViewActions;

const Wrapper = ({ onLeftPanelResized }: GroupViewProps): JSX.Element => {
    const vm = useMockedViewModel(undefined, { onLeftPanelResized });
    return (
        <GroupView vm={vm}>
            <Panel minSize="200px" maxSize="400px">
                <Flex align="center" justify="center">
                    LEFT CONTENT
                </Flex>
            </Panel>
            <Separator />
            <Panel>
                <Flex align="center" justify="center">
                    MAIN CONTENT
                </Flex>
            </Panel>
        </GroupView>
    );
};

const GroupViewWrapper = withViewDocs(Wrapper, GroupView);

const meta = {
    title: "Resize/GroupView",
    component: GroupViewWrapper,
    // This is a structural component, so nothing to visually test.
    tags: ["autodocs", "!snapshot"],
    args: {
        onLeftPanelResized: fn(),
    },
} satisfies Meta<typeof GroupViewWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    decorators: [
        (Story) => (
            <div
                style={{
                    height: "600px",
                }}
            >
                <Story />
            </div>
        ),
    ],
};
