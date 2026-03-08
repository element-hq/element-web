/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    Group,
    LeftResizablePanelView,
    LeftResizablePanelViewActions,
    Panel,
    Separator,
    type ResizerSnapshot,
} from "..";
import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { Flex } from "../../utils/Flex";

type LeftResizablePanelViewProps = ResizerSnapshot & LeftResizablePanelViewActions;

const Wrapper = ({ onLeftPanelResize, setPanelHandle, ...snapshot }: LeftResizablePanelViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { onLeftPanelResize, setPanelHandle });
    return (
        <LeftResizablePanelView vm={vm} minSize="200px" maxSize="400px">
            <Flex align="center" justify="center">
                LEFT CONTENT
            </Flex>
        </LeftResizablePanelView>
    );
};

const LeftResizablePanelViewWrapper = withViewDocs(Wrapper, LeftResizablePanelView);

const meta = {
    title: "Resize/LeftResizablePanelView",
    component: LeftResizablePanelViewWrapper,
    // This is a structural component, so nothing to visually test.
    tags: ["autodocs", "!snapshot"],
    argTypes: {
        // This snapshot state is not relevant for this View.
        isFocusedViaKeyboard: { table: { disable: true } },
    },
    args: {
        initialSize: 20,
        isCollapsed: false,
        isFocusedViaKeyboard: false,
        onLeftPanelResize: fn(),
        setPanelHandle: fn(),
    },
} satisfies Meta<typeof LeftResizablePanelViewWrapper>;

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
                <Group>
                    <Story />
                    <Separator />
                    <Panel>
                        <Flex align="center" justify="center">
                            MAIN CONTENT
                        </Flex>
                    </Panel>
                </Group>
            </div>
        ),
    ],
};
