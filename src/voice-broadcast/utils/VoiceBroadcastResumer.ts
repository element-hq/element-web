/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { ClientEvent, MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { IDestroyable } from "../../utils/IDestroyable";
import { findRoomLiveVoiceBroadcastFromUserAndDevice } from "./findRoomLiveVoiceBroadcastFromUserAndDevice";
import { resumeVoiceBroadcastInRoom } from "./resumeVoiceBroadcastInRoom";

export class VoiceBroadcastResumer implements IDestroyable {
    private seenRooms = new Set<string>();
    private userId: string;
    private deviceId: string;

    public constructor(
        private client: MatrixClient,
    ) {
        this.client.on(ClientEvent.Room, this.onRoom);
        this.userId = this.client.getUserId();
        this.deviceId = this.client.getDeviceId();
    }

    private onRoom = (room: Room): void => {
        if (this.seenRooms.has(room.roomId)) return;

        this.seenRooms.add(room.roomId);

        const infoEvent = findRoomLiveVoiceBroadcastFromUserAndDevice(
            room,
            this.userId,
            this.deviceId,
        );

        if (infoEvent) {
            resumeVoiceBroadcastInRoom(infoEvent, room, this.client);
        }
    };

    destroy(): void {
        this.client.off(ClientEvent.Room, this.onRoom);
        this.seenRooms = new Set<string>();
    }
}
