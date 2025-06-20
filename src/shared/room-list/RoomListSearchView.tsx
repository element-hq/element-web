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

import { Flex } from "../../components/utils/Flex";
import { IS_MAC } from "../../Keyboard";
import styles from "./RoomListSearchView.module.css";

export interface RoomListSearchViewState {
    displayExploreButton: boolean;
    displayDialButton: boolean;
}

export interface RoomListSearchActions {
    onSearchClick: MouseEventHandler<HTMLButtonElement>;
    onDialPadClick: MouseEventHandler<HTMLButtonElement>;
    onExploreClick: MouseEventHandler<HTMLButtonElement>;
}

type RoomListSearchViewProps = {
    viewState: RoomListSearchViewState;
    actions: RoomListSearchActions;
};

/**
 * A search component to be displayed at the top of the room list
 * The `Explore` button is displayed only in the Home meta space and when UIComponent.ExploreRooms is enabled.
 */
export function RoomListSearchView({ viewState, actions }: RoomListSearchViewProps): JSX.Element {
    return (
        <Flex className={styles.container} role="search" gap="var(--cpd-space-2x)" align="center">
            <Button
                className={styles.searchBar}
                kind="secondary"
                size="sm"
                Icon={SearchIcon}
                onClick={actions.onSearchClick}
            >
                <Flex as="span" justify="space-between">
                    <span className={styles.searchText}>Search</span>
                    <kbd>{IS_MAC ? "⌘ K" : "ctrl" + " K"}</kbd>
                </Flex>
            </Button>
            {viewState.displayDialButton && (
                <Button
                    className={styles.button}
                    kind="secondary"
                    size="sm"
                    Icon={DialPadIcon}
                    iconOnly={true}
                    aria-label="dial pad"
                    onClick={actions.onDialPadClick}
                />
            )}
            {viewState.displayExploreButton && (
                <Button
                    className={styles.button}
                    kind="secondary"
                    size="sm"
                    Icon={ExploreIcon}
                    iconOnly={true}
                    aria-label="explore rooms"
                    onClick={actions.onExploreClick}
                />
            )}
        </Flex>
    );
}
