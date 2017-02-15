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
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import Modal from '../../../Modal';


export default React.createClass({
    displayName: 'SessionRestoreErrorDialog',

    propTypes: {
        error: React.PropTypes.string.isRequired,
        onFinished: React.PropTypes.func.isRequired,
    },

    _sendBugReport: function() {
        const BugReportDialog = sdk.getComponent("dialogs.BugReportDialog");
        Modal.createDialog(BugReportDialog, {});
    },

    _continueClicked: function() {
        this.props.onFinished(true);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        let bugreport;

        if (SdkConfig.get().bug_report_endpoint_url) {
            bugreport = (
                <p>Otherwise, <a onClick={this._sendBugReport} href='#'>
                   click here</a> to send a bug report.
                </p>
            );
        }

        return (
            <BaseDialog className="mx_ErrorDialog" onFinished={this.props.onFinished}
                    title='Unable to restore session'>
                <div className="mx_Dialog_content">
                    <p>We encountered an error trying to restore your previous session. If
                    you continue, you will need to log in again, and encrypted chat
                    history will be unreadable.</p>

                    <p>If you have previously used a more recent version of Riot, your session
                    may be incompatible with this version. Close this window and return
                    to the more recent version.</p>

                    {bugreport}
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this._continueClicked}>
                        Continue anyway
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
