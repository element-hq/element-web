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
import { RoomMember } from "matrix-js-sdk/src/matrix";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

import { MatrixClientPeg } from "./MatrixClientPeg";
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

async function enable4SIfNeeded(): Promise<boolean> {
    const cli = MatrixClientPeg.get();
    if (!cli.isCryptoEnabled()) {
        return false;
    }
    const usk = cli.getCrossSigningId("user_signing");
    if (!usk) {
        await accessSecretStorage();
        return false;
    }

    return true;
}

export async function verifyDevice(user: User, device: IDevice): Promise<void> {
    const cli = MatrixClientPeg.get();
    if (cli.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }
    // if cross-signing is not explicitly disabled, check if it should be enabled first.
    if (cli.getCryptoTrustCrossSignedDevices()) {
        if (!(await enable4SIfNeeded())) {
            return;
        }
    }

    Modal.createDialog(UntrustedDeviceDialog, {
        user,
        device,
        onFinished: async (action): Promise<void> => {
            if (action === "sas") {
                const verificationRequestPromise = cli.legacyDeviceVerification(
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

export async function legacyVerifyUser(user: User): Promise<void> {
    const cli = MatrixClientPeg.get();
    if (cli.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }
    // if cross-signing is not explicitly disabled, check if it should be enabled first.
    if (cli.getCryptoTrustCrossSignedDevices()) {
        if (!(await enable4SIfNeeded())) {
            return;
        }
    }
    const verificationRequestPromise = cli.requestVerification(user.userId);
    setRightPanel({ member: user, verificationRequestPromise });
}

export async function verifyUser(user: User): Promise<void> {
    const cli = MatrixClientPeg.get();
    if (cli.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }
    if (!(await enable4SIfNeeded())) {
        return;
    }
    const existingRequest = pendingVerificationRequestForUser(user);
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

export function pendingVerificationRequestForUser(user: User | RoomMember): VerificationRequest | undefined {
    const cli = MatrixClientPeg.get();
    const dmRoom = findDMForUser(cli, user.userId);
    if (dmRoom) {
        return cli.findVerificationRequestDMInProgress(dmRoom.roomId);
    }
}
