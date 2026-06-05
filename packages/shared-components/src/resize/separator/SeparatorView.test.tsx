/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, vi } from "vitest";
import { userEvent } from "vitest/browser";

import * as stories from "./SeparatorView.stories";
import { BaseViewModel } from "../../core/viewmodel";
import { ResizableGroup, Panel, type ResizerViewSnapshot, SeparatorView, type SeparatorViewActions } from "..";

const { Default, LeftPanelExpanded, KeyboardFocused, HoverWhenCollapsed, HoverWhenExpanded } = composeStories(stories);

class MockViewModel extends BaseViewModel<ResizerViewSnapshot, unknown> implements SeparatorViewActions {
    public constructor(snapshot: ResizerViewSnapshot) {
        super(undefined, snapshot);
    }
    public onPointerUp: () => void = vi.fn();
    public onPointerMove: () => void = vi.fn();
    public onPointerDown: () => void = vi.fn();
    public onDoubleClick: () => void = vi.fn();
}

function renderPanel(initialSnapshot?: Partial<ResizerViewSnapshot>): MockViewModel {
    const snapshot = { isCollapsed: true, isFocusedViaKeyboard: false, initialSize: 20, ...initialSnapshot };
    const vm = new MockViewModel(snapshot);
    render(
        <ResizableGroup>
            <Panel>Left</Panel>
            <SeparatorView vm={vm} />
            <Panel>Test</Panel>
        </ResizableGroup>,
    );
    return vm;
}

describe("<SeparatorView />", () => {
    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders LeftPanelExpanded story", () => {
        const { container } = render(<LeftPanelExpanded />);
        expect(container).toMatchSnapshot();
    });

    it("renders KeyboardFocused story", () => {
        const { container } = render(<KeyboardFocused />);
        expect(container).toMatchSnapshot();
    });

    it("renders HoverWhenCollapsed story", () => {
        const { container } = render(<HoverWhenCollapsed />);
        expect(container).toMatchSnapshot();
    });

    it("renders HoverWhenExpanded story", () => {
        const { container } = render(<HoverWhenExpanded />);
        expect(container).toMatchSnapshot();
    });

    it("should call onPointerDown and onPointerUp on pointer events", async () => {
        const vm = renderPanel();
        const separator = screen.getByRole("separator");
        await userEvent.click(separator);
        expect(vm.onPointerDown).toHaveBeenCalledOnce();
        expect(vm.onPointerUp).toHaveBeenCalledOnce();
    });

    it("should call onDoubleClick on double click", async () => {
        const vm = renderPanel();
        const separator = screen.getByRole("separator");
        await userEvent.dblClick(separator);
        expect(vm.onDoubleClick).toHaveBeenCalledOnce();
    });
});
