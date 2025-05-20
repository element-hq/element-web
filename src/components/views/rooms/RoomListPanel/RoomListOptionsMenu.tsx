/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { IconButton, Menu, MenuTitle, CheckboxMenuItem, Tooltip, RadioMenuItem } from "@vector-im/compound-web";
import React, { type Ref, type JSX, useState, useCallback } from "react";
import FilterIcon from "@vector-im/compound-design-tokens/assets/web/icons/filter";

import { _t } from "../../../../languageHandler";
import { SortOption } from "../../../viewmodels/roomlist/useSorter";
import { type RoomListHeaderViewState } from "../../../viewmodels/roomlist/RoomListHeaderViewModel";

interface MenuTriggerProps extends React.ComponentProps<typeof IconButton> {
    ref?: Ref<HTMLButtonElement>;
}

const MenuTrigger = ({ ref, ...props }: MenuTriggerProps): JSX.Element => (
    <Tooltip label={_t("room_list|room_options")}>
        <IconButton aria-label={_t("room_list|room_options")} {...props} ref={ref}>
            <FilterIcon color="var(--cpd-color-icon-secondary)" />
        </IconButton>
    </Tooltip>
);

interface Props {
    /**
     * The view model for the room list view
     */
    vm: RoomListHeaderViewState;
}

export function RoomListOptionsMenu({ vm }: Props): JSX.Element {
    const [open, setOpen] = useState(false);

    const onActivitySelected = useCallback(() => {
        vm.sort(SortOption.Activity);
    }, [vm]);

    const onAtoZSelected = useCallback(() => {
        vm.sort(SortOption.AToZ);
    }, [vm]);

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
                checked={vm.activeSortOption === SortOption.Activity}
                onSelect={onActivitySelected}
            />
            <RadioMenuItem
                label={_t("room_list|sort_type|atoz")}
                checked={vm.activeSortOption === SortOption.AToZ}
                onSelect={onAtoZSelected}
            />
            <MenuTitle title={_t("room_list|appearance")} />
            <CheckboxMenuItem
                label={_t("room_list|show_message_previews")}
                onSelect={vm.toggleMessagePreview}
                checked={vm.shouldShowMessagePreview}
            />
        </Menu>
    );
}
