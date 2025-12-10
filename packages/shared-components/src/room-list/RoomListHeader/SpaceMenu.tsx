/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import HomeIcon from "@vector-im/compound-design-tokens/assets/web/icons/home";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import PreferencesIcon from "@vector-im/compound-design-tokens/assets/web/icons/preferences";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";

import { _t } from "../../utils/i18n";

/**
 * Props for SpaceMenu component
 */
export interface SpaceMenuProps {
    /** The title of the space */
    title: string;
    /** Whether the user can invite in the space */
    canInviteInSpace: boolean;
    /** Whether the user can access space settings */
    canAccessSpaceSettings: boolean;
    /** Open the space home */
    openSpaceHome: () => void;
    /** Display the space invite dialog */
    inviteInSpace: () => void;
    /** Open the space preferences */
    openSpacePreferences: () => void;
    /** Open the space settings */
    openSpaceSettings: () => void;
}

/**
 * @deprecated Use SpaceMenuProps instead
 */
export type SpaceMenuSnapshot = SpaceMenuProps;

/**
 * The space menu for the room list header.
 * Displays a dropdown menu with space-specific actions.
 */
export const SpaceMenu: React.FC<SpaceMenuProps> = ({
    title,
    canInviteInSpace,
    canAccessSpaceSettings,
    openSpaceHome,
    inviteInSpace,
    openSpacePreferences,
    openSpaceSettings,
}): JSX.Element => {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={title}
            side="right"
            align="start"
            trigger={
                <IconButton className="mx_SpaceMenu_button" aria-label={_t("room_list|open_space_menu")} size="20px">
                    <ChevronDownIcon color="var(--cpd-color-icon-secondary)" />
                </IconButton>
            }
        >
            <MenuItem
                Icon={HomeIcon}
                label={_t("room_list|space_menu|home")}
                onSelect={openSpaceHome}
                hideChevron={true}
            />
            {canInviteInSpace && (
                <MenuItem Icon={UserAddIcon} label={_t("action|invite")} onSelect={inviteInSpace} hideChevron={true} />
            )}
            <MenuItem
                Icon={PreferencesIcon}
                label={_t("common|preferences")}
                onSelect={openSpacePreferences}
                hideChevron={true}
            />
            {canAccessSpaceSettings && (
                <MenuItem
                    Icon={SettingsIcon}
                    label={_t("room_list|space_menu|space_settings")}
                    onSelect={openSpaceSettings}
                    hideChevron={true}
                />
            )}
        </Menu>
    );
};
