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

import { IInvite3PID, MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { Optional } from "matrix-events-sdk";

import { Action } from "../../dispatcher/actions";
import { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { determineCreateRoomEncryptionOption, Member } from "../direct-messages";
import DMRoomMap from "../DMRoomMap";
import { isLocalRoom } from "../localRoom/isLocalRoom";
import { findDMForUser } from "./findDMForUser";
import dis from "../../dispatcher/dispatcher";
import { getAddressType } from "../../UserAddress";
import createRoom from "../../createRoom";

/**
 * Start a DM.
 *
 * @returns {Promise<string | null} Resolves to the room id.
 */
export async function startDm(client: MatrixClient, targets: Member[], showSpinner = true): Promise<string | null> {
    const targetIds = targets.map((t) => t.userId);

    // Check if there is already a DM with these people and reuse it if possible.
    let existingRoom: Optional<Room>;
    if (targetIds.length === 1) {
        existingRoom = findDMForUser(client, targetIds[0]);
    } else {
        existingRoom = DMRoomMap.shared().getDMRoomForIdentifiers(targetIds) ?? undefined;
    }
    if (existingRoom && !isLocalRoom(existingRoom)) {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: existingRoom.roomId,
            should_peek: false,
            joining: false,
            metricsTrigger: "MessageUser",
        });
        return Promise.resolve(existingRoom.roomId);
    }

    const createRoomOptions = { inlineErrors: true } as any; // XXX: Type out `createRoomOptions`

    if (await determineCreateRoomEncryptionOption(client, targets)) {
        createRoomOptions.encryption = true;
    }

    // Check if it's a traditional DM and create the room if required.
    // TODO: [Canonical DMs] Remove this check and instead just create the multi-person DM
    const isSelf = targetIds.length === 1 && targetIds[0] === client.getUserId();
    if (targetIds.length === 1 && !isSelf) {
        createRoomOptions.dmUserId = targetIds[0];
    }

    if (targetIds.length > 1) {
        createRoomOptions.createOpts = targetIds.reduce<{
            invite_3pid: IInvite3PID[];
            invite: string[];
        }>(
            (roomOptions, address) => {
                const type = getAddressType(address);
                if (type === "email") {
                    const invite: IInvite3PID = {
                        id_server: client.getIdentityServerUrl(true)!,
                        medium: "email",
                        address,
                    };
                    roomOptions.invite_3pid.push(invite);
                } else if (type === "mx-user-id") {
                    roomOptions.invite.push(address);
                }
                return roomOptions;
            },
            { invite: [], invite_3pid: [] },
        );
    }

    createRoomOptions.spinner = showSpinner;
    return createRoom(client, createRoomOptions);
}
