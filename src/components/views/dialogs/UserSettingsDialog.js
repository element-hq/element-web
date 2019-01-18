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
import {_t} from '../../../languageHandler';
import SdkConfig from "../../../SdkConfig";

export default React.createClass({
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    render: function () {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const UserSettings = sdk.getComponent('structures.UserSettings');

        return (
            <BaseDialog className='mx_UserSettingsDialog'
                        onFinished={this.props.onFinished}
                        title={_t('Settings')}
                        contentId='mx_Dialog_content'
            >
                <div id='mx_Dialog_content'>
                    <UserSettings
                        onClose={this.props.onFinished}
                        brand={SdkConfig.get().brand}
                        referralBaseUrl={SdkConfig.get().referralBaseUrl}
                        teamToken={SdkConfig.get().teamToken}
                    />
                </div>
            </BaseDialog>
        );
    },
});
