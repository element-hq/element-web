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

import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { logger } from "matrix-js-sdk/src/logger";

import { canEncryptToAllUsers } from "../createRoom";
import { Action } from "../dispatcher/actions";
import { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import dis from "../dispatcher/dispatcher";
import { LocalRoom, LocalRoomState } from "../models/LocalRoom";
import { waitForRoomReadyAndApplyAfterCreateCallbacks } from "./local-room";
import { findDMRoom } from "./dm/findDMRoom";
import { privateShouldBeEncrypted } from "./rooms";
import { createDmLocalRoom } from "./dm/createDmLocalRoom";
import { startDm } from "./dm/startDm";

export async function startDmOnFirstMessage(
    client: MatrixClient,
    targets: Member[],
): Promise<Room> {
    const existingRoom = findDMRoom(client, targets);
    if (existingRoom) {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: existingRoom.roomId,
            should_peek: false,
            joining: false,
            metricsTrigger: "MessageUser",
        });
        return existingRoom;
    }

    const room = await createDmLocalRoom(client, targets);
    dis.dispatch({
        action: Action.ViewRoom,
        room_id: room.roomId,
        joining: false,
        targets,
    });
    return room;
}

/**
 * Starts a DM based on a local room.
 *
 * @async
 * @param {MatrixClient} client
 * @param {LocalRoom} localRoom
 * @returns {Promise<string | void>} Resolves to the created room id
 */
export async function createRoomFromLocalRoom(client: MatrixClient, localRoom: LocalRoom): Promise<string | void> {
    if (!localRoom.isNew) {
        // This action only makes sense for new local rooms.
        return;
    }

    localRoom.state = LocalRoomState.CREATING;
    client.emit(ClientEvent.Room, localRoom);

    return startDm(client, localRoom.targets, false).then(
        (roomId) => {
            localRoom.actualRoomId = roomId;
            return waitForRoomReadyAndApplyAfterCreateCallbacks(client, localRoom);
        },
        () => {
            logger.warn(`Error creating DM for local room ${localRoom.roomId}`);
            localRoom.state = LocalRoomState.ERROR;
            client.emit(ClientEvent.Room, localRoom);
        },
    );
}

// This is the interface that is expected by various components in the Invite Dialog and RoomInvite.
// It is a bit awkward because it also matches the RoomMember class from the js-sdk with some extra support
// for 3PIDs/email addresses.
export abstract class Member {
    /**
     * The display name of this Member. For users this should be their profile's display
     * name or user ID if none set. For 3PIDs this should be the 3PID address (email).
     */
    public abstract get name(): string;

    /**
     * The ID of this Member. For users this should be their user ID. For 3PIDs this should
     * be the 3PID address (email).
     */
    public abstract get userId(): string;

    /**
     * Gets the MXC URL of this Member's avatar. For users this should be their profile's
     * avatar MXC URL or null if none set. For 3PIDs this should always be null.
     */
    public abstract getMxcAvatarUrl(): string;
}

export class DirectoryMember extends Member {
    private readonly _userId: string;
    private readonly displayName?: string;
    private readonly avatarUrl?: string;

    // eslint-disable-next-line camelcase
    constructor(userDirResult: { user_id: string, display_name?: string, avatar_url?: string }) {
        super();
        this._userId = userDirResult.user_id;
        this.displayName = userDirResult.display_name;
        this.avatarUrl = userDirResult.avatar_url;
    }

    // These next class members are for the Member interface
    get name(): string {
        return this.displayName || this._userId;
    }

    get userId(): string {
        return this._userId;
    }

    getMxcAvatarUrl(): string {
        return this.avatarUrl;
    }
}

export class ThreepidMember extends Member {
    private readonly id: string;

    constructor(id: string) {
        super();
        this.id = id;
    }

    // This is a getter that would be falsy on all other implementations. Until we have
    // better type support in the react-sdk we can use this trick to determine the kind
    // of 3PID we're dealing with, if any.
    get isEmail(): boolean {
        return this.id.includes('@');
    }

    // These next class members are for the Member interface
    get name(): string {
        return this.id;
    }

    get userId(): string {
        return this.id;
    }

    getMxcAvatarUrl(): string {
        return null;
    }
}

export interface IDMUserTileProps {
    member: Member;
    onRemove(member: Member): void;
}

/**
 * Detects whether a room should be encrypted.
 *
 * @async
 * @param {MatrixClient} client
 * @param {Member[]} targets The members to which run the check against
 * @returns {Promise<boolean>}
 */
export async function determineCreateRoomEncryptionOption(client: MatrixClient, targets: Member[]): Promise<boolean> {
    if (privateShouldBeEncrypted()) {
        // Check whether all users have uploaded device keys before.
        // If so, enable encryption in the new room.
        const has3PidMembers = targets.some(t => t instanceof ThreepidMember);
        if (!has3PidMembers) {
            const targetIds = targets.map(t => t.userId);
            const allHaveDeviceKeys = await canEncryptToAllUsers(client, targetIds);
            if (allHaveDeviceKeys) {
                return true;
            }
        }
    }

    return false;
}
