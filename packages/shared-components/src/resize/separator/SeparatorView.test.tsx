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
import { BaseViewModel } from "../../viewmodel";
import { Group, Panel, type ResizerSnapshot, SeparatorView, type SeparatorViewActions } from "..";

const { Default, LeftPanelExpanded, KeyboardFocused } = composeStories(stories);

class MockViewModel extends BaseViewModel<ResizerSnapshot, unknown> implements SeparatorViewActions {
    public constructor(snapshot: ResizerSnapshot) {
        super(undefined, snapshot);
    }
    public onBlur: () => void = vi.fn();
    public onFocus: () => void = vi.fn();
    public onSeparatorClick: () => void = vi.fn();
}

function renderPanel(initialSnapshot?: Partial<ResizerSnapshot>): MockViewModel {
    const snapshot = { isCollapsed: true, isFocusedViaKeyboard: false, initialSize: 20, ...initialSnapshot };
    const vm = new MockViewModel(snapshot);
    render(
        <Group>
            <Panel>Left</Panel>
            <SeparatorView vm={vm} />
            <Panel>Test</Panel>
        </Group>,
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

    it("should call onSeparatorClick() when clicked", async () => {
        const vm = renderPanel();
        const separator = screen.getByRole("separator");
        await userEvent.click(separator);
        expect(vm.onSeparatorClick).toHaveBeenCalledOnce();
    });

    it("should call onFocus and onBlur when receiving/loosing focus", async () => {
        const vm = renderPanel();
        const separator = screen.getByRole("separator");
        separator.focus();
        expect(vm.onFocus).toHaveBeenCalled();
        separator.blur();
        expect(vm.onBlur).toHaveBeenCalled();
    });
});
