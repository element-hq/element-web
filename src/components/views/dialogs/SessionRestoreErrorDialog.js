/*
Copyright 2017 Vector Creations Ltd

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
import SdkConfig from '../../../SdkConfig';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';


export default React.createClass({
    displayName: 'SessionRestoreErrorDialog',

    propTypes: {
        error: PropTypes.string.isRequired,
        onFinished: PropTypes.func.isRequired,
    },

    componentDidMount: function() {
        if (this.refs.bugreportLink) {
            this.refs.bugreportLink.focus();
        }
    },

    _sendBugReport: function() {
        const BugReportDialog = sdk.getComponent("dialogs.BugReportDialog");
        Modal.createTrackedDialog('Session Restore Error', 'Send Bug Report Dialog', BugReportDialog, {});
    },

    _onContinueClick: function() {
        this.props.onFinished(true);
    },

    _onCancelClick: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        let bugreport;

        if (SdkConfig.get().bug_report_endpoint_url) {
            bugreport = (
                <p>
                { _t(
                    "Otherwise, <a>click here</a> to send a bug report.",
                    {},
                    { 'a': (sub) => <a ref="bugreportLink" onClick={this._sendBugReport}
                    key="bugreport" href='#'>{ sub }</a> },
                ) }
                </p>
            );
        }
        const shouldFocusContinueButton =!(bugreport==true);

        return (
            <BaseDialog className="mx_ErrorDialog" onFinished={this.props.onFinished}
                    title={_t('Unable to restore session')}
                contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    <p>{ _t("We encountered an error trying to restore your previous session. If " +
                    "you continue, you will need to log in again, and encrypted chat " +
                    "history will be unreadable.") }</p>

                    <p>{ _t("If you have previously used a more recent version of Riot, your session " +
                    "may be incompatible with this version. Close this window and return " +
                    "to the more recent version.") }</p>

                    { bugreport }
                </div>
                <DialogButtons primaryButton={_t("Continue anyway")}
                    onPrimaryButtonClick={this._onContinueClick} focus={shouldFocusContinueButton}
                    onCancel={this._onCancelClick} />
            </BaseDialog>
        );
    },
});
