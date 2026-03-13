/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { expect, fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Group, Panel, type ResizerSnapshot, SeparatorView, type SeparatorViewActions } from "..";
import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { Flex } from "../../utils/Flex";

type SeparatorViewProps = ResizerSnapshot & SeparatorViewActions;

const Wrapper = ({ onFocus, onBlur, onSeparatorClick, ...snapshot }: SeparatorViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { onFocus, onBlur, onSeparatorClick });
    return <SeparatorView className="Separator" vm={vm} />;
};

const SeparatorViewWrapper = withViewDocs(Wrapper, SeparatorView);

const meta = {
    title: "Resize/SeparatorView",
    component: SeparatorViewWrapper,
    tags: ["autodocs"],
    args: {
        onFocus: fn(),
        onBlur: fn(),
        onSeparatorClick: fn(),
        isCollapsed: true,
        isFocusedViaKeyboard: false,
    },
} satisfies Meta<typeof SeparatorViewWrapper>;

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
                    <Panel collapsible defaultSize="0" minSize="200px" maxSize="400px">
                        <Flex tabIndex={0} align="center" justify="center">
                            LEFT CONTENT
                        </Flex>
                    </Panel>
                    <Story />
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

const commonDecorator = (Story: React.ComponentType): React.ReactElement => {
    return (
        <div
            style={{
                height: "600px",
            }}
        >
            <Group>
                <Panel collapsible defaultSize="200px" minSize="200px" maxSize="400px">
                    <Flex tabIndex={0} align="center" justify="center">
                        LEFT CONTENT
                    </Flex>
                </Panel>
                <Story />
                <Panel>
                    <Flex align="center" justify="center">
                        MAIN CONTENT
                    </Flex>
                </Panel>
            </Group>
        </div>
    );
};

export const LeftPanelExpanded: Story = {
    decorators: [(Story) => commonDecorator(Story)],
    args: {
        isCollapsed: false,
    },
};

export const KeyboardFocused: Story = {
    // We'll manually take a screenshot for this story
    tags: ["autodocs", "!snapshot"],
    decorators: [(Story) => commonDecorator(Story)],
    args: {
        isCollapsed: false,
        isFocusedViaKeyboard: true,
    },
    play: async ({ canvas, canvasElement }) => {
        const separator = canvas.getByRole("separator");
        separator.focus();
        await expect(canvasElement).toMatchImageSnapshot();
    },
};

export const Hover: Story = {
    // We'll manually take a screenshot for this story
    tags: ["autodocs", "!snapshot"],
    decorators: [
        (Story) => (
            <div
                style={{
                    height: "600px",
                }}
            >
                <Group>
                    <Panel collapsible defaultSize="0" minSize="200px" maxSize="400px">
                        <Flex tabIndex={0} align="center" justify="center">
                            LEFT CONTENT
                        </Flex>
                    </Panel>
                    <Story />
                    <Panel>
                        <Flex align="center" justify="center">
                            MAIN CONTENT
                        </Flex>
                    </Panel>
                </Group>
            </div>
        ),
    ],
    play: async ({ canvas, canvasElement }) => {
        const separator = canvas.getByRole("separator");
        separator.dataset.separator = "hover";
        await expect(canvasElement).toMatchImageSnapshot();
    },
};
