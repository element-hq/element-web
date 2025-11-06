/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { ReactNode, type JSX } from "react";
import { type ClientWidgetApi } from "matrix-widget-api";
import { Menu, MenuItem } from "@vector-im/compound-web";

import { _t } from "../../utils/i18n.tsx";
import { type ViewModel } from "../../viewmodel/ViewModel.ts";
import { useViewModel } from "../../useViewModel.ts";

export interface WidgetContextMenuSnapshot {
    showStreamAudioStreamButton: boolean;
    showEditButton: boolean;
    showRevokeButton: boolean;
    showDeleteButton: boolean;
    showSnapshotButton: boolean;
    showMoveButtons: [boolean, boolean];
    canModify: boolean;
    widgetMessaging: ClientWidgetApi | undefined;
    isMenuOpened: boolean;
    trigger: ReactNode;
}

export interface WidgetContextMenuAction {
    onStreamAudioClick: () => Promise<void>;
    onEditClick: () => void;
    onSnapshotClick: () => void;
    onDeleteClick: () => void;
    onRevokeClick: () => void;
    onFinished: () => void;
    onMoveButton: (direction: number) => void;
}

export type WidgetContextMenuViewModel = ViewModel<WidgetContextMenuSnapshot> & WidgetContextMenuAction;

interface WidgetContextMenuViewProps {
    vm: WidgetContextMenuViewModel;
}

export const WidgetContextMenuView: React.FC<WidgetContextMenuViewProps> = ({
   vm
}) => {

    const {
        showStreamAudioStreamButton,
        showEditButton,
        showSnapshotButton,
        showDeleteButton,
        showRevokeButton,
        showMoveButtons,
        isMenuOpened,
        trigger,
    }= useViewModel(vm);

    let streamAudioStreamButton: JSX.Element | undefined;
    if (showStreamAudioStreamButton) {
        streamAudioStreamButton = (
            <MenuItem
                onSelect={vm.onStreamAudioClick}
                label={_t("widget|context_menu|start_audio_stream")}
            />
        );
    }

    let editButton: JSX.Element | undefined;
    if (showEditButton) {
        editButton = <MenuItem onSelect={vm.onEditClick} label={_t("action|edit")} />;
    }

    let snapshotButton: JSX.Element | undefined;
    if (showSnapshotButton) {
        snapshotButton = (
            <MenuItem onSelect={vm.onSnapshotClick} label={_t("widget|context_menu|screenshot")} />
        );
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
        revokeButton = (
            <MenuItem onSelect={vm.onRevokeClick} label={_t("widget|context_menu|revoke")} />
        );
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
