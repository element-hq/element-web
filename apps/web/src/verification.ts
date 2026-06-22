/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 , 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type User, type MatrixClient, type RoomMember } from "matrix-js-sdk/src/matrix";
import { type VerificationRequest } from "matrix-js-sdk/src/crypto-api";

import dis from "./dispatcher/dispatcher";
import { RightPanelPhases } from "./stores/right-panel/RightPanelStorePhases";
import { type IRightPanelCardState } from "./stores/right-panel/RightPanelStoreIPanelState";
import { findDMForUser } from "./utils/dm/findDMForUser";
import { type SdkContextClass } from "./contexts/SDKContextClass.ts";

/**
 * Verify another user.
 *
 * Note: cross-signing must be set up before calling this function.
 */
export async function verifyUser(sdkContext: SdkContextClass, user: User): Promise<void> {
    if (!sdkContext.client) return;
    if (sdkContext.client.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }
    const existingRequest = pendingVerificationRequestForUser(sdkContext.client, user);
    setRightPanel(sdkContext, { member: user, verificationRequest: existingRequest });
}

function setRightPanel(sdkContext: SdkContextClass, state: IRightPanelCardState): void {
    if (sdkContext.rightPanelStore.roomPhaseHistory.some((card) => card.phase == RightPanelPhases.RoomSummary)) {
        sdkContext.rightPanelStore.pushCard({ phase: RightPanelPhases.EncryptionPanel, state });
    } else {
        sdkContext.rightPanelStore.setCards([
            { phase: RightPanelPhases.RoomSummary },
            { phase: RightPanelPhases.MemberInfo, state: { member: state.member } },
            { phase: RightPanelPhases.EncryptionPanel, state },
        ]);
    }
}

export function pendingVerificationRequestForUser(
    matrixClient: MatrixClient,
    user: User | RoomMember,
): VerificationRequest | undefined {
    const dmRoom = findDMForUser(matrixClient, user.userId);
    if (dmRoom) {
        return matrixClient.getCrypto()!.findVerificationRequestDMInProgress(dmRoom.roomId, user.userId);
    }
}
