/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import { Button } from "@vector-im/compound-web";
import ExploreIcon from "@vector-im/compound-design-tokens/assets/web/icons/explore";
import SearchIcon from "@vector-im/compound-design-tokens/assets/web/icons/search";
import DialPadIcon from "@vector-im/compound-design-tokens/assets/web/icons/dial-pad";

import { Flex } from "../../Flex";
import { IS_MAC, Key } from "../../Keyboard";
import styles from "./RoomListSearch.module.css";
import { _t } from "../../i18n";
import type { ViewModel } from "../../ViewModel";
import { useViewModel } from "../../useViewModel";
import { ALTERNATE_KEY_NAME } from "../../KeyboardShortcuts";

export interface RoomListSearchSnapshot {
    /**
     * Whether the Explore button should be displayed.
     */
    displayExploreButton: boolean;
    /**
     * Whether the Dial Pad button should be displayed.
     */
    displayDialButton: boolean;
}

export interface RoomListSearchViewModel extends ViewModel<RoomListSearchSnapshot> {
    /**
     * Callback for when the search button is clicked.
     */
    onSearchClick: MouseEventHandler<HTMLButtonElement>;
    /**
     * Callback for when the Dial Pad button is clicked.
     */
    onDialPadClick: MouseEventHandler<HTMLButtonElement>;
    /**
     * Callback for when the Explore button is clicked.
     */
    onExploreClick: MouseEventHandler<HTMLButtonElement>;
}

interface RoomListSearchProps {
    vm: RoomListSearchViewModel;
}

/**
 * A search component to be displayed at the top of the room list
 */
export function RoomListSearch({ vm }: RoomListSearchProps): JSX.Element {
    const { displayExploreButton, displayDialButton } = useViewModel(vm);

    return (
        <Flex className={styles.container} role="search" gap="var(--cpd-space-2x)" align="center">
            <Button
                className={styles.searchBar}
                kind="secondary"
                size="sm"
                Icon={SearchIcon}
                onClick={vm.onSearchClick}
            >
                <Flex as="span" justify="space-between">
                    <span className={styles.searchText}>{_t("action|search")}</span>
                    <kbd>{IS_MAC ? "⌘ K" : _t(ALTERNATE_KEY_NAME[Key.CONTROL]) + " K"}</kbd>
                </Flex>
            </Button>
            {displayDialButton && (
                <Button
                    className={styles.button}
                    kind="secondary"
                    size="sm"
                    Icon={DialPadIcon}
                    iconOnly={true}
                    aria-label={_t("left_panel|open_dial_pad")}
                    onClick={vm.onDialPadClick}
                />
            )}
            {displayExploreButton && (
                <Button
                    className={styles.button}
                    kind="secondary"
                    size="sm"
                    Icon={ExploreIcon}
                    iconOnly={true}
                    aria-label={_t("action|explore_rooms")}
                    onClick={vm.onExploreClick}
                />
            )}
        </Flex>
    );
}
