/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { GenericEchoChamber, implicitlyReverted, PROPERTY_UPDATED } from "./GenericEchoChamber";
import { getRoomNotifsState, setRoomNotifsState } from "../../RoomNotifs";
import { RoomEchoContext } from "./RoomEchoContext";
import { _t } from "../../languageHandler";
import { Volume } from "../../RoomNotifsTypes";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

export type CachedRoomValues = Volume;

export enum CachedRoomKey {
    NotificationVolume,
}

export class RoomEchoChamber extends GenericEchoChamber<RoomEchoContext, CachedRoomKey, CachedRoomValues> {
    private properties = new Map<CachedRoomKey, CachedRoomValues>();

    public constructor(context: RoomEchoContext) {
        super(context, (k) => this.properties.get(k));
    }

    protected onClientChanged(oldClient, newClient) {
        this.properties.clear();
        if (oldClient) {
            oldClient.removeListener("accountData", this.onAccountData);
        }
        if (newClient) {
            // Register the listeners first
            newClient.on("accountData", this.onAccountData);

            // Then populate the properties map
            this.updateNotificationVolume();
        }
    }

    private onAccountData = (event: MatrixEvent) => {
        if (event.getType() === "m.push_rules") {
            const currentVolume = this.properties.get(CachedRoomKey.NotificationVolume) as Volume;
            const newVolume = getRoomNotifsState(this.context.room.roomId) as Volume;
            if (currentVolume !== newVolume) {
                this.updateNotificationVolume();
            }
        }
    };

    private updateNotificationVolume() {
        this.properties.set(CachedRoomKey.NotificationVolume, getRoomNotifsState(this.context.room.roomId));
        this.markEchoReceived(CachedRoomKey.NotificationVolume);
        this.emit(PROPERTY_UPDATED, CachedRoomKey.NotificationVolume);
    }

    // ---- helpers below here ----

    public get notificationVolume(): Volume {
        return this.getValue(CachedRoomKey.NotificationVolume);
    }

    public set notificationVolume(v: Volume) {
        this.setValue(_t("Change notification settings"), CachedRoomKey.NotificationVolume, v, async () => {
            return setRoomNotifsState(this.context.room.roomId, v);
        }, implicitlyReverted);
    }
}
