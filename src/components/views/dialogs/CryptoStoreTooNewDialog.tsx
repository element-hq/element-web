/*
Copyright 2018 New Vector Ltd
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

import React from "react";

import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import QuestionDialog from "./QuestionDialog";

interface IProps {
    onFinished(logout?: boolean): void;
}

const CryptoStoreTooNewDialog: React.FC<IProps> = (props: IProps) => {
    const brand = SdkConfig.get().brand;

    const _onLogoutClicked = (): void => {
        Modal.createDialog(QuestionDialog, {
            title: _t("action|sign_out"),
            description: _t("encryption|incompatible_database_sign_out_description", { brand }),
            button: _t("action|sign_out"),
            focus: false,
            onFinished: (doLogout) => {
                if (doLogout) {
                    dis.dispatch({ action: "logout" });
                    props.onFinished(true);
                }
            },
        });
    };

    const description = _t("encryption|incompatible_database_description", { brand });

    return (
        <BaseDialog
            className="mx_CryptoStoreTooNewDialog"
            contentId="mx_Dialog_content"
            title={_t("encryption|incompatible_database_title")}
            hasCancel={false}
            onFinished={props.onFinished}
        >
            <div className="mx_Dialog_content" id="mx_Dialog_content">
                {description}
            </div>
            <DialogButtons
                primaryButton={_t("encryption|incompatible_database_disable")}
                hasCancel={false}
                onPrimaryButtonClick={() => props.onFinished(false)}
            >
                <button onClick={_onLogoutClicked}>{_t("action|sign_out")}</button>
            </DialogButtons>
        </BaseDialog>
    );
};

export default CryptoStoreTooNewDialog;
