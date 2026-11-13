/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type RoomStateEvent as ModuleRoomStateEvent, Watchable } from "@element-hq/element-web-module-api";
import {
    EventTimeline,
    EventType,
    type MatrixEvent,
    RoomStateEvent as SdkRoomStateEvent,
    type Room as SdkRoom,
    type RoomState,
} from "matrix-js-sdk/src/matrix";
import { isEqual } from "lodash";

/** A watchable snapshot of one event type in a room's live state. */
export class RoomStateEventWatchable extends Watchable<ModuleRoomStateEvent[]> {
    private listening = false;

    public constructor(
        private readonly sdkRoom: SdkRoom,
        private readonly eventType: string,
    ) {
        super(RoomStateEventWatchable.getSnapshot(sdkRoom, eventType));
    }

    protected onFirstWatch(): void {
        this.sdkRoom.on(SdkRoomStateEvent.Events, this.onStateEvent);
        this.listening = true;
        // Watchable invokes this before adding the listener, so defer the initial refresh.
        queueMicrotask(() => this.refresh());
    }

    protected onLastWatch(): void {
        this.detach();
    }

    private detach(): void {
        if (!this.listening) return;
        this.sdkRoom.off(SdkRoomStateEvent.Events, this.onStateEvent);
        this.listening = false;
    }

    private onStateEvent = (event: MatrixEvent, state: RoomState): void => {
        if (
            event.getRoomId() !== this.sdkRoom.roomId ||
            (event.getType() !== this.eventType && event.getType() !== EventType.RoomMember)
        ) {
            return;
        }
        if (state !== this.sdkRoom.getLiveTimeline().getState(EventTimeline.FORWARDS)) return;
        this.refresh();
    };

    private refresh(): void {
        const snapshot = RoomStateEventWatchable.getSnapshot(this.sdkRoom, this.eventType);
        if (!isEqual(snapshot, this.value)) this.value = snapshot;
    }

    private static getSnapshot(sdkRoom: SdkRoom, eventType: string): ModuleRoomStateEvent[] {
        if (sdkRoom.getMyMembership() !== "join") return [];
        const state = sdkRoom.getLiveTimeline().getState(EventTimeline.FORWARDS);
        if (!state) return [];

        return state.getStateEvents(eventType).flatMap((event) => {
            const stateKey = event.getStateKey();
            if (typeof stateKey !== "string") return [];
            return [{ stateKey, content: structuredClone(event.getContent()) }];
        });
    }
}
