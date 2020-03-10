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
import dis from "./dispatcher";
import Modal from './Modal';
import * as sdk from './index';
import { _t } from './languageHandler';
import {RIGHT_PANEL_PHASES} from "./stores/RightPanelStorePhases";
import {findDMForUser} from './createRoom';
import {accessSecretStorage} from './CrossSigningManager';
import SettingsStore from './settings/SettingsStore';

export async function enable4SIfNeeded() {
    const cli = MatrixClientPeg.get();
    if (!cli.isCryptoEnabled() || !SettingsStore.isFeatureEnabled("feature_cross_signing")) {
        return false;
    }
    const masterPK = cli.getCrossSigningId();
    if (!masterPK) {
        await accessSecretStorage();
        return false;
    }

    return true;
}

export async function verifyDevice(user, device) {
    if (!await enable4SIfNeeded()) {
        return;
    }
    const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
    Modal.createTrackedDialog("Verification warning", "unverified session", QuestionDialog, {
        headerImage: require("../res/img/e2e/warning.svg"),
        title: _t("Not Trusted"),
        description: <div>
            <p>{_t("%(name)s (%(userId)s) signed in to a new session without verifying it:", {name: user.displayName, userId: user.userId})}</p>
            <p>{device.getDisplayName()} ({device.deviceId})</p>
            <p>{_t("Ask this user to verify their session, or manually verify it below.")}</p>
        </div>,
        onFinished: async (doneClicked) => {
            const manuallyVerifyClicked = !doneClicked;
            if (!manuallyVerifyClicked) {
                return;
            }
            const cli = MatrixClientPeg.get();
            const verificationRequestPromise = cli.requestVerification(
                user.userId,
                [device.deviceId],
            );
            dis.dispatch({
                action: "set_right_panel_phase",
                phase: RIGHT_PANEL_PHASES.EncryptionPanel,
                refireParams: {member: user, verificationRequestPromise},
            });
        },
        primaryButton: _t("Done"),
        cancelButton: _t("Manually Verify"),
    });
}

export async function legacyVerifyUser(user) {
    if (!await enable4SIfNeeded()) {
        return;
    }
    const cli = MatrixClientPeg.get();
    const verificationRequestPromise = cli.requestVerification(user.userId);
    dis.dispatch({
        action: "set_right_panel_phase",
        phase: RIGHT_PANEL_PHASES.EncryptionPanel,
        refireParams: {member: user, verificationRequestPromise},
    });
}

export async function verifyUser(user) {
    if (!await enable4SIfNeeded()) {
        return;
    }
    const cli = MatrixClientPeg.get();
    const dmRoom = findDMForUser(cli, user.userId);
    let existingRequest;
    if (dmRoom) {
        existingRequest = cli.findVerificationRequestDMInProgress(dmRoom.roomId);
    }
    dis.dispatch({
        action: "set_right_panel_phase",
        phase: RIGHT_PANEL_PHASES.EncryptionPanel,
        refireParams: {
            member: user,
            verificationRequest: existingRequest,
        },
    });
}
