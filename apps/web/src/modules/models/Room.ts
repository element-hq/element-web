/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room as IRoom, type MatrixEvent as ModuleMatrixEvent, Watchable } from "@element-hq/element-web-module-api";
import { RoomEvent, type Room as SdkRoom } from "matrix-js-sdk/src/matrix";

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

    public getStateEvent(eventType: string, stateKey: string = ""): ModuleMatrixEvent | null {
        const event = this.sdkRoom.currentState.getStateEvents(eventType, stateKey);
        if (!event) return null;
        const eventId = event.getId();
        const roomId = event.getRoomId();
        const sender = event.getSender();
        if (!eventId || !roomId || !sender) return null;
        return {
            content: event.getContent(),
            eventId,
            originServerTs: event.getTs(),
            roomId,
            sender,
            stateKey: event.getStateKey(),
            type: event.getType(),
            unsigned: event.getUnsigned(),
        };
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
