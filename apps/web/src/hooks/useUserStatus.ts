/**
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { ClientEvent, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";

import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "./useEventEmitter";

const logger = rootLogger.getChild("useUserStatus");

export interface UserStatus {
    emoji: string;
    text: string;
}

export function useUserStatus(userId: string | undefined): UserStatus | undefined {
    const matrixClient = useMatrixClientContext();
    const [rawUserStatus, setRawUserStatus] = useState<unknown | undefined>();

    useTypedEventEmitter(matrixClient, ClientEvent.UserProfileUpdate, (syncedUserId, syncProfile) => {
        if (syncedUserId !== userId) {
            return;
        }
        if (syncProfile["org.matrix.msc4426.status"]) {
            setRawUserStatus(syncProfile["org.matrix.msc4426.status"]);
        }
    });
    useEffect(() => {
        (async () => {
            if (!userId) {
                setRawUserStatus(undefined);
                return;
            }
            if ((await matrixClient.doesServerSupportExtendedProfiles()) === false) {
                setRawUserStatus(undefined);
                return;
            }
            try {
                const result = await matrixClient.getExtendedProfileProperty(userId, "org.matrix.msc4426.status");
                setRawUserStatus(result);
            } catch (ex) {
                if (ex instanceof MatrixError && ex.errcode === "M_NOT_FOUND") {
                    setRawUserStatus(undefined);
                } else {
                    logger.warn(`Failed to get userStatus for ${userId}`, ex);
                }
            }
        })();
    }, [userId, matrixClient]);

    if (typeof rawUserStatus !== "object" || rawUserStatus === null) {
        logger.warn(`value of "org.matrix.msc4426.status" was not an object for ${userId}`);
        return undefined;
    }
    if ("emoji" in rawUserStatus === false || typeof rawUserStatus.emoji !== "string" || !rawUserStatus.emoji) {
        logger.warn(`"emoji" property was not a valid string for ${userId}`);
        return undefined;
    }
    if ("text" in rawUserStatus === false || typeof rawUserStatus.text !== "string" || !rawUserStatus.text) {
        logger.warn(`"status" property was not a valid string for ${userId}`);
        return undefined;
    }

    return {
        emoji: rawUserStatus.emoji,
        text: rawUserStatus.text,
    };
}
