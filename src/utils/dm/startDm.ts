/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IInvite3PID, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";

import { Action } from "../../dispatcher/actions";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { determineCreateRoomEncryptionOption, type Member } from "../direct-messages";
import DMRoomMap from "../DMRoomMap";
import { isLocalRoom } from "../localRoom/isLocalRoom";
import { findDMForUser } from "./findDMForUser";
import dis from "../../dispatcher/dispatcher";
import { getAddressType } from "../../UserAddress";
import createRoom, { type IOpts } from "../../createRoom";

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

    const createRoomOptions: IOpts = { inlineErrors: true };

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
