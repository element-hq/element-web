/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { Flex } from "../../utils/Flex";
import { RoomListSearch, type RoomListSearchSnapshot } from "../RoomListSearch";
import { RoomListHeader, type RoomListHeaderSnapshot } from "../RoomListHeader";
import { RoomListView, type RoomListViewSnapshot } from "../RoomListView";
import { type RoomListItemViewModel } from "../RoomListItem";
import styles from "./RoomListPanel.module.css";

/**
 * Snapshot for RoomListPanel
 */
export type RoomListPanelSnapshot = {
    /** Accessibility label for the navigation landmark */
    ariaLabel: string;
    /** Optional search view model */
    searchVm?: ViewModel<RoomListSearchSnapshot>;
    /** Header view model */
    headerVm: ViewModel<RoomListHeaderSnapshot>;
    /** View model for the main content area */
    viewVm: ViewModel<RoomListViewSnapshot>;
};

/**
 * Props for RoomListPanel component
 */
export interface RoomListPanelProps extends React.HTMLAttributes<HTMLElement> {
    /** The view model containing all data and callbacks */
    vm: ViewModel<RoomListPanelSnapshot>;
    /** Render function for room avatar */
    renderAvatar: (roomViewModel: RoomListItemViewModel) => ReactNode;
}

/**
 * A complete room list panel component.
 * Composes search, header, and content areas with a ViewModel pattern.
 */
export const RoomListPanel: React.FC<RoomListPanelProps> = ({ vm, renderAvatar, ...props }): JSX.Element => {
    const snapshot = useViewModel(vm);

    return (
        <Flex
            as="nav"
            className={styles.roomListPanel}
            direction="column"
            align="stretch"
            aria-label={snapshot.ariaLabel}
            {...props}
        >
            {snapshot.searchVm && <RoomListSearch vm={snapshot.searchVm} />}
            <RoomListHeader vm={snapshot.headerVm} />
            <RoomListView vm={snapshot.viewVm} renderAvatar={renderAvatar} />
        </Flex>
    );
};
