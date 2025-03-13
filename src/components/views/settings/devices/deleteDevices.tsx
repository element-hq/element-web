/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { type AuthDict, type IAuthData } from "matrix-js-sdk/src/interactive-auth";

import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import { type InteractiveAuthCallback } from "../../../structures/InteractiveAuth";
import { SSOAuthEntry } from "../../auth/InteractiveAuthEntryComponents";
import InteractiveAuthDialog from "../../dialogs/InteractiveAuthDialog";

const makeDeleteRequest =
    (matrixClient: MatrixClient, deviceIds: string[]) =>
    async (auth: AuthDict | null): Promise<IAuthData> => {
        return matrixClient.deleteMultipleDevices(deviceIds, auth ?? undefined);
    };

export const deleteDevicesWithInteractiveAuth = async (
    matrixClient: MatrixClient,
    deviceIds: string[],
    onFinished: InteractiveAuthCallback<void>,
): Promise<void> => {
    if (!deviceIds.length) {
        return;
    }
    try {
        await makeDeleteRequest(matrixClient, deviceIds)(null);
        // no interactive auth needed
        await onFinished(true, undefined);
    } catch (error) {
        if (!(error instanceof MatrixError) || error.httpStatus !== 401 || !error.data?.flows) {
            // doesn't look like an interactive-auth failure
            throw error;
        }

        // pop up an interactive auth dialog

        const numDevices = deviceIds.length;
        const dialogAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                title: _t("auth|uia|sso_title"),
                body: _t("settings|sessions|confirm_sign_out_sso", {
                    count: numDevices,
                }),
                continueText: _t("auth|sso"),
                continueKind: "primary",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                title: _t("settings|sessions|confirm_sign_out", {
                    count: numDevices,
                }),
                body: _t("settings|sessions|confirm_sign_out_body", {
                    count: numDevices,
                }),
                continueText: _t("settings|sessions|confirm_sign_out_continue", { count: numDevices }),
                continueKind: "danger",
            },
        };
        Modal.createDialog(InteractiveAuthDialog, {
            title: _t("common|authentication"),
            matrixClient: matrixClient,
            authData: error.data as IAuthData,
            onFinished,
            makeRequest: makeDeleteRequest(matrixClient, deviceIds),
            aestheticsForStagePhases: {
                [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
            },
        });
    }
};
