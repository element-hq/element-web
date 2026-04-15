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
    ResizableGroup,
    LeftResizablePanelView,
    Panel,
    Separator,
    type LeftResizablePanelViewActions,
    type ResizerViewSnapshot,
} from "..";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { Flex } from "../../core/utils/Flex";

type LeftResizablePanelViewProps = ResizerViewSnapshot & LeftResizablePanelViewActions;

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
    title: "Resize/Panel/LeftResizablePanelView",
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
                <ResizableGroup>
                    <Story />
                    <Separator />
                    <Panel>
                        <Flex align="center" justify="center">
                            MAIN CONTENT
                        </Flex>
                    </Panel>
                </ResizableGroup>
            </div>
        ),
    ],
};
