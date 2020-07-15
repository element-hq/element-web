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

import React, {useState, useCallback, useRef} from 'react';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';

export default function KeySignatureUploadFailedDialog({
        failures,
        source,
        continuation,
        onFinished,
    }) {
    const RETRIES = 2;
    const BaseDialog = sdk.getComponent('dialogs.BaseDialog');
    const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
    const Spinner = sdk.getComponent('elements.Spinner');
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

    const onRetry = useCallback(async () => {
        try {
            setRetrying(true);
            const cancel = new Promise((resolve, reject) => {
                onCancel.current = reject;
            }).finally(() => {
                setCancelled(true);
            });
            await Promise.race([
                continuation(),
                cancel,
            ]);
            setSuccess(true);
        } catch (e) {
            setRetry(r => r-1);
        } finally {
            onCancel.current = onFinished;
            setRetrying(false);
        }
    }, [continuation, onFinished]);

    let body;
    if (!success && !cancelled && continuation && retry > 0) {
        const reason = causes.get(source) || defaultCause;
        const brand = SdkConfig.get().brand;

        body = (<div>
            <p>{_t("%(brand)s encountered an error during upload of:", { brand })}</p>
            <p>{reason}</p>
            {retrying && <Spinner />}
            <pre>{JSON.stringify(failures, null, 2)}</pre>
            <DialogButtons
                primaryButton='Retry'
                hasCancel={true}
                onPrimaryButtonClick={onRetry}
                onCancel={onCancel.current}
                primaryDisabled={retrying}
            />
        </div>);
    } else {
        body = (<div>
            {success ?
              <span>{_t("Upload completed")}</span> :
              cancelled ?
                <span>{_t("Cancelled signature upload")}</span> :
                <span>{_t("Unable to upload")}</span>}
            <DialogButtons
                primaryButton={_t("OK")}
                hasCancel={false}
                onPrimaryButtonClick={onFinished}
            />
        </div>);
    }

    return (
        <BaseDialog
            title={success ?
                _t("Signature upload success") :
                _t("Signature upload failed")}
            fixedWidth={false}
            onFinished={() => {}}
        >
            {body}
        </BaseDialog>
    );
}
