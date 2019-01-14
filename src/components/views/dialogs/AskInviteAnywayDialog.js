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
        unknownProfileUsers: PropTypes.array.isRequired, // [ {userId, errorText}... ]
        onInviteAnyways: PropTypes.func.isRequired,
        onGiveUp: PropTypes.func.isRequired,
        onFinished: PropTypes.func.isRequired,
    },

    _onInviteClicked: function() {
        this.props.onInviteAnyways();
        this.props.onFinished(true);
    },

    _onInviteNeverWarnClicked: function() {
        SettingsStore.setValue("alwaysInviteUnknownUsers", null, SettingLevel.ACCOUNT, true);
        this.props.onInviteAnyways();
        this.props.onFinished(true);
    },

    _onGiveUpClicked: function() {
        this.props.onGiveUp();
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        const errorList = this.props.unknownProfileUsers
            .map(address => <li key={address.userId}>{address.userId}: {address.errorText}</li>);

        return (
            <BaseDialog className='mx_RetryInvitesDialog'
                onFinished={this._onGiveUpClicked}
                title={_t('The following users may not exist')}
                contentId='mx_Dialog_content'
            >
                <div id='mx_Dialog_content'>
                    <p>{_t("The following users may not exist - would you like to invite them anyways?")}</p>
                    <ul>
                        { errorList }
                    </ul>
                </div>

                <div className="mx_Dialog_buttons">
                    <button onClick={this._onGiveUpClicked}>
                        { _t('Close') }
                    </button>
                    <button onClick={this._onInviteNeverWarnClicked}>
                        { _t('Invite anyways and never warn me again') }
                    </button>
                    <button onClick={this._onInviteClicked} autoFocus="true">
                        { _t('Invite anyways') }
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
