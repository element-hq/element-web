/*
Copyright 2019, 2020, 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { User } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import E2EIcon, { E2EState } from "../rooms/E2EIcon";
import AccessibleButton from "../elements/AccessibleButton";
import BaseDialog from "./BaseDialog";
import { IDevice } from "../right_panel/UserInfo";

interface IProps {
    user: User;
    device: IDevice;
    onFinished(mode?: "legacy" | "sas" | false): void;
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
                    <E2EIcon status={E2EState.Warning} isUser size={24} hideTooltip={true} />
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
                <AccessibleButton kind="primary_outline" onClick={() => onFinished("legacy")}>
                    {_t("encryption|udd|manual_verification_button")}
                </AccessibleButton>
                <AccessibleButton kind="primary_outline" onClick={() => onFinished("sas")}>
                    {_t("encryption|udd|interactive_verification_button")}
                </AccessibleButton>
                <AccessibleButton kind="primary" onClick={() => onFinished(false)}>
                    {_t("action|done")}
                </AccessibleButton>
            </div>
        </BaseDialog>
    );
};

export default UntrustedDeviceDialog;
