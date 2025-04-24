/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { IconButton, Menu, MenuTitle, CheckboxMenuItem, Tooltip } from "@vector-im/compound-web";
import React, { type Ref, type JSX, useState } from "react";
import OverflowHorizontalIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import { _t } from "../../../../languageHandler";
import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";

interface MenuTriggerProps extends React.ComponentProps<typeof IconButton> {
    ref?: Ref<HTMLButtonElement>;
}

const MenuTrigger = ({ ref, ...props }: MenuTriggerProps): JSX.Element => (
    <Tooltip label={_t("room_list|room_options")}>
        <IconButton
            className="mx_RoomListSecondaryFilters_roomOptionsButton"
            aria-label={_t("room_list|room_options")}
            {...props}
            ref={ref}
        >
            <OverflowHorizontalIcon />
        </IconButton>
    </Tooltip>
);

interface Props {
    /**
     * The view model for the room list view
     */
    vm: RoomListViewState;
}

export function RoomListOptionsMenu({ vm }: Props): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|room_options")}
            showTitle={false}
            align="start"
            trigger={<MenuTrigger />}
        >
            <MenuTitle title={_t("room_list|appearance")} />
            <CheckboxMenuItem
                label={_t("room_list|show_message_previews")}
                onSelect={vm.toggleMessagePreview}
                checked={vm.shouldShowMessagePreview}
            />
        </Menu>
    );
}
