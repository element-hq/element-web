/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import HomeIcon from "@vector-im/compound-design-tokens/assets/web/icons/home";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";
import PreferencesIcon from "@vector-im/compound-design-tokens/assets/web/icons/preferences";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";

import styles from "./SpaceMenuView.module.css";
import { useViewModel } from "../../../useViewModel";
import { useI18n } from "../../../utils/i18nContext";
import { type RoomListHeaderViewModel } from "../RoomListHeaderView";

interface SpaceMenuViewProps {
    /**
     * The view model for the room list header
     */
    vm: RoomListHeaderViewModel;
}

/**
 * A menu component that provides space-specific actions.
 * Displays a dropdown menu with options to navigate to space home, invite users,
 * access preferences, and manage space settings.
 *
 * @example
 * ```tsx
 * <SpaceMenuView vm={roomListHeaderViewModel} />
 * ```
 */
export function SpaceMenuView({ vm }: SpaceMenuViewProps): JSX.Element {
    const { translate: _t } = useI18n();
    const { canInviteInSpace, canAccessSpaceSettings, title } = useViewModel(vm);
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={title}
            align="start"
            trigger={
                <IconButton
                    className={styles.button}
                    aria-label={_t("room_list|open_space_menu")}
                    // 24px icon with a 20px icon
                    size="24px"
                    style={{ padding: "2px" }}
                >
                    <ChevronDownIcon />
                </IconButton>
            }
        >
            <MenuItem Icon={HomeIcon} label={_t("room_list|space_menu|home")} onSelect={vm.openSpaceHome} hideChevron />
            {canInviteInSpace && (
                <MenuItem Icon={UserAddIcon} label={_t("action|invite")} onSelect={vm.inviteInSpace} hideChevron />
            )}
            <MenuItem
                Icon={PreferencesIcon}
                label={_t("common|preferences")}
                onSelect={vm.openSpacePreferences}
                hideChevron
            />
            {canAccessSpaceSettings && (
                <MenuItem
                    Icon={SettingsIcon}
                    label={_t("room_list|space_menu|space_settings")}
                    onSelect={vm.openSpaceSettings}
                    hideChevron
                />
            )}
        </Menu>
    );
}
