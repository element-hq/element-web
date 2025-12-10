/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, useCallback, type JSX } from "react";
import { IconButton, Menu, MenuTitle, Tooltip, RadioMenuItem } from "@vector-im/compound-web";
import OverflowHorizontalIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import { _t } from "../../utils/i18n";

/**
 * Sort option enum
 */
export enum SortOption {
    Activity = "activity",
    AToZ = "atoz",
}

/**
 * Snapshot for SortOptionsMenu
 */
export type SortOptionsMenuProps = {
    /** The currently active sort option */
    activeSortOption: SortOption;
    /** Change the sort order of the room-list */
    sort: (option: SortOption) => void;
};

const MenuTrigger = (props: React.ComponentProps<typeof IconButton>): JSX.Element => (
    <Tooltip label={_t("room_list|room_options")}>
        <IconButton aria-label={_t("room_list|room_options")} {...props}>
            <OverflowHorizontalIcon color="var(--cpd-color-icon-secondary)" />
        </IconButton>
    </Tooltip>
);

/**
 * The sort options menu for the room list header.
 * Displays a dropdown menu with options to sort rooms by activity or alphabetically.
 */
export const SortOptionsMenu: React.FC<SortOptionsMenuProps> = ({ activeSortOption, sort }): JSX.Element => {
    const [open, setOpen] = useState(false);

    const onActivitySelected = useCallback(() => {
        sort(SortOption.Activity);
    }, [sort]);

    const onAtoZSelected = useCallback(() => {
        sort(SortOption.AToZ);
    }, [sort]);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|room_options")}
            showTitle={false}
            align="start"
            trigger={<MenuTrigger />}
        >
            <MenuTitle title={_t("room_list|sort")} />
            <RadioMenuItem
                label={_t("room_list|sort_type|activity")}
                checked={activeSortOption === SortOption.Activity}
                onSelect={onActivitySelected}
            />
            <RadioMenuItem
                label={_t("room_list|sort_type|atoz")}
                checked={activeSortOption === SortOption.AToZ}
                onSelect={onAtoZSelected}
            />
        </Menu>
    );
};
