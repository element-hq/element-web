/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import type ContentMessages from "../../../ContentMessages";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { fileSize } from "../../../utils/FileUtils";

interface IProps {
    badFiles: File[];
    totalFiles: number;
    contentMessages: ContentMessages;
    onFinished(upload?: boolean): void;
}

/*
 * Tells the user about files we know cannot be uploaded before we even try uploading
 * them. This is named fairly generically but the only thing we check right now is
 * the size of the file.
 */
export default class UploadFailureDialog extends React.Component<IProps> {
    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private onUploadClick = (): void => {
        this.props.onFinished(true);
    };

    public render(): React.ReactNode {
        let message;
        let preview;
        let buttons;
        if (this.props.totalFiles === 1 && this.props.badFiles.length === 1) {
            message = _t(
                "upload_file|error_file_too_large",
                {
                    limit: fileSize(this.props.contentMessages.getUploadLimit()!),
                    sizeOfThisFile: fileSize(this.props.badFiles[0].size),
                },
                {
                    b: (sub) => <strong>{sub}</strong>,
                },
            );
            buttons = (
                <DialogButtons
                    primaryButton={_t("action|ok")}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onCancelClick}
                    focus={true}
                />
            );
        } else if (this.props.totalFiles === this.props.badFiles.length) {
            message = _t(
                "upload_file|error_files_too_large",
                {
                    limit: fileSize(this.props.contentMessages.getUploadLimit()!),
                },
                {
                    b: (sub) => <strong>{sub}</strong>,
                },
            );
            buttons = (
                <DialogButtons
                    primaryButton={_t("action|ok")}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onCancelClick}
                    focus={true}
                />
            );
        } else {
            message = _t(
                "upload_file|error_some_files_too_large",
                {
                    limit: fileSize(this.props.contentMessages.getUploadLimit()!),
                },
                {
                    b: (sub) => <strong>{sub}</strong>,
                },
            );
            const howManyOthers = this.props.totalFiles - this.props.badFiles.length;
            buttons = (
                <DialogButtons
                    primaryButton={_t("upload_file|upload_n_others_button", { count: howManyOthers })}
                    onPrimaryButtonClick={this.onUploadClick}
                    hasCancel={true}
                    cancelButton={_t("upload_file|cancel_all_button")}
                    onCancel={this.onCancelClick}
                    focus={true}
                />
            );
        }

        return (
            <BaseDialog
                className="mx_UploadFailureDialog"
                onFinished={this.onCancelClick}
                title={_t("upload_file|error_title")}
                contentId="mx_Dialog_content"
            >
                <div id="mx_Dialog_content">
                    {message}
                    {preview}
                </div>

                {buttons}
            </BaseDialog>
        );
    }
}
