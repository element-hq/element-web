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

import React from 'react';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

export default class UploadConfirmDialog extends React.Component {
    static propTypes = {
        file: PropTypes.object.isRequired,
        currentIndex: PropTypes.number,
        totalFiles: PropTypes.number,
        onFinished: PropTypes.func.isRequired,
    }

    static defaultProps = {
        totalFiles: 1,
    }

    constructor(props) {
        super(props);

        this._objectUrl = URL.createObjectURL(props.file);
    }

    componentWillUnmount() {
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
    }

    _onCancelClick = () => {
        this.props.onFinished(false);
    }

    _onUploadClick = () => {
        this.props.onFinished(true);
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
        if (this.props.file.type.startsWith('image/')) {
            preview = <div className="mx_UploadConfirmDialog_previewOuter">
                <div className="mx_UploadConfirmDialog_previewInner">
                    <div><img className="mx_UploadConfirmDialog_imagePreview" src={this._objectUrl} /></div>
                    <div>{this.props.file.name}</div>
                </div>
            </div>;
        } else {
            preview = <div>
                <div>
                    <img className="mx_UploadConfirmDialog_fileIcon"
                        src={require("../../../../res/img/files.png")}
                    />
                    {this.props.file.name}
                </div>
            </div>;
        }

        return (
            <BaseDialog className='mx_UploadConfirmDialog'
                fixedWidth={false}
                onFinished={this._onCancelClick}
                title={title}
                contentId='mx_Dialog_content'
            >
                <div id='mx_Dialog_content'>
                    {preview}
                </div>

                <DialogButtons primaryButton={_t('Upload')}
                    hasCancel={false}
                    onPrimaryButtonClick={this._onUploadClick}
                    focus={true}
                />
            </BaseDialog>
        );
    }
}
