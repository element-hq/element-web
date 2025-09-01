/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";
import { Button } from "@vector-im/compound-web";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat";
import RoomIcon from "@vector-im/compound-design-tokens/assets/web/icons/room";

import type { RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { Flex } from "../../../../shared-components/utils/Flex";
import { _t } from "../../../../languageHandler";
import { FilterKey } from "../../../../stores/room-list-v3/skip-list/filters";
import { type PrimaryFilter } from "../../../viewmodels/roomlist/useFilteredRooms";

interface EmptyRoomListProps {
    /**
     * The view model for the room list
     */
    vm: RoomListViewState;
}

/**
 * The empty state for the room list
 */
export function EmptyRoomList({ vm }: EmptyRoomListProps): JSX.Element | undefined {
    // If there is no active primary filter, show the default empty state
    if (!vm.activePrimaryFilter) return <DefaultPlaceholder vm={vm} />;

    switch (vm.activePrimaryFilter.key) {
        case FilterKey.FavouriteFilter:
            return (
                <GenericPlaceholder
                    title={_t("room_list|empty|no_favourites")}
                    description={_t("room_list|empty|no_favourites_description")}
                />
            );
        case FilterKey.PeopleFilter:
            return (
                <GenericPlaceholder
                    title={_t("room_list|empty|no_people")}
                    description={_t("room_list|empty|no_people_description")}
                />
            );
        case FilterKey.RoomsFilter:
            return (
                <GenericPlaceholder
                    title={_t("room_list|empty|no_rooms")}
                    description={_t("room_list|empty|no_rooms_description")}
                />
            );
        case FilterKey.UnreadFilter:
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_unread")}
                    action={_t("room_list|empty|show_chats")}
                    filter={vm.activePrimaryFilter}
                />
            );
        case FilterKey.InvitesFilter:
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_invites")}
                    action={_t("room_list|empty|show_activity")}
                    filter={vm.activePrimaryFilter}
                />
            );
        case FilterKey.MentionsFilter:
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_mentions")}
                    action={_t("room_list|empty|show_activity")}
                    filter={vm.activePrimaryFilter}
                />
            );
        case FilterKey.LowPriorityFilter:
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_lowpriority")}
                    action={_t("room_list|empty|show_activity")}
                    filter={vm.activePrimaryFilter}
                />
            );
        default:
            return undefined;
    }
}

interface GenericPlaceholderProps {
    /**
     * The title of the placeholder
     */
    title: string;
    /**
     * The description of the placeholder
     */
    description?: string;
}

/**
 * A generic placeholder for the room list
 */
function GenericPlaceholder({ title, description, children }: PropsWithChildren<GenericPlaceholderProps>): JSX.Element {
    return (
        <Flex
            data-testid="empty-room-list"
            className="mx_EmptyRoomList_GenericPlaceholder"
            direction="column"
            align="stretch"
            justify="center"
            gap="var(--cpd-space-2x)"
        >
            <span className="mx_EmptyRoomList_GenericPlaceholder_title">{title}</span>
            {description && <span className="mx_EmptyRoomList_GenericPlaceholder_description">{description}</span>}
            {children}
        </Flex>
    );
}

interface DefaultPlaceholderProps {
    /**
     * The view model for the room list
     */
    vm: RoomListViewState;
}

/**
 * The default empty state for the room list when no primary filter is active
 * The user can create chat or room (if they have the permission)
 */
function DefaultPlaceholder({ vm }: DefaultPlaceholderProps): JSX.Element {
    return (
        <GenericPlaceholder
            title={_t("room_list|empty|no_chats")}
            description={
                vm.canCreateRoom
                    ? _t("room_list|empty|no_chats_description")
                    : _t("room_list|empty|no_chats_description_no_room_rights")
            }
        >
            <Flex
                className="mx_EmptyRoomList_DefaultPlaceholder"
                align="center"
                justify="center"
                direction="column"
                gap="var(--cpd-space-4x)"
            >
                <Button size="sm" kind="secondary" Icon={ChatIcon} onClick={vm.createChatRoom}>
                    {_t("action|start_chat")}
                </Button>
                {vm.canCreateRoom && (
                    <Button size="sm" kind="secondary" Icon={RoomIcon} onClick={vm.createRoom}>
                        {_t("action|new_room")}
                    </Button>
                )}
            </Flex>
        </GenericPlaceholder>
    );
}

interface ActionPlaceholderProps {
    filter: PrimaryFilter;
    title: string;
    action: string;
}

/**
 * A placeholder for the room list when a filter is active
 * The user can take action to toggle the filter
 */
function ActionPlaceholder({ filter, title, action }: ActionPlaceholderProps): JSX.Element {
    return (
        <GenericPlaceholder title={title}>
            <Button kind="tertiary" onClick={filter.toggle}>
                {action}
            </Button>
        </GenericPlaceholder>
    );
}
