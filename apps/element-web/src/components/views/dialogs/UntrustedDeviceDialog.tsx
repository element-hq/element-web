/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 , 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type User } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import E2EIcon from "../rooms/E2EIcon";
import AccessibleButton from "../elements/AccessibleButton";
import BaseDialog from "./BaseDialog";
import { type IDevice } from "../right_panel/UserInfo";
import { E2EStatus } from "../../../utils/ShieldUtils";

interface IProps {
    /**
     * The user whose device is untrusted.
     */
    user: User;
    /**
     * The device that is untrusted.
     */
    device: IDevice;
    /**
     * Callback for when the dialog is dismissed.
     * If mode is "sas", the user wants to verify the device with SAS. Otherwise, the dialog was dismissed normally.
     * @param mode The mode of dismissal.
     */
    onFinished(mode?: "sas"): void;
}

const UntrustedDeviceDialog: React.FC<IProps> = ({ device, user, onFinished }) => {
    let askToVerifyText: string;
    let newSessionText: string;

    if (MatrixClientPeg.safeGet().getUserId() === user.userId) {
        newSessionText = _t("encryption|udd|own_new_session_text");
        askToVerifyText = _t("encryption|udd|own_ask_verify_text");
    } else {
        newSessionText = _t("encryption|udd|other_new_session_text", {
            name: user.displayName,
            userId: user.userId,
        });
        askToVerifyText = _t("encryption|udd|other_ask_verify_text");
    }

    return (
        <BaseDialog
            onFinished={onFinished}
            className="mx_UntrustedDeviceDialog"
            title={
                <>
                    <E2EIcon status={E2EStatus.Warning} isUser size={24} hideTooltip={true} />
                    {_t("encryption|udd|title")}
                </>
            }
        >
            <div className="mx_Dialog_content" id="mx_Dialog_content">
                <p>{newSessionText}</p>
                <p>
                    {device.displayName} ({device.deviceId})
                </p>
                <p>{askToVerifyText}</p>
            </div>
            <div className="mx_Dialog_buttons">
                <AccessibleButton kind="primary_outline" onClick={() => onFinished("sas")}>
                    {_t("encryption|udd|interactive_verification_button")}
                </AccessibleButton>
                <AccessibleButton kind="primary" onClick={() => onFinished()}>
                    {_t("action|done")}
                </AccessibleButton>
            </div>
        </BaseDialog>
    );
};

export default UntrustedDeviceDialog;
