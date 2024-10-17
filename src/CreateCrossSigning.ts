/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { AuthDict, CrossSigningKeys, MatrixClient, MatrixError, UIAFlow, UIAResponse } from "matrix-js-sdk/src/matrix";

import { SSOAuthEntry } from "./components/views/auth/InteractiveAuthEntryComponents";
import Modal from "./Modal";
import { _t } from "./languageHandler";
import InteractiveAuthDialog from "./components/views/dialogs/InteractiveAuthDialog";

async function canUploadKeysWithPasswordOnly(cli: MatrixClient): Promise<boolean> {
    try {
        await cli.uploadDeviceSigningKeys(undefined, {} as CrossSigningKeys);
        // We should never get here: the server should always require
        // UI auth to upload device signing keys. If we do, we upload
        // no keys which would be a no-op.
        logger.log("uploadDeviceSigningKeys unexpectedly succeeded without UI auth!");
        return false;
    } catch (error) {
        if (!(error instanceof MatrixError) || !error.data || !error.data.flows) {
            logger.log("uploadDeviceSigningKeys advertised no flows!");
            return false;
        }
        const canUploadKeysWithPasswordOnly = error.data.flows.some((f: UIAFlow) => {
            return f.stages.length === 1 && f.stages[0] === "m.login.password";
        });
        return canUploadKeysWithPasswordOnly;
    }
}

export async function createCrossSigning(
    cli: MatrixClient,
    isTokenLogin: boolean,
    accountPassword?: string,
): Promise<void> {
    const cryptoApi = cli.getCrypto();
    if (!cryptoApi) {
        throw new Error("No crypto API found!");
    }

    const doBootstrapUIAuth = async (
        makeRequest: (authData: AuthDict) => Promise<UIAResponse<void>>,
    ): Promise<void> => {
        if (accountPassword && (await canUploadKeysWithPasswordOnly(cli))) {
            await makeRequest({
                type: "m.login.password",
                identifier: {
                    type: "m.id.user",
                    user: cli.getUserId(),
                },
                password: accountPassword,
            });
        } else if (isTokenLogin) {
            // We are hoping the grace period is active
            await makeRequest({});
        } else {
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
                matrixClient: cli,
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
    };

    await cryptoApi.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: doBootstrapUIAuth,
    });
}
