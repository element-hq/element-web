/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import {MatrixClientPeg} from './MatrixClientPeg';
import dis from "./dispatcher/dispatcher";
import Modal from './Modal';
import * as sdk from './index';
import { _t } from './languageHandler';
import {RightPanelPhases} from "./stores/RightPanelStorePhases";
import {findDMForUser} from './createRoom';
import {accessSecretStorage} from './CrossSigningManager';
import {verificationMethods} from 'matrix-js-sdk/src/crypto';
import {Action} from './dispatcher/actions';

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

function UntrustedDeviceDialog(props) {
    const {device, user, onFinished} = props;
    const BaseDialog = sdk.getComponent("dialogs.BaseDialog");
    const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
    let askToVerifyText;
    let newSessionText;

    if (MatrixClientPeg.get().getUserId() === user.userId) {
        newSessionText = _t("You signed in to a new session without verifying it:");
        askToVerifyText = _t("Verify your other session using one of the options below.");
    } else {
        newSessionText = _t("%(name)s (%(userId)s) signed in to a new session without verifying it:",
            {name: user.displayName, userId: user.userId});
        askToVerifyText = _t("Ask this user to verify their session, or manually verify it below.");
    }

    return <BaseDialog
        onFinished={onFinished}
        headerImage={require("../res/img/e2e/warning.svg")}
        title={_t("Not Trusted")}>
        <div className="mx_Dialog_content" id='mx_Dialog_content'>
            <p>{newSessionText}</p>
            <p>{device.getDisplayName()} ({device.deviceId})</p>
            <p>{askToVerifyText}</p>
        </div>
        <div className='mx_Dialog_buttons'>
            <AccessibleButton element="button" kind="secondary" onClick={() => onFinished("legacy")}>{_t("Manually Verify by Text")}</AccessibleButton>
            <AccessibleButton element="button" kind="secondary" onClick={() => onFinished("sas")}>{_t("Interactively verify by Emoji")}</AccessibleButton>
            <AccessibleButton kind="primary" onClick={() => onFinished()}>{_t("Done")}</AccessibleButton>
        </div>
    </BaseDialog>;
}

export async function verifyDevice(user, device) {
    const cli = MatrixClientPeg.get();
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

export async function legacyVerifyUser(user) {
    const cli = MatrixClientPeg.get();
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

export async function verifyUser(user) {
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

export function pendingVerificationRequestForUser(user) {
    const cli = MatrixClientPeg.get();
    const dmRoom = findDMForUser(cli, user.userId);
    if (dmRoom) {
        return cli.findVerificationRequestDMInProgress(dmRoom.roomId);
    }
}
