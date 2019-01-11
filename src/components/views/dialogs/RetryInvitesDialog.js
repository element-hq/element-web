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
import {SettingLevel} from "../../../settings/SettingsStore";
import SettingsStore from "../../../settings/SettingsStore";

export default React.createClass({
    propTypes: {
        failedInvites: PropTypes.object.isRequired, // { address: { errcode, errorText } }
        onTryAgain: PropTypes.func.isRequired,
        onGiveUp: PropTypes.func.isRequired,
        onFinished: PropTypes.func.isRequired,
    },

    _onTryAgainClicked: function() {
        this.props.onTryAgain();
        this.props.onFinished(true);
    },

    _onTryAgainNeverWarnClicked: function() {
        SettingsStore.setValue("alwaysRetryInvites", null, SettingLevel.ACCOUNT, true);
        this.props.onTryAgain();
        this.props.onFinished(true);
    },

    _onGiveUpClicked: function() {
        this.props.onGiveUp();
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        const errorList = Object.keys(this.props.failedInvites)
            .map(address => <p>{address}: {this.props.failedInvites[address].errorText}</p>);

        return (
            <BaseDialog className='mx_RetryInvitesDialog'
                onFinished={this._onGiveUpClicked}
                title={_t('Failed to invite the following users')}
                contentId='mx_Dialog_content'
            >
                <div id='mx_Dialog_content'>
                    { errorList }
                </div>

                <div className="mx_Dialog_buttons">
                    <button onClick={this._onGiveUpClicked}>
                        { _t('Close') }
                    </button>
                    <button onClick={this._onTryAgainNeverWarnClicked}>
                        { _t('Try again and never warn me again') }
                    </button>
                    <button onClick={this._onTryAgainClicked} autoFocus="true">
                        { _t('Try again') }
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
