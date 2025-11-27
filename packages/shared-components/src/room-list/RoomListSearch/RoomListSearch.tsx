/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import SearchIcon from "@vector-im/compound-design-tokens/assets/web/icons/search";
import DialPadIcon from "@vector-im/compound-design-tokens/assets/web/icons/dial-pad";
import ExploreIcon from "@vector-im/compound-design-tokens/assets/web/icons/explore";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { Flex } from "../../utils/Flex";
import { _t } from "../../utils/i18n";
import styles from "./RoomListSearch.module.css";

/**
 * Snapshot for RoomListSearch
 */
export type RoomListSearchSnapshot = {
    /** Callback fired when search button is clicked */
    onSearchClick: () => void;
    /** Whether to show the dial pad button */
    showDialPad: boolean;
    /** Callback fired when dial pad button is clicked */
    onDialPadClick?: () => void;
    /** Whether to show the explore rooms button */
    showExplore: boolean;
    /** Callback fired when explore button is clicked */
    onExploreClick?: () => void;
};

/**
 * Props for RoomListSearch component
 */
export interface RoomListSearchProps {
    /** The view model containing search data */
    vm: ViewModel<RoomListSearchSnapshot>;
}

/**
 * A presentational search bar component for the room list.
 * Displays a search button and optional action buttons (dial pad, explore) in a horizontal layout.
 */
export const RoomListSearch: React.FC<RoomListSearchProps> = ({ vm }): JSX.Element => {
    const snapshot = useViewModel(vm);

    // Determine keyboard shortcut based on platform
    const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
    const searchShortcut = isMac ? "⌘ K" : "Ctrl K";

    return (
        <Flex className={styles.roomListSearch} role="search" gap="var(--cpd-space-2x)" align="center">
            <Button
                className="mx_RoomListSearch_search"
                kind="secondary"
                size="sm"
                Icon={SearchIcon}
                onClick={snapshot.onSearchClick}
            >
                <Flex as="span" justify="space-between">
                    <span className="mx_RoomListSearch_search_text">{_t("action|search")}</span>
                    <kbd>{searchShortcut}</kbd>
                </Flex>
            </Button>
            {snapshot.showDialPad && (
                <Button
                    kind="secondary"
                    size="sm"
                    Icon={DialPadIcon}
                    iconOnly={true}
                    aria-label={_t("left_panel|open_dial_pad")}
                    onClick={snapshot.onDialPadClick}
                />
            )}
            {snapshot.showExplore && (
                <Button
                    kind="secondary"
                    size="sm"
                    Icon={ExploreIcon}
                    iconOnly={true}
                    aria-label={_t("action|explore_rooms")}
                    onClick={snapshot.onExploreClick}
                />
            )}
        </Flex>
    );
};
