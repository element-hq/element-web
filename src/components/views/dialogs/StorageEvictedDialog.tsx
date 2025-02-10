/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import BugReportDialog from "./BugReportDialog";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";

interface IProps {
    onFinished(signOut?: boolean): void;
}

export default class StorageEvictedDialog extends React.Component<IProps> {
    private sendBugReport = (ev: ButtonEvent): void => {
        ev.preventDefault();
        Modal.createDialog(BugReportDialog, {});
    };

    private onSignOutClick = (): void => {
        this.props.onFinished(true);
    };

    public render(): React.ReactNode {
        let logRequest;
        if (SdkConfig.get().bug_report_endpoint_url) {
            logRequest = _t(
                "bug_reporting|log_request",
                {},
                {
                    a: (text) => (
                        <AccessibleButton kind="link_inline" onClick={this.sendBugReport}>
                            {text}
                        </AccessibleButton>
                    ),
                },
            );
        }

        return (
            <BaseDialog
                className="mx_ErrorDialog"
                onFinished={this.props.onFinished}
                title={_t("error|storage_evicted_title")}
                contentId="mx_Dialog_content"
                hasCancel={false}
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    <p>{_t("error|storage_evicted_description_1")}</p>
                    <p>
                        {_t("error|storage_evicted_description_2")} {logRequest}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("action|sign_out")}
                    onPrimaryButtonClick={this.onSignOutClick}
                    focus={true}
                    hasCancel={false}
                />
            </BaseDialog>
        );
    }
}
