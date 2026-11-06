/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { MenuItem, SubMenu } from "@vector-im/compound-web";
import {
    NotificationsSolidIcon,
    NotificationsOffSolidIcon,
    CheckIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../core/i18n/i18n";
import { RoomNotifState } from "./RoomNotifs";
import { useViewModel, type ViewModel } from "../../../../core/viewmodel";
import type { RoomListItemViewSnapshot, RoomListItemViewActions } from "./RoomListItemView";

/**
 * View model type for room list item
 */
export type RoomListItemViewModel = ViewModel<RoomListItemViewSnapshot, RoomListItemViewActions>;

/**
 * Props for RoomListItemNotificationMenu component
 */
export interface RoomListItemNotificationMenuProps {
    /** The room item view model */
    vm: RoomListItemViewModel;
}

/**
 * The notification settings of a room list item, Normal or Silent, as a submenu of the more options menu.
 * The bell on its entry is crossed out when the room is muted.
 */
export function RoomListItemNotificationMenu({ vm }: RoomListItemNotificationMenuProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const isMuted = snapshot.roomNotifState === RoomNotifState.Mute;
    const checkComponent = <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-primary)" />;

    // Normal follows the account-wide notification settings, Silent mutes the room completely (mentions and
    // keywords included). A room set to another state elsewhere has neither option checked.
    const options: { state: RoomNotifState; label: string }[] = [
        { state: RoomNotifState.AllMessages, label: _t("room_list|notification_options_normal") },
        { state: RoomNotifState.Mute, label: _t("room_list|notification_options_silent") },
    ];

    return (
        <SubMenu
            trigger={
                <MenuItem
                    Icon={isMuted ? NotificationsOffSolidIcon : NotificationsSolidIcon}
                    label={_t("room_list|notification_options")}
                    onSelect={null}
                />
            }
        >
            {options.map(({ state, label }) => (
                <MenuItem
                    key={state}
                    aria-selected={snapshot.roomNotifState === state}
                    hideChevron={true}
                    label={label}
                    onSelect={() => vm.onSetRoomNotifState(state)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {snapshot.roomNotifState === state && checkComponent}
                </MenuItem>
            ))}
        </SubMenu>
    );
}
