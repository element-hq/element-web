/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
        ["_afterCrossSigningLocalKeyChange", _t("a new master key signature")],
        ["checkOwnCrossSigningTrust", _t("a new cross-signing key signature")],
        ["setDeviceVerification", _t("a device cross-signing signature")],
    ]);
    const defaultCause = _t("a key signature");

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
                <p>{_t("%(brand)s encountered an error during upload of:", { brand })}</p>
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
        let text = _t("Upload completed");
        if (!success) {
            text = cancelled ? _t("Cancelled signature upload") : _t("Unable to upload");
        }

        body = (
            <div>
                <span>{text}</span>
                <DialogButtons primaryButton={_t("OK")} hasCancel={false} onPrimaryButtonClick={onFinished} />
            </div>
        );
    }

    return (
        <BaseDialog
            title={success ? _t("Signature upload success") : _t("Signature upload failed")}
            fixedWidth={false}
            onFinished={() => {}}
        >
            {body}
        </BaseDialog>
    );
};

export default KeySignatureUploadFailedDialog;
