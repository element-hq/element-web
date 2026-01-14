/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { IconButton, Menu, MenuTitle, RadioMenuItem } from "@vector-im/compound-web";
import React, { type JSX, useState } from "react";
import OverflowHorizontalIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import { type RoomListHeaderViewModel } from "../RoomListHeaderView";
import { useViewModel } from "../../../useViewModel";
import { useI18n } from "../../../utils/i18nContext";
import styles from "./OptionMenuView.module.css";

interface OptionMenuViewProps {
    /**
     * The view model for the room list header
     */
    vm: RoomListHeaderViewModel;
}

/**
 * A menu component that provides sorting options for the room list.
 * Displays a dropdown menu with radio buttons to sort rooms by activity or alphabetically.
 *
 * @example
 * ```tsx
 * <OptionMenuView vm={roomListHeaderViewModel} />
 * ```
 */
export function OptionMenuView({ vm }: OptionMenuViewProps): JSX.Element {
    const { translate: _t } = useI18n();
    const [open, setOpen] = useState(false);
    const { activeSortOption } = useViewModel(vm);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|room_options")}
            showTitle={false}
            align="start"
            trigger={
                <IconButton
                    tooltip={_t("room_list|room_options")}
                    aria-label={_t("room_list|room_options")}
                    size="28px"
                >
                    <OverflowHorizontalIcon />
                </IconButton>
            }
        >
            <MenuTitle title={_t("room_list|sort")} className={styles.title} />
            <RadioMenuItem
                label={_t("room_list|sort_type|activity")}
                checked={activeSortOption === "recent"}
                onSelect={() => vm.sort("recent")}
            />
            <RadioMenuItem
                label={_t("room_list|sort_type|atoz")}
                checked={activeSortOption === "alphabetical"}
                onSelect={() => vm.sort("alphabetical")}
            />
        </Menu>
    );
}
