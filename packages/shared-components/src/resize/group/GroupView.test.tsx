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

import * as stories from "./GroupView.stories";
import { BaseViewModel } from "../../viewmodel";
import { GroupView, type GroupViewActions, Panel, Separator } from "..";

const { Default } = composeStories(stories);

class MockViewModel extends BaseViewModel<unknown, unknown> implements GroupViewActions {
    public constructor() {
        super(undefined, undefined);
    }

    public onLeftPanelResized: (newSize: number) => void = vi.fn();
}

function renderPanel(): MockViewModel {
    const vm = new MockViewModel();
    render(
        <GroupView vm={vm}>
            <Panel>Test</Panel>
            <Separator />
            <Panel>Test</Panel>
        </GroupView>,
    );
    return vm;
}

describe("<GroupView />", () => {
    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
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
        expect(vm.onLeftPanelResized).toHaveBeenCalledOnce();
    });
});
