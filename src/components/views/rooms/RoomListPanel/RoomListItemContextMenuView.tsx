/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";
import { type JSX, type PropsWithChildren } from "react";
import { ContextMenu } from "@vector-im/compound-web";
import React from "react";

import { _t } from "../../../../languageHandler";
import { MoreOptionContent } from "./RoomListItemMenuView";
import { useRoomListItemMenuViewModel } from "../../../viewmodels/roomlist/RoomListItemMenuViewModel";

interface RoomListItemContextMenuViewProps {
    /**
     * The room to display the menu for.
     */
    room: Room;
    /**
     * Set the menu open state.
     */
    setMenuOpen: (isOpen: boolean) => void;
}

/**
 * A view for the room list item context menu.
 */
export function RoomListItemContextMenuView({
    room,
    setMenuOpen,
    children,
}: PropsWithChildren<RoomListItemContextMenuViewProps>): JSX.Element {
    const vm = useRoomListItemMenuViewModel(room);

    return (
        <ContextMenu
            title={_t("room_list|room|more_options")}
            showTitle={false}
            // To not mess with the roving tab index of the button
            hasAccessibleAlternative={true}
            trigger={children}
            onOpenChange={setMenuOpen}
        >
            <MoreOptionContent vm={vm} />
        </ContextMenu>
    );
}
