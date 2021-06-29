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
import { User } from "matrix-js-sdk/src/models/user";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import E2EIcon from "../rooms/E2EIcon";
import AccessibleButton from "../elements/AccessibleButton";
import BaseDialog from "./BaseDialog";
import { IDialogProps } from "./IDialogProps";
import { IDevice } from "../right_panel/UserInfo";

interface IProps extends IDialogProps {
    user: User;
    device: IDevice;
}

const UntrustedDeviceDialog: React.FC<IProps> = ({device, user, onFinished}) => {
    let askToVerifyText;
    let newSessionText;

    if (MatrixClientPeg.get().getUserId() === user.userId) {
        newSessionText = _t("You signed in to a new session without verifying it:");
        askToVerifyText = _t("Verify your other session using one of the options below.");
    } else {
        newSessionText = _t("%(name)s (%(userId)s) signed in to a new session without verifying it:",
            {name: user.displayName, userId: user.userId});
        askToVerifyText = _t("Ask this user to verify their session, or manually verify it below.");
    }

    return <BaseDialog
        onFinished={onFinished}
        className="mx_UntrustedDeviceDialog"
        title={<>
            <E2EIcon status="warning" size={24} hideTooltip={true} />
            { _t("Not Trusted")}
        </>}
    >
        <div className="mx_Dialog_content" id='mx_Dialog_content'>
            <p>{newSessionText}</p>
            <p>{device.getDisplayName()} ({device.deviceId})</p>
            <p>{askToVerifyText}</p>
        </div>
        <div className='mx_Dialog_buttons'>
            <AccessibleButton element="button" kind="secondary" onClick={() => onFinished("legacy")}>
                { _t("Manually Verify by Text") }
            </AccessibleButton>
            <AccessibleButton element="button" kind="secondary" onClick={() => onFinished("sas")}>
                { _t("Interactively verify by Emoji") }
            </AccessibleButton>
            <AccessibleButton kind="primary" onClick={() => onFinished(false)}>
                { _t("Done") }
            </AccessibleButton>
        </div>
    </BaseDialog>;
};

export default UntrustedDeviceDialog;
