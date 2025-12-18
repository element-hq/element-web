/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { screen, render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "@vector-im/compound-web";
import { composeStories } from "@storybook/react-vite";
import TriggerIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import {
    type WidgetContextMenuAction,
    type WidgetContextMenuSnapshot,
    WidgetContextMenuView,
} from "./WidgetContextMenuView";
import * as stories from "./WidgetContextMenuView.stories.tsx";
import { MockViewModel } from "../../viewmodel/MockViewModel.ts";

const { Default, OnlyBasicModification } = composeStories(stories);

describe("<WidgetContextMenuView />", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("renders widget contextmenu with all options", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders widget contextmenu without only basic modification", () => {
        const { container } = render(<OnlyBasicModification />);
        expect(container).toMatchSnapshot();
    });

    const onKeyDown = jest.fn();
    const togglePlay = jest.fn();
    const onSeekbarChange = jest.fn();

    const onStreamAudioClick = jest.fn();
    const onEditClick = jest.fn();
    const onSnapshotClick = jest.fn();
    const onDeleteClick = jest.fn();
    const onRevokeClick = jest.fn();
    const onFinished = jest.fn();
    const onMoveButton = jest.fn();
    class WidgetContextMenuViewModel
        extends MockViewModel<WidgetContextMenuSnapshot>
        implements WidgetContextMenuAction
    {
        public onKeyDown = onKeyDown;
        public togglePlay = togglePlay;
        public onSeekbarChange = onSeekbarChange;

        public onStreamAudioClick = onStreamAudioClick;
        public onEditClick = onEditClick;
        public onSnapshotClick = onSnapshotClick;
        public onDeleteClick = onDeleteClick;
        public onRevokeClick = onRevokeClick;
        public onFinished = onFinished;
        public onMoveButton = onMoveButton;
    }

    const defaultValue: WidgetContextMenuSnapshot = {
        showStreamAudioStreamButton: true,
        showEditButton: true,
        showRevokeButton: true,
        showDeleteButton: true,
        showSnapshotButton: true,
        showMoveButtons: [true, true],
        canModify: true,
        isMenuOpened: true,
        userWidget: false,
        trigger: (
            <IconButton size="24px" aria-label="context menu trigger button">
                <TriggerIcon />
            </IconButton>
        ),
    };

    it("should attach vm methods", async () => {
        const vm = new WidgetContextMenuViewModel(defaultValue);

        render(<WidgetContextMenuView vm={vm} />);

        await userEvent.click(screen.getByRole("menuitem", { name: "Start audio stream" }));
        expect(onStreamAudioClick).toHaveBeenCalled();

        await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
        expect(onEditClick).toHaveBeenCalled();

        await userEvent.click(screen.getByRole("menuitem", { name: "Take a picture" }));
        expect(onSnapshotClick).toHaveBeenCalled();

        await userEvent.click(screen.getByRole("menuitem", { name: "Revoke permissions" }));
        expect(onRevokeClick).toHaveBeenCalled();

        await userEvent.click(screen.getByRole("menuitem", { name: "Remove for everyone" }));
        expect(onDeleteClick).toHaveBeenCalled();

        await userEvent.click(screen.getByRole("menuitem", { name: "Move left" }));
        expect(onMoveButton).toHaveBeenCalledWith(-1);

        await userEvent.click(screen.getByRole("menuitem", { name: "Move right" }));
        expect(onMoveButton).toHaveBeenCalledWith(1);
    });
});
