/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { IconButton } from "@vector-im/compound-web";
import ComposeIcon from "@vector-im/compound-design-tokens/assets/web/icons/compose";

import { Flex } from "../../utils/Flex";
import { _t } from "../../utils/i18n";
import { SpaceMenu, type SpaceMenuViewModel } from "./SpaceMenu";
import { ComposeMenu, type ComposeMenuViewModel } from "./ComposeMenu";
import { SortOptionsMenu, type SortOptionsMenuViewModel } from "./SortOptionsMenu";
import styles from "./RoomListHeader.module.css";

/**
 * ViewModel interface for RoomListHeader
 */
export interface RoomListHeaderViewModel {
    /** The title to display in the header */
    title: string;
    /** Whether to display the space menu (true if there is an active space) */
    isSpace: boolean;
    /** Space menu view model (only used if isSpace is true) */
    spaceMenuViewModel?: SpaceMenuViewModel;
    /** Whether to display the compose menu */
    displayComposeMenu: boolean;
    /** Compose menu view model (only used if displayComposeMenu is true) */
    composeMenuViewModel?: ComposeMenuViewModel;
    /** Callback when compose button is clicked (only used if displayComposeMenu is false) */
    onComposeClick?: () => void;
    /** Sort options menu view model */
    sortOptionsMenuViewModel: SortOptionsMenuViewModel;
}

/**
 * Props for RoomListHeader component
 */
export interface RoomListHeaderProps {
    /** The view model containing header data */
    viewModel: RoomListHeaderViewModel;
}

/**
 * A presentational header component for the room list.
 * Displays a title with optional space menu, sort options, and compose actions.
 */
export const RoomListHeader: React.FC<RoomListHeaderProps> = ({ viewModel }): JSX.Element => {
    return (
        <Flex
            as="header"
            className={styles.roomListHeader}
            aria-label={_t("room|context_menu|title")}
            justify="space-between"
            align="center"
            data-testid="room-list-header"
        >
            <Flex className={styles.title} align="center" gap="var(--cpd-space-1x)">
                <h1 title={viewModel.title}>{viewModel.title}</h1>
                {viewModel.isSpace && viewModel.spaceMenuViewModel && (
                    <SpaceMenu viewModel={viewModel.spaceMenuViewModel} />
                )}
            </Flex>
            <Flex align="center" gap="var(--cpd-space-2x)">
                <SortOptionsMenu viewModel={viewModel.sortOptionsMenuViewModel} />
                {viewModel.displayComposeMenu && viewModel.composeMenuViewModel ? (
                    <ComposeMenu viewModel={viewModel.composeMenuViewModel} />
                ) : (
                    <IconButton onClick={viewModel.onComposeClick} tooltip={_t("action|new_conversation")}>
                        <ComposeIcon color="var(--cpd-color-icon-secondary)" aria-hidden />
                    </IconButton>
                )}
            </Flex>
        </Flex>
    );
};
