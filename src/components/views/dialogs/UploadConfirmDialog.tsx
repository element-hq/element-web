/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import React from 'react';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import filesize from "filesize";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { getBlobSafeMimeType } from '../../../utils/blobs';

interface IProps {
    file: File;
    currentIndex: number;
    totalFiles?: number;
    onFinished: (uploadConfirmed: boolean, uploadAll?: boolean) => void;
}

@replaceableComponent("views.dialogs.UploadConfirmDialog")
export default class UploadConfirmDialog extends React.Component<IProps> {
    private objectUrl: string;
    private mimeType: string;

    static defaultProps = {
        totalFiles: 1,
    }

    constructor(props) {
        super(props);

        // Create a fresh `Blob` for previewing (even though `File` already is
        // one) so we can adjust the MIME type if needed.
        this.mimeType = getBlobSafeMimeType(props.file.type);
        const blob = new Blob([props.file], { type:
            this.mimeType,
        });
        this.objectUrl = URL.createObjectURL(blob);
    }

    componentWillUnmount() {
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    }

    private onCancelClick = () => {
        this.props.onFinished(false);
    }

    private onUploadClick = () => {
        this.props.onFinished(true);
    }

    private onUploadAllClick = () => {
        this.props.onFinished(true, true);
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        let title;
        if (this.props.totalFiles > 1 && this.props.currentIndex !== undefined) {
            title = _t(
                "Upload files (%(current)s of %(total)s)",
                {
                    current: this.props.currentIndex + 1,
                    total: this.props.totalFiles,
                },
            );
        } else {
            title = _t('Upload files');
        }

        let preview;
        if (this.mimeType.startsWith('image/')) {
            preview = <div className="mx_UploadConfirmDialog_previewOuter">
                <div className="mx_UploadConfirmDialog_previewInner">
                    <div><img className="mx_UploadConfirmDialog_imagePreview" src={this.objectUrl} /></div>
                    <div>{this.props.file.name} ({filesize(this.props.file.size)})</div>
                </div>
            </div>;
        } else {
            preview = <div>
                <div>
                    <img className="mx_UploadConfirmDialog_fileIcon"
                        src={require("../../../../res/img/feather-customised/files.svg")}
                    />
                    {this.props.file.name} ({filesize(this.props.file.size)})
                </div>
            </div>;
        }

        let uploadAllButton;
        if (this.props.currentIndex + 1 < this.props.totalFiles) {
            uploadAllButton = <button onClick={this.onUploadAllClick}>
                {_t("Upload all")}
            </button>;
        }

        return (
            <BaseDialog className='mx_UploadConfirmDialog'
                fixedWidth={false}
                onFinished={this.onCancelClick}
                title={title}
                contentId='mx_Dialog_content'
            >
                <div id='mx_Dialog_content'>
                    {preview}
                </div>

                <DialogButtons primaryButton={_t('Upload')}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onUploadClick}
                    focus={true}
                >
                    {uploadAllButton}
                </DialogButtons>
            </BaseDialog>
        );
    }
}
