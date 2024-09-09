/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017 Vector Creations Ltd
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback } from "react";
import { Device } from "matrix-js-sdk/src/matrix";

import * as FormattingUtils from "../../../utils/FormattingUtils";
import { _t } from "../../../languageHandler";
import QuestionDialog from "./QuestionDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IManualDeviceKeyVerificationDialogProps {
    userId: string;
    device: Device;
    onFinished(confirm?: boolean): void;
}

export function ManualDeviceKeyVerificationDialog({
    userId,
    device,
    onFinished,
}: IManualDeviceKeyVerificationDialogProps): JSX.Element {
    const mxClient = MatrixClientPeg.safeGet();

    const onLegacyFinished = useCallback(
        (confirm: boolean) => {
            if (confirm) {
                mxClient.setDeviceVerified(userId, device.deviceId, true);
            }
            onFinished(confirm);
        },
        [mxClient, userId, device, onFinished],
    );

    let text;
    if (mxClient?.getUserId() === userId) {
        text = _t("encryption|verification|manual_device_verification_self_text");
    } else {
        text = _t("encryption|verification|manual_device_verification_user_text");
    }

    const fingerprint = device.getFingerprint();
    const key = fingerprint && FormattingUtils.formatCryptoKey(fingerprint);
    const body = (
        <div>
            <p>{text}</p>
            <div className="mx_DeviceVerifyDialog_cryptoSection">
                <ul>
                    <li>
                        <label>{_t("encryption|verification|manual_device_verification_device_name_label")}:</label>{" "}
                        <span>{device.displayName}</span>
                    </li>
                    <li>
                        <label>{_t("encryption|verification|manual_device_verification_device_id_label")}:</label>{" "}
                        <span>
                            <code>{device.deviceId}</code>
                        </span>
                    </li>
                    <li>
                        <label>{_t("encryption|verification|manual_device_verification_device_key_label")}:</label>{" "}
                        <span>
                            <code>
                                <b>{key}</b>
                            </code>
                        </span>
                    </li>
                </ul>
            </div>
            <p>{_t("encryption|verification|manual_device_verification_footer")}</p>
        </div>
    );

    return (
        <QuestionDialog
            title={_t("settings|sessions|verify_session")}
            description={body}
            button={_t("settings|sessions|verify_session")}
            onFinished={onLegacyFinished}
        />
    );
}
