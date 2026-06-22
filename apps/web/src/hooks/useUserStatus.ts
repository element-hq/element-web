/**
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { ClientEvent, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { type UserStatus } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "./useEventEmitter";
import { useFeatureEnabled } from "./useSettings";
import { validateUserStatus } from "../utils/userStatus";

const logger = rootLogger.getChild("useUserStatus");

/**
 * Hook to get the MSC4426 user status for a given user ID. Returns undefined if the feature is disabled,
 * the user does not have a status, or if there was an error fetching the status.
 *
 * @param userId The ID of the user whose status is being fetched.
 * @returns The user's status, or undefined if not available.
 */
export function useUserStatus(userId: string | undefined): UserStatus | undefined {
    const isEnabled = useFeatureEnabled("feature_user_status");
    const matrixClient = useMatrixClientContext();
    const [rawUserStatus, setRawUserStatus] = useState<unknown>();

    useTypedEventEmitter(matrixClient, ClientEvent.UserProfileUpdate, (syncedUserId, syncProfile) => {
        if (syncedUserId !== userId) {
            return;
        }

        setRawUserStatus(syncProfile["org.matrix.msc4426.status"]);
    });
    useEffect(() => {
        (async () => {
            if (!isEnabled) {
                return;
            }
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
    }, [isEnabled, userId, matrixClient]);
    if (!isEnabled) {
        return;
    }

    return validateUserStatus(rawUserStatus);
}
