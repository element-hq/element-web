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
import userEvent from "@testing-library/user-event";

import * as stories from "./LeftResizablePanelView.stories";
import { BaseViewModel } from "../../viewmodel";
import {
    Group,
    LEFT_PANEL_ID,
    LeftResizablePanelView,
    type LeftResizablePanelViewActions,
    Panel,
    type PanelImperativeHandle,
    type PanelSize,
    type ResizerViewSnapshot,
    Separator,
} from "..";

const { Default } = composeStories(stories);

class MockViewModel extends BaseViewModel<ResizerViewSnapshot, unknown> implements LeftResizablePanelViewActions {
    public constructor(snapshot: ResizerViewSnapshot) {
        super(undefined, snapshot);
    }

    public onLeftPanelResize: (panelSize: PanelSize) => void = vi.fn();
    public setPanelHandle: (handle: PanelImperativeHandle) => void = vi.fn();
}

function renderPanel(initialSnapshot?: Partial<ResizerViewSnapshot>): MockViewModel {
    const snapshot = { isCollapsed: false, isFocusedViaKeyboard: false, initialSize: 20, ...initialSnapshot };
    const vm = new MockViewModel(snapshot);
    render(
        <Group>
            <LeftResizablePanelView vm={vm}>Left</LeftResizablePanelView>
            <Separator />
            <Panel>Test</Panel>
        </Group>,
    );
    return vm;
}

describe("<LeftResizablePanelView />", () => {
    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("should call setPanelHandle", () => {
        const vm = renderPanel();
        expect(vm.setPanelHandle).toHaveBeenCalled();
    });

    it("should call onLeftPanelResize", async () => {
        const vm = renderPanel();
        const separator = screen.getByRole("separator");
        const user = userEvent.setup();
        await user.pointer([
            { target: separator, keys: "[MouseLeft>]" },
            { coords: { x: 400, y: 200 } },
            { keys: "[/MouseLeft]" },
        ]);
        expect(vm.onLeftPanelResize).toHaveBeenCalled();
    });

    it("should be inert when collapsed", () => {
        renderPanel({ isCollapsed: true });
        const panel = screen.getByTestId(LEFT_PANEL_ID);
        expect(panel.getAttribute("inert")).not.toBeNull();
    });
});
