/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode, type JSX } from "react";
import { Menu, MenuItem } from "@vector-im/compound-web";

import { _t } from "../../utils/i18n.tsx";
import { type ViewModel } from "../../viewmodel/ViewModel.ts";
import { useViewModel } from "../../useViewModel.ts";

export interface WidgetContextMenuSnapshot {
    /**
     * Indicates if the audio stream button needs to be shown or not
     * depending on the config value audio_stream_url and widget type jitsi
     */
    showStreamAudioStreamButton: boolean;
    /**
     * Indicates if the edit button is shown depending the user permission to modify
     */
    showEditButton: boolean;
    /**
     * Indicates if revoke widget button needs to be shown or not
     */
    showRevokeButton: boolean;
    /**
     * Indicates if delete widget button needs to be shown or not
     */
    showDeleteButton: boolean;
    /**
     * Show take screenshot button or not dependning on config value enableWidgetScreenshots
     */
    showSnapshotButton: boolean;
    /**
     * show move widget position button
     */
    showMoveButtons: [boolean, boolean];
    /**
     * Indicates if user can modify the widget settings
     */
    canModify: boolean;
    /**
     * Indicates if the widget menu is opened or not
     */
    isMenuOpened: boolean;
    /**
     * A component that is displayed which trigger the menu to open or close
     */
    trigger: ReactNode;
}

export interface WidgetContextMenuAction {
    /**
     * Function triggered when stream audio is clicked
     */
    onStreamAudioClick: () => Promise<void>;
    /**
     * Function triggered when edit button is clicked
     */
    onEditClick: () => void;
    /**
     * Function triggered when snapshot button is clicked
     */
    onSnapshotClick: () => void;
    /**
     * Function triggered when delete button is clicked
     */
    onDeleteClick: () => void;
    /**
     * Function triggered when revoke button is clicked
     */
    onRevokeClick: () => void;
    /**
     * Called when the action is finished, to close the menu
     */
    onFinished: () => void;
    /**
     * Button used to move up or down in the list the widget position
     * @param direction 1 or -1
     */
    onMoveButton: (direction: number) => void;
}

export type WidgetContextMenuViewModel = ViewModel<WidgetContextMenuSnapshot> & WidgetContextMenuAction;

interface WidgetContextMenuViewProps {
    vm: WidgetContextMenuViewModel;
}

export const WidgetContextMenuView: React.FC<WidgetContextMenuViewProps> = ({ vm }) => {
    const {
        showStreamAudioStreamButton,
        showEditButton,
        showSnapshotButton,
        showDeleteButton,
        showRevokeButton,
        showMoveButtons,
        isMenuOpened,
        trigger,
    } = useViewModel(vm);

    let streamAudioStreamButton: JSX.Element | undefined;
    if (showStreamAudioStreamButton) {
        streamAudioStreamButton = (
            <MenuItem onSelect={vm.onStreamAudioClick} label={_t("widget|context_menu|start_audio_stream")} />
        );
    }

    let editButton: JSX.Element | undefined;
    if (showEditButton) {
        editButton = <MenuItem onSelect={vm.onEditClick} label={_t("action|edit")} />;
    }

    let snapshotButton: JSX.Element | undefined;
    if (showSnapshotButton) {
        snapshotButton = <MenuItem onSelect={vm.onSnapshotClick} label={_t("widget|context_menu|screenshot")} />;
    }

    let deleteButton: JSX.Element | undefined;
    if (showDeleteButton) {
        deleteButton = (
            <MenuItem
                onSelect={vm.onDeleteClick}
                // TODO label={userWidget ? _t("action|remove") : _t("widget|context_menu|remove")}
                label={_t("widget|context_menu|remove")}
            />
        );
    }

    let revokeButton: JSX.Element | undefined;
    if (showRevokeButton) {
        revokeButton = <MenuItem onSelect={vm.onRevokeClick} label={_t("widget|context_menu|revoke")} />;
    }

    const [showMoveLeftButton, showMoveRightButton] = showMoveButtons;
    let moveLeftButton: JSX.Element | undefined;
    if (showMoveLeftButton) {
        moveLeftButton = <MenuItem onSelect={() => vm.onMoveButton(-1)} label={_t("widget|context_menu|move_left")} />;
    }

    let moveRightButton: JSX.Element | undefined;
    if (showMoveRightButton) {
        moveRightButton = <MenuItem onSelect={() => vm.onMoveButton(1)} label={_t("widget|context_menu|move_right")} />;
    }

    return (
        <Menu
            title="Widget context menu"
            open={isMenuOpened}
            showTitle={false}
            side="right"
            align="start"
            trigger={trigger}
            onOpenChange={vm.onFinished}
        >
            {streamAudioStreamButton}
            {editButton}
            {revokeButton}
            {deleteButton}
            {snapshotButton}
            {moveLeftButton}
            {moveRightButton}
        </Menu>
    );
};
