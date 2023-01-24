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

import { ClientEvent, MatrixClient, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";
import { SyncState } from "matrix-js-sdk/src/sync";

import { VoiceBroadcastInfoEventContent, VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "..";
import { IDestroyable } from "../../utils/IDestroyable";
import { findRoomLiveVoiceBroadcastFromUserAndDevice } from "./findRoomLiveVoiceBroadcastFromUserAndDevice";

/**
 * Handles voice broadcasts on app resume (after logging in, reload, crash…).
 */
export class VoiceBroadcastResumer implements IDestroyable {
    public constructor(private client: MatrixClient) {
        if (client.isInitialSyncComplete()) {
            this.resume();
        } else {
            // wait for initial sync
            client.on(ClientEvent.Sync, this.onClientSync);
        }
    }

    private onClientSync = (): void => {
        if (this.client.getSyncState() === SyncState.Syncing) {
            this.client.off(ClientEvent.Sync, this.onClientSync);
            this.resume();
        }
    };

    private resume(): void {
        const userId = this.client.getUserId();
        const deviceId = this.client.getDeviceId();

        if (!userId || !deviceId) {
            // Resuming a voice broadcast only makes sense if there is a user.
            return;
        }

        this.client.getRooms().forEach((room: Room) => {
            const infoEvent = findRoomLiveVoiceBroadcastFromUserAndDevice(room, userId, deviceId);

            if (infoEvent) {
                // Found a live broadcast event from current device; stop it.
                // Stopping it is a temporary solution (see PSF-1669).
                this.sendStopVoiceBroadcastStateEvent(infoEvent);
                return false;
            }
        });
    }

    private sendStopVoiceBroadcastStateEvent(infoEvent: MatrixEvent): void {
        const userId = this.client.getUserId();
        const deviceId = this.client.getDeviceId();
        const roomId = infoEvent.getRoomId();

        if (!userId || !deviceId || !roomId) {
            // We can only send a state event if we know all the IDs.
            return;
        }

        const content: VoiceBroadcastInfoEventContent = {
            device_id: deviceId,
            state: VoiceBroadcastInfoState.Stopped,
        };

        // all events should reference the started event
        const referencedEventId =
            infoEvent.getContent()?.state === VoiceBroadcastInfoState.Started
                ? infoEvent.getId()
                : infoEvent.getContent()?.["m.relates_to"]?.event_id;

        if (referencedEventId) {
            content["m.relates_to"] = {
                rel_type: RelationType.Reference,
                event_id: referencedEventId,
            };
        }

        this.client.sendStateEvent(roomId, VoiceBroadcastInfoEventType, content, userId);
    }

    public destroy(): void {
        this.client.off(ClientEvent.Sync, this.onClientSync);
    }
}
