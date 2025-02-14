/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type AuthDict, type MatrixClient, MatrixError, type UIAResponse } from "matrix-js-sdk/src/matrix";

import { SSOAuthEntry } from "./components/views/auth/InteractiveAuthEntryComponents";
import Modal from "./Modal";
import { _t } from "./languageHandler";
import InteractiveAuthDialog from "./components/views/dialogs/InteractiveAuthDialog";

/**
 * Ensures that cross signing keys are created and uploaded for the user.
 * The homeserver may require user-interactive auth to upload the keys, in
 * which case the user will be prompted to authenticate.
 *
 * This function does not set up backups of the created cross-signing keys
 * (or message keys): the cross-signing keys are stored locally and will be
 * lost requiring a crypto reset, if the user logs out or loses their session.
 *
 * @param cli The Matrix Client to use
 */
export async function createCrossSigning(cli: MatrixClient): Promise<void> {
    const cryptoApi = cli.getCrypto();
    if (!cryptoApi) {
        throw new Error("No crypto API found!");
    }

    await cryptoApi.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: (makeRequest) => uiAuthCallback(cli, makeRequest),
    });
}

export async function uiAuthCallback(
    matrixClient: MatrixClient,
    makeRequest: (authData: AuthDict) => Promise<UIAResponse<void>>,
): Promise<void> {
    try {
        await makeRequest({});
    } catch (error) {
        if (!(error instanceof MatrixError) || !error.data || !error.data.flows) {
            // Not a UIA response
            throw error;
        }

        const dialogAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                title: _t("auth|uia|sso_title"),
                body: _t("auth|uia|sso_preauth_body"),
                continueText: _t("auth|sso"),
                continueKind: "primary",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                title: _t("encryption|confirm_encryption_setup_title"),
                body: _t("encryption|confirm_encryption_setup_body"),
                continueText: _t("action|confirm"),
                continueKind: "primary",
            },
        };

        const { finished } = Modal.createDialog(InteractiveAuthDialog, {
            title: _t("encryption|bootstrap_title"),
            matrixClient,
            makeRequest,
            aestheticsForStagePhases: {
                [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
            },
        });
        const [confirmed] = await finished;
        if (!confirmed) {
            throw new Error("Cross-signing key upload auth canceled");
        }
    }
}
