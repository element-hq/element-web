/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { Flex } from "../../utils/Flex";
import { RoomListSearch, type RoomListSearchViewModel } from "../RoomListSearch";
import { RoomListHeader, type RoomListHeaderViewModel } from "../RoomListHeader";
import { RoomListView, type RoomListViewViewModel } from "../RoomListView";
import { type RoomListItemViewModel } from "../RoomListItem";
import styles from "./RoomListPanel.module.css";

/**
 * ViewModel interface for RoomListPanel
 */
export interface RoomListPanelViewModel {
    /** Accessibility label for the navigation landmark */
    ariaLabel: string;
    /** Optional search view model */
    searchViewModel?: RoomListSearchViewModel;
    /** Header view model */
    headerViewModel: RoomListHeaderViewModel;
    /** View model for the main content area */
    viewViewModel: RoomListViewViewModel;
}

/**
 * Props for RoomListPanel component
 */
export interface RoomListPanelProps extends React.HTMLAttributes<HTMLElement> {
    /** The view model containing all data and callbacks */
    viewModel: RoomListPanelViewModel;
    /** Render function for room avatar */
    renderAvatar: (roomViewModel: RoomListItemViewModel) => ReactNode;
}

/**
 * A complete room list panel component.
 * Composes search, header, and content areas with a ViewModel pattern.
 */
export const RoomListPanel: React.FC<RoomListPanelProps> = ({ viewModel, renderAvatar, ...props }): JSX.Element => {
    return (
        <Flex
            as="nav"
            className={styles.roomListPanel}
            direction="column"
            align="stretch"
            aria-label={viewModel.ariaLabel}
            {...props}
        >
            {viewModel.searchViewModel && <RoomListSearch viewModel={viewModel.searchViewModel} />}
            <RoomListHeader viewModel={viewModel.headerViewModel} />
            <RoomListView viewModel={viewModel.viewViewModel} renderAvatar={renderAvatar} />
        </Flex>
    );
};
