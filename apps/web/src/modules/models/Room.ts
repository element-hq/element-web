/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type Room as IRoom,
    type MatrixEvent as ModuleMatrixEvent,
    Watchable,
} from "@element-hq/element-web-module-api";
import { type MatrixEvent, RoomEvent, RoomStateEvent, type Room as SdkRoom } from "matrix-js-sdk/src/matrix";

export class Room implements IRoom {
    public name: Watchable<string>;

    public constructor(private sdkRoom: SdkRoom) {
        this.name = new WatchableName(sdkRoom);
    }

    public getLastActiveTimestamp(): number {
        return this.sdkRoom.getLastActiveTimestamp();
    }

    public get id(): string {
        return this.sdkRoom.roomId;
    }

    public getStateEvent(eventType: string, stateKey: string = ""): WatchableStateEvent {
        return new WatchableStateEvent(eventType, stateKey, this.sdkRoom);
    }
}

/**
 * A custom watchable for room name.
 */
class WatchableName extends Watchable<string> {
    public constructor(private sdkRoom: SdkRoom) {
        super(sdkRoom.name);
    }

    private onNameUpdate = (): void => {
        super.value = this.sdkRoom.name;
    };
    protected onFirstWatch(): void {
        this.sdkRoom.on(RoomEvent.Name, this.onNameUpdate);
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomEvent.Name, this.onNameUpdate);
    }
}

class WatchableStateEvent extends Watchable<ModuleMatrixEvent | null> {
    public constructor(
        private eventType: string,
        private stateKey: string,
        private sdkRoom: SdkRoom,
    ) {
        const event = sdkRoom.currentState.getStateEvents(eventType, stateKey);
        super(WatchableStateEvent.sdkEventToModuleEvent(event));
    }

    protected onFirstWatch(): void {
        this.sdkRoom.on(RoomStateEvent.Events, this.updateEvent);
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomStateEvent.Events, this.updateEvent);
    }

    private updateEvent = (event: MatrixEvent): void => {
        if (event.isState() && event.getType() === this.eventType && event.getStateKey() === this.stateKey) {
            this.value = WatchableStateEvent.sdkEventToModuleEvent(event);
        }
    };

    public static sdkEventToModuleEvent(sdkEvent: MatrixEvent | null): ModuleMatrixEvent | null {
        if (!sdkEvent) return null;
        const eventId = sdkEvent.getId();
        const roomId = sdkEvent.getRoomId();
        const sender = sdkEvent.getSender();
        if (!eventId || !roomId || !sender) return null;
        return {
            content: sdkEvent.getContent(),
            eventId,
            originServerTs: sdkEvent.getTs(),
            roomId,
            sender,
            stateKey: sdkEvent.getStateKey(),
            type: sdkEvent.getType(),
            unsigned: sdkEvent.getUnsigned(),
        };
    }
}
