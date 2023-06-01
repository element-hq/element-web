/*
Copyright 2019, 2020, 2021 The Matrix.org Foundation C.I.C.

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

import { User } from "matrix-js-sdk/src/models/user";
import { verificationMethods as VerificationMethods } from "matrix-js-sdk/src/crypto";
import { MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { CrossSigningKey } from "matrix-js-sdk/src/crypto-api";

import dis from "./dispatcher/dispatcher";
import Modal from "./Modal";
import { RightPanelPhases } from "./stores/right-panel/RightPanelStorePhases";
import { accessSecretStorage } from "./SecurityManager";
import UntrustedDeviceDialog from "./components/views/dialogs/UntrustedDeviceDialog";
import { IDevice } from "./components/views/right_panel/UserInfo";
import { ManualDeviceKeyVerificationDialog } from "./components/views/dialogs/ManualDeviceKeyVerificationDialog";
import RightPanelStore from "./stores/right-panel/RightPanelStore";
import { IRightPanelCardState } from "./stores/right-panel/RightPanelStoreIPanelState";
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
    if (matrixClient.getCryptoTrustCrossSignedDevices()) {
        if (!(await enable4SIfNeeded(matrixClient))) {
            return;
        }
    }

    Modal.createDialog(UntrustedDeviceDialog, {
        user,
        device,
        onFinished: async (action): Promise<void> => {
            if (action === "sas") {
                const verificationRequestPromise = matrixClient.legacyDeviceVerification(
                    user.userId,
                    device.deviceId,
                    VerificationMethods.SAS,
                );
                setRightPanel({ member: user, verificationRequestPromise });
            } else if (action === "legacy") {
                Modal.createDialog(ManualDeviceKeyVerificationDialog, {
                    userId: user.userId,
                    device,
                });
            }
        },
    });
}

export async function legacyVerifyUser(matrixClient: MatrixClient, user: User): Promise<void> {
    if (matrixClient.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }
    // if cross-signing is not explicitly disabled, check if it should be enabled first.
    if (matrixClient.getCryptoTrustCrossSignedDevices()) {
        if (!(await enable4SIfNeeded(matrixClient))) {
            return;
        }
    }
    const verificationRequestPromise = matrixClient.requestVerification(user.userId);
    setRightPanel({ member: user, verificationRequestPromise });
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
            { phase: RightPanelPhases.RoomMemberInfo, state: { member: state.member } },
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
        return matrixClient.findVerificationRequestDMInProgress(dmRoom.roomId);
    }
}
