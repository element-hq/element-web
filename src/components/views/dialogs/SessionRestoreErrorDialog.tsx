/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import QuestionDialog from "./QuestionDialog";
import BugReportDialog from "./BugReportDialog";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    error: unknown;
    onFinished(clear?: boolean): void;
}

export default class SessionRestoreErrorDialog extends React.Component<IProps> {
    private sendBugReport = (): void => {
        Modal.createDialog(BugReportDialog, {
            error: this.props.error,
        });
    };

    private onClearStorageClick = (): void => {
        Modal.createDialog(QuestionDialog, {
            title: _t("action|sign_out"),
            description: <div>{_t("error|session_restore|clear_storage_description")}</div>,
            button: _t("action|sign_out"),
            danger: true,
            onFinished: this.props.onFinished,
        });
    };

    private onRefreshClick = (): void => {
        // Is this likely to help? Probably not, but giving only one button
        // that clears your storage seems awful.
        window.location.reload();
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        const clearStorageButton = (
            <button onClick={this.onClearStorageClick} className="danger">
                {_t("error|session_restore|clear_storage_button")}
            </button>
        );

        let dialogButtons;
        if (SdkConfig.get().bug_report_endpoint_url) {
            dialogButtons = (
                <DialogButtons
                    primaryButton={_t("bug_reporting|send_logs")}
                    onPrimaryButtonClick={this.sendBugReport}
                    focus={true}
                    hasCancel={false}
                >
                    {clearStorageButton}
                </DialogButtons>
            );
        } else {
            dialogButtons = (
                <DialogButtons
                    primaryButton={_t("action|refresh")}
                    onPrimaryButtonClick={this.onRefreshClick}
                    focus={true}
                    hasCancel={false}
                >
                    {clearStorageButton}
                </DialogButtons>
            );
        }

        return (
            <BaseDialog
                className="mx_ErrorDialog"
                onFinished={this.props.onFinished}
                title={_t("error|session_restore|title")}
                contentId="mx_Dialog_content"
                hasCancel={false}
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    <p>{_t("error|session_restore|description_1")}</p>

                    <p>{_t("error|session_restore|description_2", { brand })}</p>

                    <p>{_t("error|session_restore|description_3")}</p>
                </div>
                {dialogButtons}
            </BaseDialog>
        );
    }
}
