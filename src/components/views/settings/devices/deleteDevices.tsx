/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { IAuthDict, IAuthData } from "matrix-js-sdk/src/interactive-auth";

import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import { InteractiveAuthCallback } from "../../../structures/InteractiveAuth";
import { SSOAuthEntry } from "../../auth/InteractiveAuthEntryComponents";
import InteractiveAuthDialog from "../../dialogs/InteractiveAuthDialog";

const makeDeleteRequest =
    (matrixClient: MatrixClient, deviceIds: string[]) =>
    async (auth: IAuthDict | null): Promise<IAuthData> => {
        return matrixClient.deleteMultipleDevices(deviceIds, auth ?? undefined);
    };

export const deleteDevicesWithInteractiveAuth = async (
    matrixClient: MatrixClient,
    deviceIds: string[],
    onFinished: InteractiveAuthCallback,
): Promise<void> => {
    if (!deviceIds.length) {
        return;
    }
    try {
        await makeDeleteRequest(matrixClient, deviceIds)(null);
        // no interactive auth needed
        onFinished(true, undefined);
    } catch (error) {
        if (error.httpStatus !== 401 || !error.data?.flows) {
            // doesn't look like an interactive-auth failure
            throw error;
        }

        // pop up an interactive auth dialog

        const numDevices = deviceIds.length;
        const dialogAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                title: _t("Use Single Sign On to continue"),
                body: _t("Confirm logging out these devices by using Single Sign On to prove your identity.", {
                    count: numDevices,
                }),
                continueText: _t("Single Sign On"),
                continueKind: "primary",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                title: _t("Confirm signing out these devices", {
                    count: numDevices,
                }),
                body: _t("Click the button below to confirm signing out these devices.", {
                    count: numDevices,
                }),
                continueText: _t("Sign out devices", { count: numDevices }),
                continueKind: "danger",
            },
        };
        Modal.createDialog(InteractiveAuthDialog, {
            title: _t("Authentication"),
            matrixClient: matrixClient,
            authData: error.data,
            onFinished,
            makeRequest: makeDeleteRequest(matrixClient, deviceIds),
            aestheticsForStagePhases: {
                [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
            },
        });
    }
};
