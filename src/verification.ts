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

import { MatrixClientPeg } from './MatrixClientPeg';
import dis from "./dispatcher/dispatcher";
import Modal from './Modal';
import * as sdk from './index';
import { RightPanelPhases } from "./stores/RightPanelStorePhases";
import { findDMForUser } from './createRoom';
import { accessSecretStorage } from './SecurityManager';
import { verificationMethods } from 'matrix-js-sdk/src/crypto';
import { Action } from './dispatcher/actions';
import UntrustedDeviceDialog from "./components/views/dialogs/UntrustedDeviceDialog";
import {IDevice} from "./components/views/right_panel/UserInfo";

async function enable4SIfNeeded() {
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

export async function verifyDevice(user: User, device: IDevice) {
    const cli = MatrixClientPeg.get();
    if (cli.isGuest()) {
        dis.dispatch({action: 'require_registration'});
        return;
    }
    // if cross-signing is not explicitly disabled, check if it should be enabled first.
    if (cli.getCryptoTrustCrossSignedDevices()) {
        if (!await enable4SIfNeeded()) {
            return;
        }
    }

    Modal.createTrackedDialog("Verification warning", "unverified session", UntrustedDeviceDialog, {
        user,
        device,
        onFinished: async (action) => {
            if (action === "sas") {
                const verificationRequestPromise = cli.legacyDeviceVerification(
                    user.userId,
                    device.deviceId,
                    verificationMethods.SAS,
                );
                dis.dispatch({
                    action: Action.SetRightPanelPhase,
                    phase: RightPanelPhases.EncryptionPanel,
                    refireParams: {member: user, verificationRequestPromise},
                });
            } else if (action === "legacy") {
                const ManualDeviceKeyVerificationDialog =
                    sdk.getComponent("dialogs.ManualDeviceKeyVerificationDialog");
                Modal.createTrackedDialog("Legacy verify session", "legacy verify session",
                    ManualDeviceKeyVerificationDialog,
                    {
                        userId: user.userId,
                        device,
                    },
                );
            }
        },
    });
}

export async function legacyVerifyUser(user: User) {
    const cli = MatrixClientPeg.get();
    if (cli.isGuest()) {
        dis.dispatch({action: 'require_registration'});
        return;
    }
    // if cross-signing is not explicitly disabled, check if it should be enabled first.
    if (cli.getCryptoTrustCrossSignedDevices()) {
        if (!await enable4SIfNeeded()) {
            return;
        }
    }
    const verificationRequestPromise = cli.requestVerification(user.userId);
    dis.dispatch({
        action: Action.SetRightPanelPhase,
        phase: RightPanelPhases.EncryptionPanel,
        refireParams: {member: user, verificationRequestPromise},
    });
}

export async function verifyUser(user: User) {
    const cli = MatrixClientPeg.get();
    if (cli.isGuest()) {
        dis.dispatch({action: 'require_registration'});
        return;
    }
    if (!await enable4SIfNeeded()) {
        return;
    }
    const existingRequest = pendingVerificationRequestForUser(user);
    dis.dispatch({
        action: Action.SetRightPanelPhase,
        phase: RightPanelPhases.EncryptionPanel,
        refireParams: {
            member: user,
            verificationRequest: existingRequest,
        },
    });
}

export function pendingVerificationRequestForUser(user: User) {
    const cli = MatrixClientPeg.get();
    const dmRoom = findDMForUser(cli, user.userId);
    if (dmRoom) {
        return cli.findVerificationRequestDMInProgress(dmRoom.roomId);
    }
}
