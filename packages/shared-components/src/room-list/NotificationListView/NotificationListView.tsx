/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode, useCallback, useEffect, useRef } from "react";
import { Text } from "@vector-im/compound-web";
import { MentionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";

import { useViewModel, type ViewModel } from "../../core/viewmodel";
import { Flex } from "../../core/utils/Flex";
import { _t } from "../../core/i18n/i18n";
import { FlatVirtualizedList, type VirtualizedListContext } from "../../core/VirtualizedList";
import { RoomListLoadingSkeleton } from "../RoomListView/RoomListLoadingSkeleton";
import { GenericPlaceholder } from "../RoomListView/RoomListEmptyStateView";
import listStyles from "../RoomListView/RoomListView.module.css";
import virtualizedListStyles from "../VirtualizedRoomListView/VirtualizedRoomListView.module.css";
import styles from "../VirtualizedRoomListView/RoomListItemWrapper/RoomListItemView/RoomListItemView.module.css";

/**
 * A single notification (one event) in the notification list.
 */
export interface NotificationListItem {
    /** Unique id of the notification, the event id */
    id: string;
    /** The room the event belongs to */
    roomId: string;
    /** The display name of the room */
    roomName: string;
    /** Text preview of the event, including the sender */
    preview: string;
    /** Formatted timestamp of the event */
    timestamp: string;
    /** Whether the event mentions the user (highlight) */
    isMention: boolean;
}

export interface NotificationListViewSnapshot {
    /** Notifications, newest first */
    items: NotificationListItem[];
    /** Whether notifications are being fetched from the server */
    isLoading: boolean;
}

export interface NotificationListViewActions {
    /** Called when a notification is clicked */
    onItemClick: (id: string) => void;
    /** Called when the end of the list is reached, to fetch older notifications */
    loadMore: () => void;
}

/**
 * The view model for {@link NotificationListView}.
 */
export type NotificationListViewModel = ViewModel<NotificationListViewSnapshot, NotificationListViewActions>;

export interface NotificationListViewProps {
    /** The view model */
    vm: NotificationListViewModel;
    /** Render function for the room avatar */
    renderAvatar: (roomId: string) => ReactNode;
    /** Optional callback for keyboard events on the list */
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

const getItemKey = (item: NotificationListItem): string => item.id;
const isItemFocusable = (): boolean => true;

/**
 * A list of notifications, one row per event, styled like the room list.
 */
export function NotificationListView({ vm, renderAvatar, onKeyDown }: NotificationListViewProps): JSX.Element {
    const { items, isLoading } = useViewModel(vm);

    const getItemComponent = useCallback(
        (
            index: number,
            item: NotificationListItem,
            context: VirtualizedListContext<undefined>,
            onFocus: (item: NotificationListItem, e: React.FocusEvent) => void,
        ): JSX.Element => {
            const isRovingItem = item.id === context.tabIndexKey;
            return (
                <NotificationListItemView
                    item={item}
                    isFocused={isRovingItem && context.focused}
                    tabIndex={isRovingItem ? 0 : -1}
                    isFirstItem={index === 0}
                    isLastItem={index === items.length - 1}
                    renderAvatar={renderAvatar}
                    onClick={() => vm.onItemClick(item.id)}
                    onFocus={(e) => onFocus(item, e)}
                />
            );
        },
        [vm, renderAvatar, items.length],
    );

    let body: ReactNode;
    if (items.length === 0 && isLoading) {
        body = <RoomListLoadingSkeleton />;
    } else if (items.length === 0) {
        body = (
            <GenericPlaceholder
                title={_t("room_list|notifications_view|empty_heading")}
                description={_t("room_list|notifications_view|empty_description")}
            />
        );
    } else {
        body = (
            <FlatVirtualizedList
                items={items}
                getItemKey={getItemKey}
                isItemFocusable={isItemFocusable}
                getItemComponent={getItemComponent}
                endReached={vm.loadMore}
                onKeyDown={onKeyDown}
                role="listbox"
                aria-label={_t("room_list|notifications_view|list_title")}
                data-testid="notification-list"
                className={virtualizedListStyles.roomList}
            />
        );
    }

    return (
        <Flex direction="column" className={listStyles.list}>
            {body}
        </Flex>
    );
}

interface NotificationListItemViewProps {
    item: NotificationListItem;
    isFocused: boolean;
    tabIndex: number;
    isFirstItem: boolean;
    isLastItem: boolean;
    renderAvatar: (roomId: string) => ReactNode;
    onClick: () => void;
    onFocus: (e: React.FocusEvent) => void;
}

function NotificationListItemView({
    item,
    isFocused,
    tabIndex,
    isFirstItem,
    isLastItem,
    renderAvatar,
    onClick,
    onFocus,
}: NotificationListItemViewProps): JSX.Element {
    const ref = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (isFocused) ref.current?.focus({ preventScroll: true });
    }, [isFocused]);

    return (
        <Flex
            as="button"
            ref={ref}
            type="button"
            role="option"
            aria-selected={false}
            className={classNames(styles.roomListItem, {
                [styles.bold]: item.isMention,
                [styles.firstItem]: isFirstItem,
                [styles.lastItem]: isLastItem,
            })}
            align="stretch"
            tabIndex={tabIndex}
            onClick={onClick}
            onFocus={onFocus}
        >
            <Flex className={styles.container} gap="var(--cpd-space-3x)" align="center">
                {renderAvatar(item.roomId)}
                <Flex className={styles.content} gap="var(--cpd-space-2x)" align="center" justify="space-between">
                    <div className={styles.ellipsis}>
                        <div className={styles.roomName} title={item.roomName}>
                            {item.roomName}
                        </div>
                        <Text as="div" size="sm" className={styles.ellipsis} title={item.preview}>
                            {item.preview}
                        </Text>
                    </div>
                    <Flex direction="column" align="end" gap="var(--cpd-space-1x)">
                        <Text as="span" size="xs">
                            {item.timestamp}
                        </Text>
                        {item.isMention && (
                            <MentionIcon width="16px" height="16px" fill="var(--cpd-color-icon-accent-primary)" />
                        )}
                    </Flex>
                </Flex>
            </Flex>
        </Flex>
    );
}
