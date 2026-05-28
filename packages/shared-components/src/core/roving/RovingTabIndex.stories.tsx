/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import {
    checkInputableElement,
    findNextSiblingElement,
    findPreviousSiblingElement,
    type IAction,
    type IState,
    RovingAction,
    RovingStateActionType,
    RovingTabIndexProvider,
    useRovingTabIndex,
} from ".";

const toolbarStyle: React.CSSProperties = {
    display: "inline-flex",
    gap: 4,
    padding: 12,
    border: "1px solid var(--cpd-color-border-interactive-secondary)",
    borderRadius: 8,
};

const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
};

const verticalToolbarStyle: React.CSSProperties = {
    ...toolbarStyle,
    flexDirection: "column",
};

const buttonStyle: React.CSSProperties = {
    minWidth: 72,
    height: 36,
};

const activeLabelStyle: React.CSSProperties = {
    color: "var(--cpd-color-text-secondary)",
    font: "var(--cpd-font-body-sm-regular)",
};

const toolbarLabelStyle: React.CSSProperties = {
    color: "var(--cpd-color-text-secondary)",
    font: "var(--cpd-font-body-md-semibold)",
};

const getAction = (event: React.KeyboardEvent): RovingAction | undefined => {
    switch (event.key) {
        case "Home":
            return RovingAction.Home;
        case "End":
            return RovingAction.End;
        case "ArrowLeft":
            return RovingAction.ArrowLeft;
        case "ArrowUp":
            return RovingAction.ArrowUp;
        case "ArrowRight":
            return RovingAction.ArrowRight;
        case "ArrowDown":
            return RovingAction.ArrowDown;
        default:
            return undefined;
    }
};

const getAdjacentNode = (state: IState, backwards: boolean, loop: boolean | undefined): HTMLElement | undefined => {
    if (!state.activeNode) return undefined;

    const currentIndex = state.nodes.indexOf(state.activeNode);
    if (currentIndex === -1) return undefined;

    const nextIndex = currentIndex + (backwards ? -1 : 1);
    return backwards
        ? findPreviousSiblingElement(state.nodes, nextIndex, loop)
        : findNextSiblingElement(state.nodes, nextIndex, loop);
};

const getTargetNode = (
    event: React.KeyboardEvent,
    state: IState,
    {
        handleHomeEnd,
        handleLeftRight,
        handleLoop,
        handleUpDown,
    }: Pick<
        React.ComponentProps<typeof RovingTabIndexProvider>,
        "handleHomeEnd" | "handleLeftRight" | "handleLoop" | "handleUpDown"
    >,
): HTMLElement | undefined => {
    switch (getAction(event)) {
        case RovingAction.Home:
            return handleHomeEnd ? findNextSiblingElement(state.nodes, 0) : undefined;
        case RovingAction.End:
            return handleHomeEnd ? findPreviousSiblingElement(state.nodes, state.nodes.length - 1) : undefined;
        case RovingAction.ArrowRight:
            return handleLeftRight ? getAdjacentNode(state, false, handleLoop) : undefined;
        case RovingAction.ArrowDown:
            return handleUpDown ? getAdjacentNode(state, false, handleLoop) : undefined;
        case RovingAction.ArrowLeft:
            return handleLeftRight ? getAdjacentNode(state, true, handleLoop) : undefined;
        case RovingAction.ArrowUp:
            return handleUpDown ? getAdjacentNode(state, true, handleLoop) : undefined;
        default:
            return undefined;
    }
};

function RovingButton({
    label,
    onActiveLabelChange,
}: Readonly<{ label: string; onActiveLabelChange?: (label: string) => void }>): JSX.Element {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>();

    return (
        <button
            ref={ref}
            style={buttonStyle}
            tabIndex={isActive ? 0 : -1}
            onFocus={() => {
                onFocus();
                onActiveLabelChange?.(label);
            }}
        >
            {label}
        </button>
    );
}

function MultipleToolbarExample({
    toolbars,
    handleHomeEnd,
    handleLeftRight,
    handleLoop,
}: Readonly<{
    toolbars: Array<{
        label: string;
        items: string[];
    }>;
    handleHomeEnd?: boolean;
    handleLeftRight?: boolean;
    handleLoop?: boolean;
}>): JSX.Element {
    return (
        <RovingTabIndexProvider handleHomeEnd={handleHomeEnd} handleLeftRight={handleLeftRight} handleLoop={handleLoop}>
            {({ onKeyDownHandler }) => (
                <div style={containerStyle}>
                    {toolbars.map((toolbar, index) => (
                        <section style={containerStyle} key={toolbar.label}>
                            <span id={`toolbar-label-${index}`} style={toolbarLabelStyle}>
                                {toolbar.label}
                            </span>
                            <div
                                role="toolbar"
                                aria-labelledby={`toolbar-label-${index}`}
                                onKeyDown={onKeyDownHandler}
                                style={toolbarStyle}
                            >
                                {toolbar.items.map((label) => (
                                    <RovingButton key={label} label={label} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </RovingTabIndexProvider>
    );
}

function RovingTabIndexExample({
    labels,
    handleHomeEnd,
    handleInputFields,
    handleLeftRight,
    handleLoop,
    handleUpDown,
    orientation = "horizontal",
    withInput,
}: Readonly<{
    labels: string[];
    handleHomeEnd?: boolean;
    handleInputFields?: boolean;
    handleLeftRight?: boolean;
    handleLoop?: boolean;
    handleUpDown?: boolean;
    orientation?: "horizontal" | "vertical";
    withInput?: boolean;
}>): JSX.Element {
    const [activeLabel, setActiveLabel] = useState(labels[0]);
    const onKeyDown = (event: React.KeyboardEvent, state: IState, dispatch: React.Dispatch<IAction>): void => {
        const target = getTargetNode(event, state, { handleHomeEnd, handleLeftRight, handleLoop, handleUpDown });
        if (!target) return;

        setActiveLabel(target.textContent ?? "");

        if (event.target instanceof HTMLElement && withInput && checkInputableElement(event.target)) {
            event.preventDefault();
            event.stopPropagation();
            dispatch({
                type: RovingStateActionType.SetFocus,
                payload: {
                    node: target,
                },
            });
        }
    };

    return (
        <RovingTabIndexProvider
            handleHomeEnd={handleHomeEnd}
            handleInputFields={handleInputFields}
            handleLeftRight={handleLeftRight}
            handleLoop={handleLoop}
            handleUpDown={handleUpDown}
            onKeyDown={onKeyDown}
        >
            {({ onKeyDownHandler }) => (
                <div style={containerStyle}>
                    {withInput && (
                        <input
                            aria-label="Toolbar input"
                            onKeyDown={onKeyDownHandler}
                            placeholder="Focus stays here; use arrow keys"
                        />
                    )}
                    {withInput && <span style={activeLabelStyle}>Active item: {activeLabel}</span>}
                    <div
                        role="toolbar"
                        aria-label="Example roving toolbar"
                        aria-orientation={orientation}
                        onKeyDown={onKeyDownHandler}
                        style={orientation === "vertical" ? verticalToolbarStyle : toolbarStyle}
                    >
                        {labels.map((label) => (
                            <RovingButton key={label} label={label} onActiveLabelChange={setActiveLabel} />
                        ))}
                    </div>
                </div>
            )}
        </RovingTabIndexProvider>
    );
}

const RovingTabIndexWrapper = withViewDocs(RovingTabIndexExample, RovingTabIndexProvider);

const meta = {
    title: "Core/RovingTabIndex",
    component: RovingTabIndexWrapper,
    tags: ["autodocs", "skip-test"],
    args: {
        labels: [],
        handleHomeEnd: true,
        handleLoop: true,
        handleLeftRight: true,
        handleUpDown: true,
    },
    argTypes: {
        handleHomeEnd: {
            control: "boolean",
        },
        handleInputFields: {
            control: false,
            table: {
                disable: true,
            },
        },
        handleLeftRight: {
            control: "boolean",
        },
        handleLoop: {
            control: "boolean",
        },
        handleUpDown: {
            control: "boolean",
        },
        orientation: {
            control: false,
            table: {
                disable: true,
            },
        },
        withInput: {
            control: false,
            table: {
                disable: true,
            },
        },
    },
} satisfies Meta<typeof RovingTabIndexWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HorizontalToolbar: Story = {
    args: {
        labels: ["One", "Two", "Three", "Four"],
        handleHomeEnd: true,
        handleLeftRight: true,
    },
};

export const LoopingToolbar: Story = {
    args: {
        labels: ["One", "Two", "Three", "Four"],
        handleHomeEnd: true,
        handleLeftRight: true,
        handleLoop: true,
    },
};

export const VerticalToolbar: Story = {
    args: {
        labels: ["One", "Two", "Three", "Four"],
        handleHomeEnd: true,
        handleLeftRight: false,
        handleUpDown: true,
        orientation: "vertical",
    },
};

export const WithInput: Story = {
    args: {
        labels: ["One", "Two", "Three", "Four"],
        handleHomeEnd: true,
        handleLeftRight: true,
        handleInputFields: false,
        withInput: true,
    },
};

export const MultipleToolbars: StoryObj<typeof MultipleToolbarExample> = {
    render: (args) => <MultipleToolbarExample {...args} />,
    args: {
        toolbars: [
            {
                label: "Formatting toolbar",
                items: ["Bold", "Italic", "Underline"],
            },
            {
                label: "Insert toolbar",
                items: ["Link", "Image", "Table"],
            },
        ],
        handleHomeEnd: true,
        handleLeftRight: true,
    },
};
