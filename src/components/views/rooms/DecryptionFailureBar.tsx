/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { useCallback, useContext, useEffect, useState } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";

import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import AccessibleButton from "../elements/AccessibleButton";
import { OpenToTabPayload } from "../../../dispatcher/payloads/OpenToTabPayload";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import SetupEncryptionDialog from "../dialogs/security/SetupEncryptionDialog";
import { SetupEncryptionStore } from "../../../stores/SetupEncryptionStore";
import Spinner from "../elements/Spinner";

interface IProps {
    failures: MatrixEvent[];
}

// Number of milliseconds to display a loading spinner before prompting the user for action
const WAIT_PERIOD = 5000;

export const DecryptionFailureBar: React.FC<IProps> = ({ failures }) => {
    const context = useContext(MatrixClientContext);

    // Display a spinner for a few seconds before presenting an error message,
    // in case keys are about to arrive
    const [waiting, setWaiting] = useState<boolean>(true);
    useEffect(() => {
        const timeout = setTimeout(() => setWaiting(false), WAIT_PERIOD);
        return () => clearTimeout(timeout);
    }, []);

    // Is this device unverified?
    const [needsVerification, setNeedsVerification] = useState<boolean>(false);
    // Does this user have verified devices other than this device?
    const [hasOtherVerifiedDevices, setHasOtherVerifiedDevices] = useState<boolean>(false);
    // Does this user have key backups?
    const [hasKeyBackup, setHasKeyBackup] = useState<boolean>(false);

    // Keep track of session IDs that the user has sent key
    // requests for using the Resend Key Requests button
    const [requestedSessions, setRequestedSessions] = useState<Set<string>>(new Set());
    // Keep track of whether there are any sessions the user has not yet sent requests for
    const [anyUnrequestedSessions, setAnyUnrequestedSessions] = useState<boolean>(true);

    useEffect(() => {
        setAnyUnrequestedSessions(
            failures.some((event) => {
                const sessionId = event.getWireContent().session_id;
                return sessionId && !requestedSessions.has(sessionId);
            }),
        );
    }, [failures, requestedSessions, setAnyUnrequestedSessions]);

    // Send key requests for any sessions that we haven't previously
    // sent requests for. This is important if, for instance, we
    // failed to decrypt a message because a key was withheld (in
    // which case, we wouldn't bother requesting the key), but have
    // since verified our device. In that case, now that the device is
    // verified, other devices might be willing to share the key with us
    // now.
    const sendKeyRequests = useCallback(() => {
        const newRequestedSessions = new Set(requestedSessions);

        for (const event of failures) {
            const sessionId = event.getWireContent().session_id;
            if (!sessionId || newRequestedSessions.has(sessionId)) continue;
            newRequestedSessions.add(sessionId);
            context.cancelAndResendEventRoomKeyRequest(event);
        }
        setRequestedSessions(newRequestedSessions);
    }, [context, requestedSessions, setRequestedSessions, failures]);

    // Recheck which devices are verified and whether we have key backups
    const updateDeviceInfo = useCallback(async () => {
        const deviceId = context.getDeviceId()!;
        let verified = true; // if we can't get a clear answer, don't bug the user about verifying
        try {
            verified = context.checkIfOwnDeviceCrossSigned(deviceId);
        } catch (e) {
            console.error("Error getting device cross-signing info", e);
        }
        setNeedsVerification(!verified);

        let otherVerifiedDevices = false;
        try {
            const devices = context.getStoredDevicesForUser(context.getUserId()!);
            otherVerifiedDevices = devices.some(
                (device) => device.deviceId !== deviceId && context.checkIfOwnDeviceCrossSigned(device.deviceId),
            );
        } catch (e) {
            console.error("Error getting info about other devices", e);
        }
        setHasOtherVerifiedDevices(otherVerifiedDevices);

        let keyBackup = false;
        try {
            const keys = await context.isSecretStored("m.cross_signing.master");
            keyBackup = keys !== null && Object.keys(keys).length > 0;
        } catch (e) {
            console.error("Error getting info about key backups", e);
        }
        setHasKeyBackup(keyBackup);
    }, [context]);

    // Update our device info on initial render, and continue updating
    // it whenever the client has an update
    useEffect(() => {
        updateDeviceInfo().catch(console.error);
        context.on(CryptoEvent.DevicesUpdated, updateDeviceInfo);
        return () => {
            context.off(CryptoEvent.DevicesUpdated, updateDeviceInfo);
        };
    }, [context, updateDeviceInfo]);

    const onVerifyClick = (): void => {
        Modal.createDialog(SetupEncryptionDialog);
    };

    const onDeviceListClick = (): void => {
        const payload: OpenToTabPayload = { action: Action.ViewUserDeviceSettings };
        defaultDispatcher.dispatch(payload);
    };

    const onResetClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.resetConfirm();
    };

    const statusIndicator = waiting ? (
        <Spinner w={24} h={24} />
    ) : (
        <div className="mx_DecryptionFailureBar_start_status_icon" data-testid="decryption-failure-bar-icon" />
    );

    let className;
    let headline: JSX.Element;
    let message: JSX.Element;
    let button = <React.Fragment />;
    if (waiting) {
        className = "mx_DecryptionFailureBar";
        headline = <React.Fragment>{_t("Decrypting messages…")}</React.Fragment>;
        message = (
            <React.Fragment>
                {_t("Please wait as we try to decrypt your messages. This may take a few moments.")}
            </React.Fragment>
        );
    } else if (needsVerification) {
        if (hasOtherVerifiedDevices || hasKeyBackup) {
            className = "mx_DecryptionFailureBar mx_DecryptionFailureBar--withEnd";
            headline = <React.Fragment>{_t("Verify this device to access all messages")}</React.Fragment>;
            message = (
                <React.Fragment>
                    {_t("This device was unable to decrypt some messages because it has not been verified yet.")}
                </React.Fragment>
            );
            button = (
                <AccessibleButton
                    className="mx_DecryptionFailureBar_end_button"
                    kind="primary"
                    onClick={onVerifyClick}
                    data-testid="decryption-failure-bar-button"
                >
                    {_t("Verify")}
                </AccessibleButton>
            );
        } else {
            className = "mx_DecryptionFailureBar mx_DecryptionFailureBar--withEnd";
            headline = <React.Fragment>{_t("Reset your keys to prevent future decryption errors")}</React.Fragment>;
            message = (
                <React.Fragment>
                    {_t(
                        "You will not be able to access old undecryptable messages, " +
                            "but resetting your keys will allow you to receive new messages.",
                    )}
                </React.Fragment>
            );
            button = (
                <AccessibleButton
                    className="mx_DecryptionFailureBar_end_button"
                    kind="primary"
                    onClick={onResetClick}
                    data-testid="decryption-failure-bar-button"
                >
                    {_t("Reset")}
                </AccessibleButton>
            );
        }
    } else if (hasOtherVerifiedDevices) {
        className = "mx_DecryptionFailureBar mx_DecryptionFailureBar--withEnd";
        headline = <React.Fragment>{_t("Open another device to load encrypted messages")}</React.Fragment>;
        message = (
            <React.Fragment>
                {_t(
                    "This device is requesting decryption keys from your other devices. " +
                        "Opening one of your other devices may speed this up.",
                )}
            </React.Fragment>
        );
        button = (
            <AccessibleButton
                className="mx_DecryptionFailureBar_end_button"
                kind="primary_outline"
                onClick={onDeviceListClick}
                data-testid="decryption-failure-bar-button"
            >
                {_t("View your device list")}
            </AccessibleButton>
        );
    } else {
        className = "mx_DecryptionFailureBar";
        headline = <React.Fragment>{_t("Some messages could not be decrypted")}</React.Fragment>;
        message = (
            <React.Fragment>
                {_t(
                    "Unfortunately, there are no other verified devices to request decryption keys from. " +
                        "Signing in and verifying other devices may help avoid this situation in the future.",
                )}
            </React.Fragment>
        );
    }

    let keyRequestButton = <React.Fragment />;
    if (!needsVerification && hasOtherVerifiedDevices && anyUnrequestedSessions) {
        className = "mx_DecryptionFailureBar mx_DecryptionFailureBar--withEnd";
        keyRequestButton = (
            <AccessibleButton
                className="mx_DecryptionFailureBar_end_button"
                kind="primary"
                onClick={sendKeyRequests}
                data-testid="decryption-failure-bar-button"
            >
                {_t("Resend key requests")}
            </AccessibleButton>
        );
    }

    return (
        <div className={className}>
            <div className="mx_DecryptionFailureBar_start">
                <div className="mx_DecryptionFailureBar_start_status">
                    <div data-testid="decryption-failure-bar-indicator">{statusIndicator}</div>
                </div>
                <div className="mx_DecryptionFailureBar_start_headline">{headline}</div>
                <div className="mx_DecryptionFailureBar_start_message">{message}</div>
            </div>
            <div className="mx_DecryptionFailureBar_end">
                {button}
                {keyRequestButton}
            </div>
        </div>
    );
};
