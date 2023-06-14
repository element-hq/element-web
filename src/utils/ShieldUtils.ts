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

import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { logger } from "matrix-js-sdk/src/logger";

import DMRoomMap from "./DMRoomMap";
import { asyncSome } from "./arrays";

export enum E2EStatus {
    Warning = "warning",
    Verified = "verified",
    Normal = "normal",
}

export async function shieldStatusForRoom(client: MatrixClient, room: Room): Promise<E2EStatus> {
    const crypto = client.getCrypto();
    if (!crypto) {
        return E2EStatus.Warning;
    }

    const members = (await room.getEncryptionTargetMembers()).map(({ userId }) => userId);
    const inDMMap = !!DMRoomMap.shared().getUserIdForRoomId(room.roomId);

    const verified: string[] = [];
    const unverified: string[] = [];
    members
        .filter((userId) => userId !== client.getUserId())
        .forEach((userId) => {
            (client.checkUserTrust(userId).isCrossSigningVerified() ? verified : unverified).push(userId);
        });

    /* Alarm if any unverified users were verified before. */
    for (const userId of unverified) {
        if (client.checkUserTrust(userId).wasCrossSigningVerified()) {
            return E2EStatus.Warning;
        }
    }

    /* Check all verified user devices. */
    /* Don't alarm if no other users are verified  */
    const includeUser =
        (verified.length > 0 && // Don't alarm for self in rooms where nobody else is verified
            !inDMMap && // Don't alarm for self in DMs with other users
            members.length !== 2) || // Don't alarm for self in 1:1 chats with other users
        members.length === 1; // Do alarm for self if we're alone in a room
    const targets = includeUser ? [...verified, client.getUserId()!] : verified;
    const devicesByUser = await crypto.getUserDeviceInfo(targets);
    for (const userId of targets) {
        const devices = devicesByUser.get(userId);
        if (!devices) {
            // getUserDeviceInfo returned nothing about this user, which means we know nothing about their device list.
            // That seems odd, so treat it as a warning.
            logger.warn(`No device info for user ${userId}`);
            return E2EStatus.Warning;
        }

        const anyDeviceNotVerified = await asyncSome(devices.keys(), async (deviceId) => {
            const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId);
            return !verificationStatus?.isVerified();
        });
        if (anyDeviceNotVerified) {
            return E2EStatus.Warning;
        }
    }

    return unverified.length === 0 ? E2EStatus.Verified : E2EStatus.Normal;
}
