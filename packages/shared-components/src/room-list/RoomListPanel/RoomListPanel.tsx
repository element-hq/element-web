/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { Flex } from "../../utils/Flex";
import { RoomListSearch } from "../RoomListSearch";
import { RoomListHeader } from "../RoomListHeader";
import { RoomListView, type RoomListViewModel } from "../RoomListView";
import { type RoomListItem } from "../RoomListItem";
import styles from "./RoomListPanel.module.css";

/**
 * Props for RoomListPanel component
 */
export interface RoomListPanelProps extends React.HTMLAttributes<HTMLElement> {
    /** The view model containing all data and callbacks */
    vm: RoomListViewModel;
    /** Render function for room avatar */
    renderAvatar: (roomItem: RoomListItem) => ReactNode;
}

/**
 * A complete room list panel component.
 * Composes search, header, and content areas with a ViewModel pattern.
 */
export const RoomListPanel: React.FC<RoomListPanelProps> = ({ vm, renderAvatar, ...props }): JSX.Element => {
    return (
        <Flex as="nav" className={styles.roomListPanel} direction="column" align="stretch" {...props}>
            <RoomListSearch
                showDialPad={vm.showDialPad}
                showExplore={vm.showExplore}
                onSearchClick={vm.onSearchClick}
                onDialPadClick={vm.onDialPadClick}
                onExploreClick={vm.onExploreClick}
            />
            <RoomListHeader vm={vm} />
            <RoomListView vm={vm} renderAvatar={renderAvatar} />
        </Flex>
    );
};
