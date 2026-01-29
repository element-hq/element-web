/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode, type JSX } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import TriggerIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import { type ViewModel } from "../../viewmodel/ViewModel.ts";
import { useI18n } from "../../utils/i18nContext.ts";
import { useViewModel } from "../../viewmodel/useViewModel.ts";

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
    /**
     * If it's an instance of a user widget
     */
    userWidget: boolean;
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

/**
 * A context menu component used to display the correct items that needs to be displayed for a widget item menu
 */
export const WidgetContextMenuView: React.FC<WidgetContextMenuViewProps> = ({ vm }) => {
    const { translate: _t } = useI18n();

    const {
        showStreamAudioStreamButton,
        showEditButton,
        showSnapshotButton,
        showDeleteButton,
        showRevokeButton,
        showMoveButtons,
        isMenuOpened,
        userWidget,
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
                label={userWidget ? _t("action|remove") : _t("widget|context_menu|remove")}
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

    // Only render menu items when the menu is open to prevent focusable elements in aria-hidden container
    const renderMenuItems = (): React.ReactNode => {
        if (!isMenuOpened) return null;
        return (
            <>
                {streamAudioStreamButton}
                {editButton}
                {revokeButton}
                {deleteButton}
                {snapshotButton}
                {moveLeftButton}
                {moveRightButton}
            </>
        );
    };

    // Default trigger icon if no valid trigger element was passed
    const wrappedTrigger = React.isValidElement(trigger) ? (
        trigger
    ) : (
        <IconButton size="24px" aria-label="context menu trigger button" inert={true} tabIndex={-1}>
            <TriggerIcon />
        </IconButton>
    );

    return (
        <Menu
            title="Widget context menu"
            open={isMenuOpened}
            showTitle={false}
            side="right"
            align="start"
            trigger={wrappedTrigger}
            onOpenChange={vm.onFinished}
        >
            {renderMenuItems()}
        </Menu>
    );
};
