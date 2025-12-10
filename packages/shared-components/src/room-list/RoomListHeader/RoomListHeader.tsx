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
import { SpaceMenu } from "./SpaceMenu";
import { ComposeMenu } from "./ComposeMenu";
import { SortOptionsMenu, SortOption } from "./SortOptionsMenu";
import styles from "./RoomListHeader.module.css";
import { RoomListViewModel } from "../RoomListView";
import { useViewModel } from "../../useViewModel";

/**
 * State for space menu - pure data, no callbacks
 */
export type SpaceMenuState = {
    /** The title of the space */
    title: string;
    /** Whether the user can invite in the space */
    canInviteInSpace: boolean;
    /** Whether the user can access space settings */
    canAccessSpaceSettings: boolean;
};

/**
 * State for compose menu - pure data, no callbacks
 */
export type ComposeMenuState = {
    /** Whether the user can create rooms */
    canCreateRoom: boolean;
    /** Whether the user can create video rooms */
    canCreateVideoRoom: boolean;
};

/**
 * State for RoomListHeader - pure data
 */
export type RoomListHeaderState = {
    /** Header title */
    title: string;
    /** Whether this is a space */
    isSpace: boolean;
    /** Space menu state (if this is a space) */
    spaceMenuState?: SpaceMenuState;
    /** Whether to display compose menu */
    displayComposeMenu: boolean;
    /** Compose menu state (if displayComposeMenu is true) */
    composeMenuState?: ComposeMenuState;
    /** Active sort option */
    activeSortOption: SortOption;
};

export interface RoomListHeaderProps {
    vm: RoomListViewModel;
}
/**
 * A presentational header component for the room list.
 * Displays a title with optional space menu, sort options, and compose actions.
 */
export const RoomListHeader: React.FC<RoomListHeaderProps> = ({ vm }): JSX.Element => {
    const snapshot = useViewModel(vm);
    const { title, isSpace, spaceMenuState, displayComposeMenu, composeMenuState, activeSortOption } =
        snapshot.headerState;

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
                <h1 title={title}>{title}</h1>
                {isSpace && spaceMenuState && (
                    <SpaceMenu
                        title={spaceMenuState.title}
                        canInviteInSpace={spaceMenuState.canInviteInSpace}
                        canAccessSpaceSettings={spaceMenuState.canAccessSpaceSettings}
                        openSpaceHome={vm.openSpaceHome}
                        inviteInSpace={vm.inviteInSpace}
                        openSpacePreferences={vm.openSpacePreferences}
                        openSpaceSettings={vm.openSpaceSettings}
                    />
                )}
            </Flex>
            <Flex align="center" gap="var(--cpd-space-2x)">
                <SortOptionsMenu activeSortOption={activeSortOption} sort={vm.sort} />
                {displayComposeMenu && composeMenuState ? (
                    <ComposeMenu
                        canCreateRoom={composeMenuState.canCreateRoom}
                        canCreateVideoRoom={composeMenuState.canCreateVideoRoom}
                        createChatRoom={vm.createChatRoom}
                        createRoom={vm.createRoom}
                        createVideoRoom={vm.createVideoRoom}
                    />
                ) : (
                    <IconButton onClick={vm.onComposeClick} tooltip={_t("action|new_conversation")}>
                        <ComposeIcon color="var(--cpd-color-icon-secondary)" aria-hidden />
                    </IconButton>
                )}
            </Flex>
        </Flex>
    );
};
