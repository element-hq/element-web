/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { expect, fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResizableGroup, Panel, type ResizerViewSnapshot, SeparatorView, type SeparatorViewActions } from "..";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { Flex } from "../../core/utils/Flex";

type SeparatorViewProps = ResizerViewSnapshot & SeparatorViewActions;

const Wrapper = ({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    ...snapshot
}: SeparatorViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { onPointerDown, onPointerMove, onPointerUp, onDoubleClick });
    return <SeparatorView className="Separator" vm={vm} />;
};

const SeparatorViewWrapper = withViewDocs(Wrapper, SeparatorView);

const meta = {
    title: "Resize/SeparatorView",
    component: SeparatorViewWrapper,
    tags: ["autodocs"],
    args: {
        onPointerUp: fn(),
        onPointerMove: fn(),
        onPointerDown: fn(),
        onDoubleClick: fn(),
        isCollapsed: true,
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=10603-14568&t=hvg0p1vDW5Cg6ZKY-4",
        },
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
                <ResizableGroup>
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
                </ResizableGroup>
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
            <ResizableGroup>
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
            </ResizableGroup>
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
    },
    play: async ({ canvas, canvasElement }) => {
        const separator = canvas.getByRole("separator");
        separator.focus();
        // Wait for animations to finish
        await new Promise((r) => setTimeout(r, 500));
        await expect(canvasElement).toMatchImageSnapshot();
    },
};

export const HoverWhenCollapsed: Story = {
    // We'll manually take a screenshot for this story
    tags: ["autodocs", "!snapshot"],
    decorators: [
        (Story) => (
            <div
                style={{
                    height: "600px",
                }}
            >
                <ResizableGroup>
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
                </ResizableGroup>
            </div>
        ),
    ],
    play: async ({ canvas, canvasElement }) => {
        const separator = canvas.getByRole("separator");
        separator.dataset.separator = "hover";
        await expect(canvasElement).toMatchImageSnapshot();
    },
};

export const HoverWhenExpanded: Story = {
    // We'll manually take a screenshot for this story
    tags: ["autodocs", "!snapshot"],
    args: {
        isCollapsed: false,
    },
    decorators: [
        (Story) => (
            <div
                style={{
                    height: "600px",
                }}
            >
                <ResizableGroup>
                    <div
                        style={{
                            height: "600px",
                            width: "200px",
                        }}
                    />
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
                </ResizableGroup>
            </div>
        ),
    ],
    play: async ({ canvas, canvasElement }) => {
        const separator = canvas.getByRole("separator");
        separator.dataset.separator = "hover";
        // Wait for animations to finish
        await new Promise((r) => setTimeout(r, 500));
        await expect(canvasElement).toMatchImageSnapshot();
    },
};
