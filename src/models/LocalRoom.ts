/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, Room, PendingEventOrdering } from "matrix-js-sdk/src/matrix";

import { type Member } from "../utils/direct-messages";

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
    public afterCreateCallbacks: ((roomId: string) => void)[] = [];
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
