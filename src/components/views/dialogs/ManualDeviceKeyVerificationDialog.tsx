/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017 Vector Creations Ltd
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type JSX, useCallback, useState } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t, UserFriendlyError } from "../../../languageHandler";
import { getDeviceCryptoInfo } from "../../../utils/crypto/deviceInfo";
import QuestionDialog from "./QuestionDialog";
import Modal from "../../../Modal";
import InfoDialog from "./InfoDialog";
import Field from "../elements/Field";
import ErrorDialog from "./ErrorDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface Props {
    onFinished(confirm?: boolean): void;
}

/**
 * A dialog to allow us to verify devices logged in with clients that can't do
 * the verification themselves. Intended for use as a dev tool.
 *
 * Requires entering the fingerprint ("session key") of the device in an attempt
 * to prevent users being tricked into verifying a malicious device.
 */
export function ManualDeviceKeyVerificationDialog({ onFinished }: Readonly<Props>): JSX.Element {
    const [deviceId, setDeviceId] = useState("");
    const [fingerprint, setFingerprint] = useState("");

    const client = MatrixClientPeg.safeGet();

    const onDialogFinished = useCallback(
        async (confirm: boolean) => {
            if (confirm) {
                await manuallyVerifyDevice(client, deviceId, fingerprint);
            }
            onFinished(confirm);
        },
        [client, deviceId, fingerprint, onFinished],
    );

    const onDeviceIdChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setDeviceId(e.target.value);
    }, []);

    const onFingerprintChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setFingerprint(e.target.value);
    }, []);

    const body = (
        <div>
            <p>{_t("encryption|verification|manual|text")}</p>
            <div className="mx_DeviceVerifyDialog_cryptoSection">
                <Field
                    className="mx_TextInputDialog_input"
                    type="text"
                    label={_t("encryption|verification|manual|device_id")}
                    value={deviceId}
                    onChange={onDeviceIdChange}
                />
                <Field
                    className="mx_TextInputDialog_input"
                    type="text"
                    label={_t("encryption|verification|manual|fingerprint")}
                    value={fingerprint}
                    onChange={onFingerprintChange}
                />
            </div>
        </div>
    );

    return (
        <QuestionDialog
            title={_t("settings|sessions|verify_session")}
            description={body}
            button={_t("settings|sessions|verify_session")}
            onFinished={onDialogFinished}
        />
    );
}

/**
 * Check the supplied fingerprint matches the fingerprint ("session key") of the
 * device with the supplied device ID, and if so, mark the device as verified.
 */
export async function manuallyVerifyDevice(client: MatrixClient, deviceId: string, fingerprint: string): Promise<void> {
    try {
        await doManuallyVerifyDevice(client, deviceId, fingerprint);

        // Tell the user we verified everything
        Modal.createDialog(InfoDialog, {
            title: _t("encryption|verification|manual|success_title"),
            description: (
                <div>
                    <p>{_t("encryption|verification|manual|success_description", { deviceId })}</p>
                </div>
            ),
        });
    } catch (e: any) {
        // Display an error
        const error = e instanceof UserFriendlyError ? e.translatedMessage : e.toString();
        Modal.createDialog(ErrorDialog, {
            title: _t("encryption|verification|manual|failure_title"),
            description: (
                <div>
                    <p>{_t("encryption|verification|manual|failure_description", { deviceId, error })}</p>
                </div>
            ),
        });
    }
}

async function doManuallyVerifyDevice(client: MatrixClient, deviceId: string, fingerprint: string): Promise<void> {
    const userId = client.getUserId();
    if (!userId) {
        throw new UserFriendlyError("encryption|verification|manual|no_userid", {
            cause: undefined,
        });
    }

    const crypto = client.getCrypto();
    if (!crypto) {
        throw new UserFriendlyError("encryption|verification|manual|no_crypto");
    }

    const device = await getDeviceCryptoInfo(client, userId, deviceId);
    if (!device) {
        throw new UserFriendlyError("encryption|verification|manual|no_device", {
            deviceId,
            cause: undefined,
        });
    }
    const deviceTrust = await crypto.getDeviceVerificationStatus(userId, deviceId);

    if (deviceTrust?.isVerified()) {
        if (device.getFingerprint() === fingerprint) {
            throw new UserFriendlyError("encryption|verification|manual|already_verified", {
                deviceId,
                cause: undefined,
            });
        } else {
            throw new UserFriendlyError("encryption|verification|manual|already_verified_and_wrong_fingerprint", {
                deviceId,
                cause: undefined,
            });
        }
    }

    if (device.getFingerprint() !== fingerprint) {
        const fprint = device.getFingerprint();
        throw new UserFriendlyError("encryption|verification|manual|wrong_fingerprint", {
            fprint,
            deviceId,
            fingerprint,
            cause: undefined,
        });
    }

    // We've passed all the checks - do the device verification
    await crypto.crossSignDevice(deviceId);
}
