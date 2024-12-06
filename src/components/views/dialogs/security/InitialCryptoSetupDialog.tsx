/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import DialogButtons from "../../elements/DialogButtons";
import BaseDialog from "../BaseDialog";
import Spinner from "../../elements/Spinner";
import { createCrossSigning } from "../../../../CreateCrossSigning";

interface Props {
    matrixClient: MatrixClient;
    accountPassword?: string;
    tokenLogin: boolean;
    onFinished: (success?: boolean) => void;
}

/*
 * Walks the user through the process of creating a cross-signing keys.
 * In most cases, only a spinner is shown, but for more
 * complex auth like SSO, the user may need to complete some steps to proceed.
 */
export const InitialCryptoSetupDialog: React.FC<Props> = ({
    matrixClient,
    accountPassword,
    tokenLogin,
    onFinished,
}) => {
    const [error, setError] = useState(false);

    const doSetup = useCallback(async () => {
        const cryptoApi = matrixClient.getCrypto();
        if (!cryptoApi) return;

        setError(false);

        try {
            await createCrossSigning(matrixClient, tokenLogin, accountPassword);

            onFinished(true);
        } catch (e) {
            if (tokenLogin) {
                // ignore any failures, we are relying on grace period here
                onFinished(false);
                return;
            }

            setError(true);
            logger.error("Error bootstrapping cross-signing", e);
        }
    }, [matrixClient, tokenLogin, accountPassword, onFinished]);

    const onCancel = useCallback(() => {
        onFinished(false);
    }, [onFinished]);

    useEffect(() => {
        doSetup();
    }, [doSetup]);

    let content;
    if (error) {
        content = (
            <div>
                <p>{_t("encryption|unable_to_setup_keys_error")}</p>
                <div className="mx_Dialog_buttons">
                    <DialogButtons
                        primaryButton={_t("action|retry")}
                        onPrimaryButtonClick={doSetup}
                        onCancel={onCancel}
                    />
                </div>
            </div>
        );
    } else {
        content = (
            <div>
                <Spinner />
            </div>
        );
    }

    return (
        <BaseDialog
            className="mx_CreateCrossSigningDialog"
            onFinished={onFinished}
            title={_t("encryption|bootstrap_title")}
            hasCancel={false}
            fixedWidth={false}
        >
            <div>{content}</div>
        </BaseDialog>
    );
};
