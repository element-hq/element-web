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

import filesize from 'filesize';

import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import ContentMessages from '../../../ContentMessages';

/*
 * Tells the user about files we know cannot be uploaded before we even try uploading
 * them. This is named fairly generically but the only thing we check right now is
 * the size of the file.
 */
export default class UploadFailureDialog extends React.Component {
    static propTypes = {
        badFiles: PropTypes.arrayOf(PropTypes.object).isRequired,
        totalFiles: PropTypes.number.isRequired,
        contentMessages: PropTypes.instanceOf(ContentMessages).isRequired,
        onFinished: PropTypes.func.isRequired,
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

        let message;
        let preview;
        let buttons;
        if (this.props.totalFiles === 1 && this.props.badFiles.length === 1) {
            message = _t(
                "This file is <b>too large</b> to upload. " +
                "The file size limit is %(limit)s but this file is %(sizeOfThisFile)s.",
                {
                    limit: filesize(this.props.contentMessages.getUploadLimit()),
                    sizeOfThisFile: filesize(this.props.badFiles[0].size),
                }, {
                    b: sub => <b>{sub}</b>,
                },
            );
            buttons = <DialogButtons primaryButton={_t('OK')}
                hasCancel={false}
                onPrimaryButtonClick={this._onCancelClick}
                focus={true}
            />;
        } else if (this.props.totalFiles === this.props.badFiles.length) {
            message = _t(
                "These files are <b>too large</b> to upload. " +
                "The file size limit is %(limit)s.",
                {
                    limit: filesize(this.props.contentMessages.getUploadLimit()),
                }, {
                    b: sub => <b>{sub}</b>,
                },
            );
            buttons = <DialogButtons primaryButton={_t('OK')}
                hasCancel={false}
                onPrimaryButtonClick={this._onCancelClick}
                focus={true}
            />;
        } else {
            message = _t(
                "Some files are <b>too large</b> to be uploaded. " +
                "The file size limit is %(limit)s.",
                {
                    limit: filesize(this.props.contentMessages.getUploadLimit()),
                }, {
                    b: sub => <b>{sub}</b>,
                },
            );
            const howManyOthers = this.props.totalFiles - this.props.badFiles.length;
            buttons = <DialogButtons
                primaryButton={_t('Upload %(count)s other files', { count: howManyOthers })}
                onPrimaryButtonClick={this._onUploadClick}
                hasCancel={true}
                cancelButton={_t("Cancel All")}
                onCancel={this._onCancelClick}
                focus={true}
            />;
        }

        return (
            <BaseDialog className='mx_UploadFailureDialog'
                onFinished={this._onCancelClick}
                title={_t("Upload Error")}
                contentId='mx_Dialog_content'
            >
                <div id='mx_Dialog_content'>
                    {message}
                    {preview}
                </div>

                {buttons}
            </BaseDialog>
        );
    }
}
