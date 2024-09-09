/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, useCallback, useRef } from "react";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Spinner from "../elements/Spinner";

interface IProps {
    failures: Record<
        string,
        Record<
            string,
            {
                errcode: string;
                error: string;
            }
        >
    >;
    source: string;
    continuation: (opts: { shouldEmit: boolean }) => Promise<void>;
    onFinished(): void;
}

const KeySignatureUploadFailedDialog: React.FC<IProps> = ({ failures, source, continuation, onFinished }) => {
    const RETRIES = 2;
    const [retry, setRetry] = useState(RETRIES);
    const [cancelled, setCancelled] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [success, setSuccess] = useState(false);
    const onCancel = useRef(onFinished);

    const causes = new Map([
        ["_afterCrossSigningLocalKeyChange", _t("encryption|key_signature_upload_failed_master_key_signature")],
        ["checkOwnCrossSigningTrust", _t("encryption|key_signature_upload_failed_cross_signing_key_signature")],
        ["setDeviceVerification", _t("encryption|key_signature_upload_failed_device_cross_signing_key_signature")],
    ]);
    const defaultCause = _t("encryption|key_signature_upload_failed_key_signature");

    const onRetry = useCallback(async (): Promise<void> => {
        try {
            setRetrying(true);
            const cancel = new Promise((resolve, reject) => {
                onCancel.current = reject;
            }).finally(() => {
                setCancelled(true);
            });
            await Promise.race([continuation({ shouldEmit: false }), cancel]);
            setSuccess(true);
        } catch (e) {
            setRetry((r) => r - 1);
        } finally {
            onCancel.current = onFinished;
            setRetrying(false);
        }
    }, [continuation, onFinished]);

    let body;
    if (!success && !cancelled && retry > 0) {
        const reason = causes.get(source) || defaultCause;
        const brand = SdkConfig.get().brand;

        body = (
            <div>
                <p>{_t("encryption|key_signature_upload_failed_body", { brand })}</p>
                <p>{reason}</p>
                {retrying && <Spinner />}
                <pre>{JSON.stringify(failures, null, 2)}</pre>
                <DialogButtons
                    primaryButton="Retry"
                    hasCancel={true}
                    onPrimaryButtonClick={onRetry}
                    onCancel={onCancel.current}
                    primaryDisabled={retrying}
                />
            </div>
        );
    } else {
        let text = _t("encryption|key_signature_upload_completed");
        if (!success) {
            text = cancelled
                ? _t("encryption|key_signature_upload_cancelled")
                : _t("encryption|key_signature_upload_failed");
        }

        body = (
            <div>
                <span>{text}</span>
                <DialogButtons primaryButton={_t("action|ok")} hasCancel={false} onPrimaryButtonClick={onFinished} />
            </div>
        );
    }

    return (
        <BaseDialog
            title={
                success
                    ? _t("encryption|key_signature_upload_success_title")
                    : _t("encryption|key_signature_upload_failed_title")
            }
            fixedWidth={false}
            onFinished={() => {}}
        >
            {body}
        </BaseDialog>
    );
};

export default KeySignatureUploadFailedDialog;
