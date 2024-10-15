/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, MatrixClient, MatrixEvent, RelationType, Room, SyncState } from "matrix-js-sdk/src/matrix";

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
