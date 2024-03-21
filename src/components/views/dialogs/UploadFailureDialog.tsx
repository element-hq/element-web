/*
Copyright 2019 New Vector Ltd

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

import { _t } from "../../../languageHandler";
import ContentMessages from "../../../ContentMessages";
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
                    b: (sub) => <b>{sub}</b>,
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
                    b: (sub) => <b>{sub}</b>,
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
                    b: (sub) => <b>{sub}</b>,
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
