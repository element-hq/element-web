/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientStoppedError, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
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

    try {
        const members = (await room.getEncryptionTargetMembers()).map(({ userId }) => userId);
        const inDMMap = !!DMRoomMap.shared().getUserIdForRoomId(room.roomId);

        const verified: string[] = [];
        const unverified: string[] = [];
        for (const userId of members) {
            if (userId === client.getUserId()) continue;
            const userTrust = await crypto.getUserVerificationStatus(userId);

            /* Alarm if any unverified users were verified before. */
            if (userTrust.wasCrossSigningVerified() && !userTrust.isCrossSigningVerified()) {
                return E2EStatus.Warning;
            }
            (userTrust.isCrossSigningVerified() ? verified : unverified).push(userId);
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
    } catch (e) {
        if (!(e instanceof ClientStoppedError)) {
            throw e;
        }

        // The client has been stopped while we were figuring out what to do. Catch the exception to stop it being
        // logged. It probably doesn't really matter what we return.
        logger.warn("shieldStatusForRoom: client stopped");
        return E2EStatus.Normal;
    }
}
