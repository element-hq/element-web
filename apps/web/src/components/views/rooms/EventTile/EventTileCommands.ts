/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { Action } from "../../../../dispatcher/actions";
import type { ActionPayload } from "../../../../dispatcher/payloads";
import type { ShowThreadPayload } from "../../../../dispatcher/payloads/ShowThreadPayload";
import type { ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { ClickMode } from "../../../../models/rooms/EventTileModel";
import type { InteractionName } from "../../../../PosthogTrackers";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import type { EventTileContextMenuState } from "../../../../models/rooms/EventTileTypes";

/**
 * Command-side behaviors for {@link EventTilePresenter}.
 *
 * These functions form a small side-effect boundary between the presenter's
 * React wiring and the application services it needs to call, such as the
 * dispatcher, clipboard helpers, analytics, and platform policy checks.
 *
 * Keeping them separate from presenter hooks preserves a clean split:
 * the presenter composes UI and adapts DOM events, while this module executes
 * command intent in a directly unit-testable form.
 */

/** Side-effect dependencies used by event tile commands. */
export interface EventTileCommandDeps {
    dispatch: (payload: ActionPayload) => void;
    copyPlaintext: (text: string) => Promise<boolean>;
    trackInteraction: (name: InteractionName, ev: Event, index?: number) => void;
    allowOverridingNativeContextMenus: () => boolean;
}

/** Event-specific context used to execute event tile commands. */
export interface EventTileCommandContext {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    openedFromSearch: boolean;
    tileClickMode: ClickMode;
    editState?: EditorStateTransfer;
}

/** Minimal event shape needed for context menu decisions. */
export interface EventTileContextMenuEvent {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
    preventDefault(): void;
    stopPropagation(): void;
}

/** Opens the current event in its room. */
export function openEventInRoom(
    deps: EventTileCommandDeps,
    context: EventTileCommandContext,
    highlighted = true,
): void {
    const payload: ViewRoomPayload = {
        action: Action.ViewRoom,
        event_id: context.mxEvent.getId(),
        highlighted,
        room_id: context.mxEvent.getRoomId(),
        metricsTrigger: undefined,
    };

    deps.dispatch(payload);
}

/** Handles timestamp permalink clicks, including search attribution. */
export function onPermalinkClicked(
    deps: EventTileCommandDeps,
    context: EventTileCommandContext,
    ev: Pick<EventTileContextMenuEvent, "preventDefault">,
): void {
    ev.preventDefault();
    const payload: ViewRoomPayload = {
        action: Action.ViewRoom,
        event_id: context.mxEvent.getId(),
        highlighted: true,
        room_id: context.mxEvent.getRoomId(),
        metricsTrigger: context.openedFromSearch ? "MessageSearch" : undefined,
    };

    deps.dispatch(payload);
}

/** Copies a permalink to the current event thread when available. */
export async function copyLinkToThread(deps: EventTileCommandDeps, context: EventTileCommandContext): Promise<void> {
    if (!context.permalinkCreator) return;
    const eventId = context.mxEvent.getId();
    if (!eventId) return;

    await deps.copyPlaintext(context.permalinkCreator.forEvent(eventId));
}

/** Builds context menu state when the tile should override the native menu. */
export function buildContextMenuState(
    deps: EventTileCommandDeps,
    context: EventTileCommandContext,
    ev: EventTileContextMenuEvent,
    permalink?: string,
): EventTileContextMenuState | undefined {
    const clickTarget = ev.target;
    if (!(clickTarget instanceof HTMLElement) || clickTarget instanceof HTMLImageElement) return undefined;

    const anchorElement = clickTarget instanceof HTMLAnchorElement ? clickTarget : clickTarget.closest("a");
    if (!deps.allowOverridingNativeContextMenus() && anchorElement) return undefined;
    if (context.editState) return undefined;

    ev.preventDefault();
    ev.stopPropagation();

    return {
        position: {
            left: ev.clientX,
            top: ev.clientY,
            bottom: ev.clientY,
        },
        link: anchorElement?.href || permalink,
    };
}

/** Handles click behavior for notification and thread-list tiles. */
export function onListTileClick(
    deps: EventTileCommandDeps,
    context: EventTileCommandContext,
    ev: Event,
    index: number,
): void {
    switch (context.tileClickMode) {
        case ClickMode.ViewRoom:
            openEventInRoom(deps, context);
            break;
        case ClickMode.ShowThread:
            deps.dispatch({
                action: Action.ShowThread,
                rootEvent: context.mxEvent,
                push: true,
            } satisfies ShowThreadPayload);
            deps.trackInteraction("WebThreadsPanelThreadItem", ev, index);
            break;
    }
}
