/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback } from "react";

import { _t } from "../../../../languageHandler";
import DialogButtons from "../../elements/DialogButtons";
import BaseDialog from "../BaseDialog";
import Spinner from "../../elements/Spinner";
import { InitialCryptoSetupStore, useInitialCryptoSetupStatus } from "../../../../stores/InitialCryptoSetupStore";

interface Props {
    /** Callback which is called if the crypto setup failed, and the user clicked the 'cancel' button */
    onCancelled: () => void;
}

/**
 * Walks the user through the process of creating cross-signing keys.
 *
 * In most cases, only a spinner is shown, but for more
 * complex auth like SSO, the user may need to complete some steps to proceed.
 */
export const InitialCryptoSetupDialog: React.FC<Props> = ({ onCancelled }) => {
    const onRetryClick = useCallback(() => {
        InitialCryptoSetupStore.sharedInstance().retry();
    }, []);

    const status = useInitialCryptoSetupStatus(InitialCryptoSetupStore.sharedInstance());

    let content;
    if (status === "error") {
        content = (
            <div>
                <p>{_t("encryption|unable_to_setup_keys_error")}</p>
                <div className="mx_Dialog_buttons">
                    <DialogButtons
                        primaryButton={_t("action|retry")}
                        onPrimaryButtonClick={onRetryClick}
                        onCancel={onCancelled}
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
            title={_t("encryption|bootstrap_title")}
            hasCancel={false}
            fixedWidth={false}
        >
            <div>{content}</div>
        </BaseDialog>
    );
};
