/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { IconButton } from "@vector-im/compound-web";
import ComposeIcon from "@vector-im/compound-design-tokens/assets/web/icons/compose";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { Flex } from "../../utils/Flex";
import { _t } from "../../utils/i18n";
import { SpaceMenu, type SpaceMenuSnapshot } from "./SpaceMenu";
import { ComposeMenu, type ComposeMenuSnapshot } from "./ComposeMenu";
import { SortOptionsMenu, type SortOptionsMenuSnapshot } from "./SortOptionsMenu";
import styles from "./RoomListHeader.module.css";

/**
 * Snapshot for RoomListHeader
 */
export type RoomListHeaderSnapshot = {
    /** The title to display in the header */
    title: string;
    /** Whether to display the space menu (true if there is an active space) */
    isSpace: boolean;
    /** Space menu view model (only used if isSpace is true) */
    spaceMenuVm?: ViewModel<SpaceMenuSnapshot>;
    /** Whether to display the compose menu */
    displayComposeMenu: boolean;
    /** Compose menu view model (only used if displayComposeMenu is true) */
    composeMenuVm?: ViewModel<ComposeMenuSnapshot>;
    /** Callback when compose button is clicked (only used if displayComposeMenu is false) */
    onComposeClick?: () => void;
    /** Sort options menu view model */
    sortOptionsMenuVm: ViewModel<SortOptionsMenuSnapshot>;
};

/**
 * Props for RoomListHeader component
 */
export interface RoomListHeaderProps {
    /** The view model containing header data */
    vm: ViewModel<RoomListHeaderSnapshot>;
}

/**
 * A presentational header component for the room list.
 * Displays a title with optional space menu, sort options, and compose actions.
 */
export const RoomListHeader: React.FC<RoomListHeaderProps> = ({ vm }): JSX.Element => {
    const snapshot = useViewModel(vm);

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
                <h1 title={snapshot.title}>{snapshot.title}</h1>
                {snapshot.isSpace && snapshot.spaceMenuVm && <SpaceMenu vm={snapshot.spaceMenuVm} />}
            </Flex>
            <Flex align="center" gap="var(--cpd-space-2x)">
                <SortOptionsMenu vm={snapshot.sortOptionsMenuVm} />
                {snapshot.displayComposeMenu && snapshot.composeMenuVm ? (
                    <ComposeMenu vm={snapshot.composeMenuVm} />
                ) : (
                    <IconButton onClick={snapshot.onComposeClick} tooltip={_t("action|new_conversation")}>
                        <ComposeIcon color="var(--cpd-color-icon-secondary)" aria-hidden />
                    </IconButton>
                )}
            </Flex>
        </Flex>
    );
};
