/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { IconButton, Menu, MenuItem, Tooltip } from "@vector-im/compound-web";
import React, { type Ref, type JSX, useState } from "react";
import {
    ArrowDownIcon,
    ChatIcon,
    ChatNewIcon,
    CheckIcon,
    FilterIcon,
    MentionIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { SecondaryFilters } from "../../../viewmodels/roomlist/useFilteredRooms";
import { textForSecondaryFilter } from "./textForFilter";

interface MenuTriggerProps extends React.ComponentProps<typeof IconButton> {
    ref?: Ref<HTMLButtonElement>;
}

const MenuTrigger = ({ ref, ...props }: MenuTriggerProps): JSX.Element => (
    <Tooltip label={_t("room_list|filter")}>
        <IconButton size="28px" aria-label={_t("room_list|filter")} {...props} ref={ref}>
            <FilterIcon />
        </IconButton>
    </Tooltip>
);

interface FilterOptionProps {
    /**
     * The filter to display
     */
    filter: SecondaryFilters;

    /**
     * True if the filter is selected
     */
    selected: boolean;

    /**
     * The function to call when the filter is selected
     */
    onSelect: (filter: SecondaryFilters) => void;
}

function iconForFilter(filter: SecondaryFilters, size: string): JSX.Element {
    switch (filter) {
        case SecondaryFilters.AllActivity:
            return <ChatIcon width={size} height={size} />;
        case SecondaryFilters.MentionsOnly:
            return <MentionIcon width={size} height={size} />;
        case SecondaryFilters.InvitesOnly:
            return <ChatNewIcon width={size} height={size} />;
        case SecondaryFilters.LowPriority:
            return <ArrowDownIcon width={size} height={size} />;
    }
}

function FilterOption({ filter, selected, onSelect }: FilterOptionProps): JSX.Element {
    const checkComponent = <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-primary)" />;

    return (
        <MenuItem
            aria-selected={selected}
            hideChevron={true}
            Icon={iconForFilter(filter, "20px")}
            label={textForSecondaryFilter(filter)}
            onSelect={() => {
                onSelect(filter);
            }}
        >
            {selected && checkComponent}
        </MenuItem>
    );
}

interface Props {
    /**
     * The view model for the room list view
     */
    vm: RoomListViewState;
}

export function RoomListFilterMenu({ vm }: Props): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|filter")}
            showTitle={true}
            align="start"
            trigger={<MenuTrigger />}
        >
            {[
                SecondaryFilters.AllActivity,
                SecondaryFilters.MentionsOnly,
                SecondaryFilters.InvitesOnly,
                SecondaryFilters.LowPriority,
            ].map((filter) => (
                <FilterOption
                    key={filter}
                    filter={filter}
                    selected={vm.activeSecondaryFilter === filter}
                    onSelect={(selectedFilter) => {
                        vm.activateSecondaryFilter(selectedFilter);
                        setOpen(false);
                    }}
                />
            ))}
        </Menu>
    );
}
