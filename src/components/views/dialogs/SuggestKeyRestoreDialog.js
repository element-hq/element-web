/*
Copyright 2018 New Vector Ltd

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

/**
 * Dialog which asks the user whether they want to restore megolm keys
 * from various sources when they first start using E2E on a new device.
 */
export default React.createClass({
    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        isOnlyDevice: PropTypes.bool.isRequired,
        hasOnlineBackup: PropTypes.bool.isRequired,
        onVerifyDevice: PropTypes.func.isRequired,
        onImportBackup: PropTypes.func.isRequired,
        onRecoverFromBackup: PropTypes.func.isRequired,
        onIgnoreSuggestion: PropTypes.func.isRequired,
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        return (
            <BaseDialog className='mx_SuggestKeyRestoreDialog'
                onFinished={this.props.onFinished}
                title={_t('Restore encryption keys')}
            >
                <div>
                    <p>We don't have a way to decrypt older messages on this device.</p>

                    <p>Your options are:</p>

                    <li>
                        { !this.props.isOnlyDevice ? <ul>Verify this device from one or more of your other ones to automatically sync keys</ul>: '' }
                        { this.props.hasOnlineBackup ? <ul>Enter your recovery key to restore encryption keys from your online backup</ul> : '' }
                        <ul>Import encryption keys from an offline backup</ul>
                        <ul>Continue without restoring keys, syncing keys from your other devices on a best effort basis</ul>
                    </li>

                    <div className="mx_Dialog_buttons">
                        <button onClick={this.props.onVerifyDevice}>
                            { _t('Verify this device') }
                        </button>
                        <button onClick={this.props.onRecoverFromBackup}>
                            { _t('Restore from online backup') }
                        </button>
                        <button onClick={this.props.onImportBackup}>
                            { _t('Restore from offline backup') }
                        </button>
                        <button onClick={this.props.onIgnoreClicked}>
                            { _t('Ignore request') }
                        </button>
                    </div>
                </div>
            </BaseDialog>
        );
    },
});
