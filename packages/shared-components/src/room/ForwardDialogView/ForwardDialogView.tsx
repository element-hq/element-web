/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2021 Robin Townsend <robin@robin.town>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, type JSX, type ReactNode, useRef } from "react";
import classNames from "classnames";
import { Button, Form, InlineSpinner, Search, Tooltip } from "@vector-im/compound-web";
import {
    CheckIcon,
    ErrorIcon,
    OverflowHorizontalIcon,
    SearchIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../core/i18n/i18n";
import { useViewModel, type ViewModel } from "../../core/viewmodel";
import { RichList } from "../../core/rich-list/RichList";
import { RichItem } from "../../core/rich-list/RichItem";
import styles from "./ForwardDialogView.module.css";

/**
 * The progress of forwarding the message to a given room.
 */
export type ForwardSendState = "can_send" | "sending" | "sent" | "failed";

export interface ForwardDialogRoom {
    /** Unique identifier for the room. */
    id: string;
    /** Display name of the room. */
    name: string;
    /** Extra context shown under the name, e.g. the space the room belongs to. */
    description: string;
    /** Whether the current user is allowed to send messages to this room. */
    canSend: boolean;
    /** Progress of forwarding the message to this room. */
    sendState: ForwardSendState;
}

export interface ForwardDialogViewSnapshot {
    /** Rooms matching the current search query, most recently active first. */
    rooms: ForwardDialogRoom[];
    /** Maximum number of rooms to show before collapsing the rest behind an "and N others" item. */
    truncateAt: number;
}

export interface ForwardDialogViewActions {
    /**
     * Called when the user types in the search input to filter rooms.
     * @param query - The raw text of the search input.
     */
    search: (query: string) => void;
    /**
     * Forward the message to the given room.
     * @param roomId
     */
    send: (roomId: string) => void;
    /**
     * Navigate to the given room and close the dialog.
     * @param roomId
     * @param viaKeyboard - Whether the room was opened with the keyboard rather than a pointer.
     */
    openRoom: (roomId: string, viaKeyboard: boolean) => void;
    /**
     * Called when the user activates the "and N others" item to reveal every room.
     */
    showAllRooms: () => void;
    /**
     * Renders the avatar for a room in the list.
     * @param roomId
     * @param size - The size of the avatar to render (e.g., "32px").
     */
    renderRoomAvatar: (roomId: string, size: string) => ReactNode;
}

/** The view model for the forward dialog. */
export type ForwardDialogViewModel = ViewModel<ForwardDialogViewSnapshot, ForwardDialogViewActions>;

interface ForwardDialogViewProps extends ComponentProps<"div"> {
    /** The view model for the forward dialog. */
    vm: ForwardDialogViewModel;
    /** A rendering of the message being forwarded, shown above the room list. */
    preview: ReactNode;
    /** Optional CSS class name to apply to the element wrapping the preview. */
    previewClassName?: string;
}

/**
 * The body of the dialog used to forward a message to another room.
 * Shows a preview of the message, then a searchable list of rooms. Each row has a
 * "Send" button that forwards the message; activating the row itself opens the room.
 * Pressing ArrowDown in the search input moves focus into the list.
 *
 * @example
 * ```tsx
 * <ForwardDialogView vm={forwardDialogViewModel} preview={<EventTile ... />} />
 * ```
 */
export function ForwardDialogView({
    vm,
    preview,
    previewClassName,
    className,
    ...props
}: Readonly<ForwardDialogViewProps>): JSX.Element {
    const { rooms, truncateAt } = useViewModel(vm);
    const listWrapperRef = useRef<HTMLDivElement>(null);

    const visibleRooms = rooms.slice(0, truncateAt);
    const overflowCount = rooms.length - visibleRooms.length;

    const onSearchKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key !== "ArrowDown") return;
        listWrapperRef.current?.querySelector<HTMLElement>("[role='listbox']")?.focus();
        ev.preventDefault();
    };

    return (
        <div className={classNames(styles.container, className)} {...props}>
            <h3 className={styles.heading}>{_t("forward_dialog|message_preview_heading")}</h3>
            <div className={classNames(styles.preview, previewClassName)}>{preview}</div>
            <hr className={styles.separator} />
            <Form.Root>
                <Search
                    autoFocus
                    className={styles.searchInput}
                    name="roomSearch"
                    placeholder={_t("forward_dialog|filter_placeholder")}
                    aria-label={_t("forward_dialog|filter_placeholder")}
                    onChange={(ev) => vm.search(ev.target.value)}
                        onKeyDown={onSearchKeyDown} />
            </Form.Root>
            <div ref={listWrapperRef} className={styles.list}>
                <RichList title={_t("forward_dialog|send_to")} className={styles.list} isEmpty={rooms.length === 0}>
                    {rooms.length === 0
                        ? _t("common|no_results")
                        : visibleRooms.map((room) => <RoomItem key={room.id} room={room} vm={vm} />)}
                    {overflowCount > 0 && (
                        <RichItem
                            avatar={<OverflowHorizontalIcon className={styles.overflowIcon} width="32px" height="32px" />}
                            title={_t("common|and_n_others", { count: overflowCount })}
                            description=""
                            onClick={vm.showAllRooms}
                        />
                    )}
                </RichList>
            </div>
        </div>
    );
}

interface RoomItemProps {
    room: ForwardDialogRoom;
    vm: ForwardDialogViewModel;
}

/**
 * A single room in the list. Activating the row opens the room; the trailing
 * "Send" button forwards the message to it.
 */
function RoomItem({ room, vm }: RoomItemProps): JSX.Element {
    let disabled = room.sendState !== "can_send";
    let tooltip: string | undefined;
    let icon: ReactNode;
    switch (room.sendState) {
        case "can_send":
            if (!room.canSend) {
                disabled = true;
                tooltip = _t("forward_dialog|no_perms_title");
            }
            break;
        case "sending":
            tooltip = _t("common|sending");
            icon = <InlineSpinner size={16} />;
            break;
        case "sent":
            tooltip = _t("common|sent");
            icon = <CheckIcon width="16px" height="16px" />;
            break;
        case "failed":
            tooltip = _t("timeline|send_state_failed");
            icon = <ErrorIcon width="16px" height="16px" />;
            break;
    }

    let sendButton = (
        <Button
            kind={room.sendState === "failed" ? "destructive" : "secondary"}
            size="md"
            Icon={icon ? () => <>{icon}</> : undefined}
            disabled={disabled}
            aria-label={tooltip}
            data-send-state={room.sendState}
            onClick={() => vm.send(room.id)}
        >
            {_t("common|send")}
        </Button>
    );
    if (tooltip) {
        sendButton = (
            <Tooltip label={tooltip} placement="top">
                {sendButton}
            </Tooltip>
        );
    }

    return (
        <RichItem
            avatar={vm.renderRoomAvatar(room.id, "32px")}
            title={room.name}
            description={room.description}
            aria-description={_t("forward_dialog|open_room")}
            // A click synthesised from the keyboard has no pointer, so its detail is 0.
            onClick={(ev) => vm.openRoom(room.id, ev.detail === 0)}
            actions={sendButton}
        />
    );
}
