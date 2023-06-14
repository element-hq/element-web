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

import { MatrixClient, Room, PendingEventOrdering } from "matrix-js-sdk/src/matrix";

import { Member } from "../utils/direct-messages";

export const LOCAL_ROOM_ID_PREFIX = "local+";

export enum LocalRoomState {
    NEW, // new local room; only known to the client
    CREATING, // real room is being created
    CREATED, // real room has been created via API; events applied
    ERROR, // error during room creation
}

/**
 * A local room that only exists client side.
 * Its main purpose is to be used for temporary rooms when creating a DM.
 */
export class LocalRoom extends Room {
    /** Whether the actual room should be encrypted. */
    public encrypted = false;
    /** If the actual room has been created, this holds its ID. */
    public actualRoomId?: string;
    /** DM chat partner */
    public targets: Member[] = [];
    /** Callbacks that should be invoked after the actual room has been created. */
    public afterCreateCallbacks: Function[] = [];
    public state: LocalRoomState = LocalRoomState.NEW;

    public constructor(roomId: string, client: MatrixClient, myUserId: string) {
        super(roomId, client, myUserId, { pendingEventOrdering: PendingEventOrdering.Detached });
        this.name = this.getDefaultRoomName(myUserId);
    }

    public get isNew(): boolean {
        return this.state === LocalRoomState.NEW;
    }

    public get isCreated(): boolean {
        return this.state === LocalRoomState.CREATED;
    }

    public get isError(): boolean {
        return this.state === LocalRoomState.ERROR;
    }
}
