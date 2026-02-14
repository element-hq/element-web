/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import {
    NotificationsSolidIcon,
    NotificationsOffSolidIcon,
    CheckIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../utils/i18n";
import { RoomNotifState } from "./RoomNotifs";
import { useViewModel, type ViewModel } from "../../viewmodel";
import type { RoomListItemSnapshot, RoomListItemActions } from "./RoomListItemView";

/**
 * View model type for room list item
 */
export type RoomItemViewModel = ViewModel<RoomListItemSnapshot> & RoomListItemActions;

/**
 * Props for RoomListItemNotificationMenu component
 */
export interface RoomListItemNotificationMenuProps {
    /** The room item view model */
    vm: RoomItemViewModel;
}

/**
 * The notification settings menu for room list items.
 * Displays options to change notification settings.
 */
export function RoomListItemNotificationMenu({ vm }: RoomListItemNotificationMenuProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const [open, setOpen] = useState(false);
    const isMuted = snapshot.roomNotifState === RoomNotifState.Mute;
    const checkComponent = <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-primary)" />;

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|notification_options")}
            showTitle={false}
            align="start"
            trigger={
                <IconButton
                    size="24px"
                    style={{ padding: "2px" }}
                    tooltip={_t("room_list|notification_options")}
                    aria-label={_t("room_list|notification_options")}
                >
                    {isMuted ? <NotificationsOffSolidIcon /> : <NotificationsSolidIcon />}
                </IconButton>
            }
        >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
                // We don't want keyboard navigation events to bubble up to the ListView changing the focused item
                onKeyDown={(e) => e.stopPropagation()}
            >
                <MenuItem
                    aria-selected={snapshot.roomNotifState === RoomNotifState.AllMessages}
                    hideChevron={true}
                    label={_t("notifications|default_settings")}
                    onSelect={() => vm.onSetRoomNotifState(RoomNotifState.AllMessages)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {snapshot.roomNotifState === RoomNotifState.AllMessages && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={snapshot.roomNotifState === RoomNotifState.AllMessagesLoud}
                    hideChevron={true}
                    label={_t("notifications|all_messages")}
                    onSelect={() => vm.onSetRoomNotifState(RoomNotifState.AllMessagesLoud)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {snapshot.roomNotifState === RoomNotifState.AllMessagesLoud && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={snapshot.roomNotifState === RoomNotifState.MentionsOnly}
                    hideChevron={true}
                    label={_t("notifications|mentions_keywords")}
                    onSelect={() => vm.onSetRoomNotifState(RoomNotifState.MentionsOnly)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {snapshot.roomNotifState === RoomNotifState.MentionsOnly && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={snapshot.roomNotifState === RoomNotifState.Mute}
                    hideChevron={true}
                    label={_t("notifications|mute_room")}
                    onSelect={() => vm.onSetRoomNotifState(RoomNotifState.Mute)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {snapshot.roomNotifState === RoomNotifState.Mute && checkComponent}
                </MenuItem>
            </div>
        </Menu>
    );
}
