/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type React from "react";

import type { EventLayout } from "../../EventPresentation/EventPresentation.types";

/** Timeline rendering modes supported by the EventTile shell. */
export type EventTileRenderingMode = "Room" | "Thread" | "ThreadsList" | "File" | "Notification" | "Search" | "Pinned";

/** Plain data attributes rendered on the EventTile root element. */
export interface EventTileViewRootData {
    /** Event identifier exposed through `data-event-id`. */
    eventId?: string;
    /** Configured tile layout exposed through `data-layout`. */
    layout: EventLayout;
    /** Timeline rendering mode exposed through `data-shape`. */
    shape: EventTileRenderingMode;
    /** Whether the event belongs to the current user, exposed through `data-self`. */
    isOwnEvent: boolean;
    /** Whether EventTile renders a reply chain, exposed through `data-has-reply`. */
    hasReply: boolean;
}

/** Shell states consumed by EventTileView without application-specific class names. */
export interface EventTileViewRootStateFlags {
    /** Whether the event is highlighted by search or navigation. */
    highlighted?: boolean;
    /** Whether the event is selected. */
    selected?: boolean;
    /** Whether the event is currently being edited. */
    editing?: boolean;
    /** Whether the event continues the previous event block. */
    continuation?: boolean;
    /** Whether this is the last event in a section. */
    lastInSection?: boolean;
}

/** Root data consumed by the shared EventTile shell. */
export interface EventTileViewRootState {
    /** Stable unique id for the component instance. */
    id: string;
    /** Element used for the EventTile root. Defaults to `li`. */
    as?: React.ElementType;
    /** Optional aria-live value for the root element. */
    ariaLive?: "off";
    /** Stable event scroll token. */
    scrollToken?: string;
    /** Optional permalink used by sender details. */
    permalink?: string;
    /** Plain root data attributes. */
    data: EventTileViewRootData;
    /** Shared shell states, independent of application class naming. */
    state?: EventTileViewRootStateFlags;
}

/** Optional application CSS class overrides for shell-owned structural elements and slot boundaries. */
export interface EventTileViewClassNames {
    root?: string;
    line?: string;
    details?: string;
    avatar?: string;
    senderDetails?: string;
    senderDetailsLink?: string;
    body?: string;
    contextMenu?: string;
    notificationRoomLabel?: string;
    notificationBadge?: string;
    sender?: string;
    timestamp?: string;
    padlock?: string;
    replyChain?: string;
    actionBar?: string;
    footer?: string;
    threadInfo?: string;
    receipt?: string;
}

/** Render-ready children supplied by the application integration layer. */
export interface EventTileViewSlots {
    /** Sender avatar for the current rendering mode. */
    avatar?: React.ReactNode;
    /** Sender profile/details. */
    sender?: React.ReactNode;
    /** Main event body. */
    body: React.ReactNode;
    /** Timestamp rendered by the shell according to the current layout. */
    timestamp?: React.ReactNode;
    /** Padlock rendered by the shell according to the current layout. */
    padlock?: React.ReactNode;
    /** Reply chain rendered above the event body. */
    replyChain?: React.ReactNode;
    /** Action bar rendered by the shell according to the current rendering mode. */
    actionBar?: React.ReactNode;
    /** Event footer rendered by the shell according to the current layout. */
    footer?: React.ReactNode;
    /** Thread information rendered by the shell according to the current layout. */
    threadInfo?: React.ReactNode;
    /** Read receipt or send-state indicator. */
    receipt?: React.ReactNode;
    /** Room avatar used by notification tiles. */
    roomAvatar?: React.ReactNode;
    /** Notification room-name label. */
    notificationRoomLabel?: React.ReactNode;
    /** Unread notification badge. */
    notificationBadge?: React.ReactNode;
    /** Context menu rendered inside the event line. */
    contextMenu?: React.ReactNode;
}

/** DOM refs supplied by the application integration layer. */
export interface EventTileViewRefs {
    /** Ref attached to the root element. */
    root?: React.Ref<HTMLElement>;
}

/** DOM handlers supplied by the application integration layer. */
export interface EventTileViewHandlers {
    /** Root hover start. */
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    /** Root hover end. */
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    /** Root focus entry. */
    onFocus?: React.FocusEventHandler<HTMLElement>;
    /** Root focus exit. */
    onBlur?: React.FocusEventHandler<HTMLElement>;
    /** Event click. */
    onClick?: React.MouseEventHandler<HTMLElement>;
    /** Event context menu. */
    onContextMenu?: React.MouseEventHandler<HTMLElement>;
    /** Permalink click. */
    onPermalinkClick?: React.MouseEventHandler<HTMLAnchorElement>;
    /** Permalink context menu. */
    onPermalinkContextMenu?: React.MouseEventHandler<HTMLElement>;
}

/** Props for the shared EventTile shell. */
export interface EventTileViewProps extends EventTileViewHandlers {
    /** Pure root render state. */
    root: EventTileViewRootState;
    /** Optional application CSS class overrides for shell-owned elements. */
    classNames?: EventTileViewClassNames;
    /** Render-ready children supplied by the application layer. Each slot is rendered inside a named shell boundary. */
    slots: EventTileViewSlots;
    /** DOM refs supplied by the application layer. */
    refs?: EventTileViewRefs;
}
