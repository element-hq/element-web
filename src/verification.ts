/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 , 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type User, type MatrixClient, type RoomMember } from "matrix-js-sdk/src/matrix";
import { CrossSigningKey, type VerificationRequest } from "matrix-js-sdk/src/crypto-api";

import dis from "./dispatcher/dispatcher";
import Modal from "./Modal";
import { RightPanelPhases } from "./stores/right-panel/RightPanelStorePhases";
import { accessSecretStorage } from "./SecurityManager";
import UntrustedDeviceDialog from "./components/views/dialogs/UntrustedDeviceDialog";
import { type IDevice } from "./components/views/right_panel/UserInfo";
import RightPanelStore from "./stores/right-panel/RightPanelStore";
import { type IRightPanelCardState } from "./stores/right-panel/RightPanelStoreIPanelState";
import { findDMForUser } from "./utils/dm/findDMForUser";

async function enable4SIfNeeded(matrixClient: MatrixClient): Promise<boolean> {
    const crypto = matrixClient.getCrypto();
    if (!crypto) return false;
    const usk = await crypto.getCrossSigningKeyId(CrossSigningKey.UserSigning);
    if (!usk) {
        await accessSecretStorage();
        return false;
    }

    return true;
}

export async function verifyDevice(matrixClient: MatrixClient, user: User, device: IDevice): Promise<void> {
    if (matrixClient.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }
    // if cross-signing is not explicitly disabled, check if it should be enabled first.
    if (matrixClient.getCrypto()?.getTrustCrossSignedDevices()) {
        if (!(await enable4SIfNeeded(matrixClient))) {
            return;
        }
    }

    Modal.createDialog(UntrustedDeviceDialog, {
        user,
        device,
        onFinished: async (action): Promise<void> => {
            if (action === "sas") {
                const verificationRequestPromise = matrixClient
                    .getCrypto()
                    ?.requestDeviceVerification(user.userId, device.deviceId);
                setRightPanel({ member: user, verificationRequestPromise });
            }
        },
    });
}

export async function verifyUser(matrixClient: MatrixClient, user: User): Promise<void> {
    if (matrixClient.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }
    if (!(await enable4SIfNeeded(matrixClient))) {
        return;
    }
    const existingRequest = pendingVerificationRequestForUser(matrixClient, user);
    setRightPanel({ member: user, verificationRequest: existingRequest });
}

function setRightPanel(state: IRightPanelCardState): void {
    if (RightPanelStore.instance.roomPhaseHistory.some((card) => card.phase == RightPanelPhases.RoomSummary)) {
        RightPanelStore.instance.pushCard({ phase: RightPanelPhases.EncryptionPanel, state });
    } else {
        RightPanelStore.instance.setCards([
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
