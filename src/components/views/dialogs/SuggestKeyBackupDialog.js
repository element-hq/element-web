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

import Modal from '../../../Modal';
import React from 'react';
import PropTypes from 'prop-types';
import sdk from '../../../index';

import { _t, _td } from '../../../languageHandler';

/**
 * Dialog which asks the user whether they want to restore megolm keys
 * from various sources when they first start using E2E on a new device.
 */
export default React.createClass({
    propTypes: {
        onStartNewBackup: PropTypes.func.isRequired,
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        return (
            <BaseDialog className='mx_SuggestKeyRestoreDialog'
                onFinished={this.props.onFinished}
                title={_t('Backup encryption keys on your server?')}
            >
            <div>
                <p>To avoid ever losing your encrypted message history, you
                can save your encryption keys on the server, protected by a recovery key.
                </p>
                <p>To maximise security, your recovery key is never stored by the app,
                so you must store it yourself somewhere safe.</p>
                <p>
                <p>Warning: storing your encryption keys on the server means that
                if someone gains access to your account and also steals your recovery key,
                they will be able to read all of your encrypted conversation history.
                </p>

                <p>Do you wish to generate a recovery key and backup your encryption
                keys on the server?

                <div className="mx_Dialog_buttons">
                    <button onClick={this.props.onStartNewBackup}>
                        { _t("Generate recovery key and enable online backups") }
                    </button>
                    <button onClick={this.props.onFinished}>
                        { _t("I'll stick to manual backups") }
                    </button>
                </div>
            </div>
            </BaseDialog>
        );
    },
});
