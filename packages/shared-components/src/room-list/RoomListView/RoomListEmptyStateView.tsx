/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren, type ReactNode } from "react";
import { Button } from "@vector-im/compound-web";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat";
import RoomIcon from "@vector-im/compound-design-tokens/assets/web/icons/room";

import { Flex } from "../../utils/Flex";
import { _t } from "../../utils/i18n";
import { useViewModel } from "../../viewmodel";
import type { RoomListViewModel } from "./RoomListView";
import styles from "./RoomListEmptyStateView.module.css";

/**
 * Props for RoomListEmptyStateView component
 */
export interface RoomListEmptyStateViewProps {
    /** The view model containing all data and callbacks */
    vm: RoomListViewModel;
}

/**
 * Empty state component for the room list.
 * Displays appropriate message and actions based on the active filter.
 */
export const RoomListEmptyStateView: React.FC<RoomListEmptyStateViewProps> = ({ vm }): JSX.Element => {
    const snapshot = useViewModel(vm);

    // If there is no active filter, show the default empty state
    if (!snapshot.activeFilterId) {
        return (
            <GenericPlaceholder
                title={_t("room_list|empty|no_chats")}
                description={
                    snapshot.canCreateRoom
                        ? _t("room_list|empty|no_chats_description")
                        : _t("room_list|empty|no_chats_description_no_room_rights")
                }
            >
                <Flex
                    className={styles.defaultPlaceholder}
                    align="center"
                    justify="center"
                    direction="column"
                    gap="var(--cpd-space-4x)"
                >
                    <Button size="sm" kind="secondary" Icon={ChatIcon} onClick={vm.createChatRoom}>
                        {_t("action|start_chat")}
                    </Button>
                    {snapshot.canCreateRoom && (
                        <Button size="sm" kind="secondary" Icon={RoomIcon} onClick={vm.createRoom}>
                            {_t("action|new_room")}
                        </Button>
                    )}
                </Flex>
            </GenericPlaceholder>
        );
    }

    // Handle different filter cases based on filter ID
    switch (snapshot.activeFilterId) {
        case "favourite":
            return (
                <GenericPlaceholder
                    title={_t("room_list|empty|no_favourites")}
                    description={_t("room_list|empty|no_favourites_description")}
                />
            );
        case "people":
            return (
                <GenericPlaceholder
                    title={_t("room_list|empty|no_people")}
                    description={_t("room_list|empty|no_people_description")}
                />
            );
        case "rooms":
            return (
                <GenericPlaceholder
                    title={_t("room_list|empty|no_rooms")}
                    description={_t("room_list|empty|no_rooms_description")}
                />
            );
        case "unread":
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_unread")}
                    action={_t("room_list|empty|show_chats")}
                    onAction={() => vm.onToggleFilter(snapshot.activeFilterId!)}
                />
            );
        case "invites":
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_invites")}
                    action={_t("room_list|empty|show_activity")}
                    onAction={() => vm.onToggleFilter(snapshot.activeFilterId!)}
                />
            );
        case "mentions":
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_mentions")}
                    action={_t("room_list|empty|show_activity")}
                    onAction={() => vm.onToggleFilter(snapshot.activeFilterId!)}
                />
            );
        case "low_priority":
            return (
                <ActionPlaceholder
                    title={_t("room_list|empty|no_lowpriority")}
                    action={_t("room_list|empty|show_activity")}
                    onAction={() => vm.onToggleFilter(snapshot.activeFilterId!)}
                />
            );
        default:
            return (
                <GenericPlaceholder
                    title={_t("room_list|empty|no_chats")}
                    description={_t("room_list|empty|no_chats_description")}
                />
            );
    }
};

interface GenericPlaceholderProps {
    /** The title of the placeholder */
    title: string;
    /** The description of the placeholder */
    description?: string;
    /** Optional children (e.g., action buttons) */
    children?: ReactNode;
}

/**
 * A generic placeholder for the room list
 */
function GenericPlaceholder({ title, description, children }: PropsWithChildren<GenericPlaceholderProps>): JSX.Element {
    return (
        <Flex
            data-testid="empty-room-list"
            className={styles.genericPlaceholder}
            direction="column"
            align="stretch"
            justify="center"
            gap="var(--cpd-space-2x)"
        >
            <span className={styles.title}>{title}</span>
            {description && <span className={styles.description}>{description}</span>}
            {children}
        </Flex>
    );
}

interface ActionPlaceholderProps {
    /** The title to display */
    title: string;
    /** The action button text */
    action: string;
    /** Callback when the action button is clicked */
    onAction?: () => void;
}

/**
 * A placeholder for the room list when a filter is active
 * The user can take action to toggle the filter
 */
function ActionPlaceholder({ title, action, onAction }: ActionPlaceholderProps): JSX.Element {
    return (
        <GenericPlaceholder title={title}>
            {onAction && (
                <Button kind="tertiary" onClick={onAction}>
                    {action}
                </Button>
            )}
        </GenericPlaceholder>
    );
}
