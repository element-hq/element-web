/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, KNOWN_SAFE_ROOM_VERSION, type MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { LOCAL_ROOM_ID_PREFIX, LocalRoom } from "../../../src/models/LocalRoom";
import { determineCreateRoomEncryptionOption, type Member } from "../../../src/utils/direct-messages";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "../crypto";

/**
 * Create a DM local room. This room will not be send to the server and only exists inside the client.
 * It sets up the local room with some artificial state events
 * so that can be used in most components instead of a „real“ room.
 *
 * @async
 * @param {MatrixClient} client
 * @param {Member[]} targets DM partners
 * @returns {Promise<LocalRoom>} Resolves to the new local room
 */
export async function createDmLocalRoom(client: MatrixClient, targets: Member[]): Promise<LocalRoom> {
    const userId = client.getUserId()!;

    const localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + client.makeTxnId(), client, userId);
    const events: MatrixEvent[] = [];

    events.push(
        new MatrixEvent({
            event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
            type: EventType.RoomCreate,
            content: {
                creator: userId,
                room_version: KNOWN_SAFE_ROOM_VERSION,
            },
            state_key: "",
            sender: userId,
            room_id: localRoom.roomId,
            origin_server_ts: Date.now(),
        }),
    );

    if (await determineCreateRoomEncryptionOption(client, targets)) {
        localRoom.encrypted = true;
        events.push(
            new MatrixEvent({
                event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
                type: EventType.RoomEncryption,
                content: {
                    algorithm: MEGOLM_ENCRYPTION_ALGORITHM,
                },
                sender: userId,
                state_key: "",
                room_id: localRoom.roomId,
                origin_server_ts: Date.now(),
            }),
        );
    }

    events.push(
        new MatrixEvent({
            event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
            type: EventType.RoomMember,
            content: {
                displayname: userId,
                membership: KnownMembership.Join,
            },
            state_key: userId,
            sender: userId,
            room_id: localRoom.roomId,
        }),
    );

    targets.forEach((target: Member) => {
        events.push(
            new MatrixEvent({
                event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
                type: EventType.RoomMember,
                content: {
                    displayname: target.name,
                    avatar_url: target.getMxcAvatarUrl() ?? undefined,
                    membership: KnownMembership.Invite,
                    isDirect: true,
                },
                state_key: target.userId,
                sender: userId,
                room_id: localRoom.roomId,
            }),
        );
        events.push(
            new MatrixEvent({
                event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
                type: EventType.RoomMember,
                content: {
                    displayname: target.name,
                    avatar_url: target.getMxcAvatarUrl() ?? undefined,
                    membership: KnownMembership.Join,
                },
                state_key: target.userId,
                sender: target.userId,
                room_id: localRoom.roomId,
            }),
        );
    });

    localRoom.targets = targets;
    localRoom.updateMyMembership(KnownMembership.Join);
    localRoom.addLiveEvents(events, { addToState: true });
    localRoom.currentState.setStateEvents(events);
    localRoom.name = localRoom.getDefaultRoomName(client.getUserId()!);
    client.store.storeRoom(localRoom);

    return localRoom;
}
