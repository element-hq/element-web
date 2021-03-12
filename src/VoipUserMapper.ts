/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { ensureVirtualRoomExists, findDMForUser } from './createRoom';
import { MatrixClientPeg } from "./MatrixClientPeg";
import DMRoomMap from "./utils/DMRoomMap";
import CallHandler, { VIRTUAL_ROOM_EVENT_TYPE } from './CallHandler';
import { Room } from 'matrix-js-sdk/src/models/room';

// Functions for mapping virtual users & rooms. Currently the only lookup
// is sip virtual: there could be others in the future.

export default class VoipUserMapper {
    private virtualRoomIdCache = new Set<string>();

    public static sharedInstance(): VoipUserMapper {
        if (window.mxVoipUserMapper === undefined) window.mxVoipUserMapper = new VoipUserMapper();
        return window.mxVoipUserMapper;
    }

    private async userToVirtualUser(userId: string): Promise<string> {
        const results = await CallHandler.sharedInstance().sipVirtualLookup(userId);
        if (results.length === 0) return null;
        return results[0].userid;
    }

    public async getOrCreateVirtualRoomForRoom(roomId: string): Promise<string> {
        const userId = DMRoomMap.shared().getUserIdForRoomId(roomId);
        if (!userId) return null;

        const virtualUser = await this.userToVirtualUser(userId);
        if (!virtualUser) return null;

        const virtualRoomId = await ensureVirtualRoomExists(MatrixClientPeg.get(), virtualUser, roomId);
        MatrixClientPeg.get().setRoomAccountData(virtualRoomId, VIRTUAL_ROOM_EVENT_TYPE, {
            native_room: roomId,
        });

        return virtualRoomId;
    }

    public nativeRoomForVirtualRoom(roomId: string): string {
        const virtualRoom = MatrixClientPeg.get().getRoom(roomId);
        if (!virtualRoom) return null;
        const virtualRoomEvent = virtualRoom.getAccountData(VIRTUAL_ROOM_EVENT_TYPE);
        if (!virtualRoomEvent || !virtualRoomEvent.getContent()) return null;
        return virtualRoomEvent.getContent()['native_room'] || null;
    }

    public isVirtualRoom(room: Room): boolean {
        if (this.nativeRoomForVirtualRoom(room.roomId)) return true;

        if (this.virtualRoomIdCache.has(room.roomId)) return true;

        // also look in the create event for the claimed native room ID, which is the only
        // way we can recognise a virtual room we've created when it first arrives down
        // our stream. We don't trust this in general though, as it could be faked by an
        // inviter: our main source of truth is the DM state.
        const roomCreateEvent = room.currentState.getStateEvents("m.room.create", "");
        if (!roomCreateEvent || !roomCreateEvent.getContent()) return false;
        // we only look at this for rooms we created (so inviters can't just cause rooms
        // to be invisible)
        if (roomCreateEvent.getSender() !== MatrixClientPeg.get().getUserId()) return false;
        const claimedNativeRoomId = roomCreateEvent.getContent()[VIRTUAL_ROOM_EVENT_TYPE];
        return Boolean(claimedNativeRoomId);
    }

    public async onNewInvitedRoom(invitedRoom: Room) {
        if (!CallHandler.sharedInstance().getSupportsVirtualRooms()) return;

        const inviterId = invitedRoom.getDMInviter();
        console.log(`Checking virtual-ness of room ID ${invitedRoom.roomId}, invited by ${inviterId}`);
        const result = await CallHandler.sharedInstance().sipNativeLookup(inviterId);
        if (result.length === 0) {
            return true;
        }

        if (result[0].fields.is_virtual) {
            const nativeUser = result[0].userid;
            const nativeRoom = findDMForUser(MatrixClientPeg.get(), nativeUser);
            if (nativeRoom) {
                // It's a virtual room with a matching native room, so set the room account data. This
                // will make sure we know where how to map calls and also allow us know not to display
                // it in the future.
                MatrixClientPeg.get().setRoomAccountData(invitedRoom.roomId, VIRTUAL_ROOM_EVENT_TYPE, {
                    native_room: nativeRoom.roomId,
                });
                // also auto-join the virtual room if we have a matching native room
                // (possibly we should only join if we've also joined the native room, then we'd also have
                // to make sure we joined virtual rooms on joining a native one)
                MatrixClientPeg.get().joinRoom(invitedRoom.roomId);
            }

            // also put this room in the virtual room ID cache so isVirtualRoom return the right answer
            // in however long it takes for the echo of setAccountData to come down the sync
            this.virtualRoomIdCache.add(invitedRoom.roomId);
        }
    }
}
