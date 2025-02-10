/*
Copyright 2024 New Vector Ltd.
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { forwardRef, type ForwardRefExoticComponent, useContext } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";
import { BlockIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import { type IBodyProps } from "./IBodyProps";
import { LocalDeviceVerificationStateContext } from "../../../contexts/LocalDeviceVerificationStateContext";

function getErrorMessage(mxEvent: MatrixEvent, isVerified: boolean | undefined): string | React.JSX.Element {
    switch (mxEvent.decryptionFailureReason) {
        case DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE:
            return _t("timeline|decryption_failure|blocked");

        case DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP:
            return _t("timeline|decryption_failure|historical_event_no_key_backup");

        case DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED:
            if (isVerified === false) {
                // The user seems to have a key backup, so prompt them to verify in the hope that doing so will
                // mean we can restore from backup and we'll get the key for this message.
                return _t("timeline|decryption_failure|historical_event_unverified_device");
            }
            // otherwise, use the default.
            break;

        case DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED:
            // TODO: event should be hidden instead of showing this error.
            //   To be revisited as part of https://github.com/element-hq/element-meta/issues/2449
            return _t("timeline|decryption_failure|historical_event_user_not_joined");

        case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
            return (
                <span>
                    <BlockIcon className="mx_Icon mx_Icon_16" />
                    {_t("timeline|decryption_failure|sender_identity_previously_verified")}
                </span>
            );

        case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
            // TODO: event should be hidden instead of showing this error.
            //   To be revisited as part of https://github.com/element-hq/element-meta/issues/2449
            return (
                <span>
                    <BlockIcon className="mx_Icon mx_Icon_16" />
                    {_t("timeline|decryption_failure|sender_unsigned_device")}
                </span>
            );
    }
    return _t("timeline|decryption_failure|unable_to_decrypt");
}

/** Get an extra CSS class, specific to the decryption failure reason */
function errorClassName(mxEvent: MatrixEvent): string | null {
    switch (mxEvent.decryptionFailureReason) {
        case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
        case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
            return "mx_DecryptionFailureSenderTrustRequirement";

        default:
            return null;
    }
}

// A placeholder element for messages that could not be decrypted
export const DecryptionFailureBody = forwardRef<HTMLDivElement, IBodyProps>(({ mxEvent }, ref): React.JSX.Element => {
    const verificationState = useContext(LocalDeviceVerificationStateContext);
    const classes = classNames("mx_DecryptionFailureBody", "mx_EventTile_content", errorClassName(mxEvent));

    return (
        <div className={classes} ref={ref}>
            {getErrorMessage(mxEvent, verificationState)}
        </div>
    );
}) as ForwardRefExoticComponent<IBodyProps>;
