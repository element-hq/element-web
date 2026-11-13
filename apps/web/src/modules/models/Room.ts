/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room as IRoom, Watchable } from "@element-hq/element-web-module-api";
import { EventType, type MatrixEvent, RoomEvent, RoomStateEvent, type Room as SdkRoom } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

export class Room implements IRoom {
    public name: Watchable<string>;
    public isEncrypted: Watchable<boolean | undefined>;

    public constructor(private sdkRoom: SdkRoom) {
        this.name = new WatchableName(sdkRoom);
        this.isEncrypted = new WatchableIsEncrypted(sdkRoom);
    }

    public getLastActiveTimestamp(): number {
        return this.sdkRoom.getLastActiveTimestamp();
    }

    public get id(): string {
        return this.sdkRoom.roomId;
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
        this.onNameUpdate();
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomEvent.Name, this.onNameUpdate);
    }
}

/**
 * A custom watchable for whether the room is encrypted.
 * The value is computed via the crypto API on construction, and recomputed whenever the room's
 * encryption state event changes. The method to check is async, so it return undefined until
 * the method returns.
 */
class WatchableIsEncrypted extends Watchable<boolean | undefined> {
    // Incremented on every check so that a slow, stale result can't overwrite a newer one.
    private checkId = 0;

    public constructor(private sdkRoom: SdkRoom) {
        super(undefined);
        void this.updateIsEncrypted();
    }

    private async updateIsEncrypted(): Promise<void> {
        const checkId = ++this.checkId;
        try {
            const isEncrypted = Boolean(
                await this.sdkRoom.client.getCrypto()?.isEncryptionEnabledInRoom(this.sdkRoom.roomId),
            );
            if (checkId === this.checkId) super.value = isEncrypted;
        } catch (e) {
            logger.error(`Failed to check whether room ${this.sdkRoom.roomId} is encrypted`, e);
        }
    }

    private onStateEvent = (event: MatrixEvent): void => {
        if (event.getType() !== EventType.RoomEncryption) return;
        void this.updateIsEncrypted();
    };

    protected onFirstWatch(): void {
        this.sdkRoom.on(RoomStateEvent.Events, this.onStateEvent);
        void this.updateIsEncrypted();
    }

    protected onLastWatch(): void {
        this.sdkRoom.off(RoomStateEvent.Events, this.onStateEvent);
        // Discard any check still in flight.
        this.checkId++;
    }
}
