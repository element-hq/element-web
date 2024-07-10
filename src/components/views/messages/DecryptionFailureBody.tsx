/*
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

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

import React, { forwardRef, ForwardRefExoticComponent, useContext } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";

import { _t } from "../../../languageHandler";
import { IBodyProps } from "./IBodyProps";
import { LocalDeviceVerificationStateContext } from "../../../contexts/LocalDeviceVerificationStateContext";

function getErrorMessage(mxEvent: MatrixEvent, isVerified: boolean | undefined): string {
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
            return _t("timeline|decryption_failure|historical_event_user_not_joined");
    }
    return _t("timeline|decryption_failure|unable_to_decrypt");
}

// A placeholder element for messages that could not be decrypted
export const DecryptionFailureBody = forwardRef<HTMLDivElement, IBodyProps>(({ mxEvent }, ref): React.JSX.Element => {
    const verificationState = useContext(LocalDeviceVerificationStateContext);
    return (
        <div className="mx_DecryptionFailureBody mx_EventTile_content" ref={ref}>
            {getErrorMessage(mxEvent, verificationState)}
        </div>
    );
}) as ForwardRefExoticComponent<IBodyProps>;
