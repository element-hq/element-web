/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'PostRegistration',

    propTypes: {
        onComplete: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            avatarUrl: null,
            errorString: null,
            busy: false,
        };
    },

    componentWillMount: function() {
        // There is some assymetry between ChangeDisplayName and ChangeAvatar,
        // as ChangeDisplayName will auto-get the name but ChangeAvatar expects
        // the URL to be passed to you (because it's also used for room avatars).
        const cli = MatrixClientPeg.get();
        this.setState({busy: true});
        const self = this;
        cli.getProfileInfo(cli.credentials.userId).done(function(result) {
            self.setState({
                avatarUrl: MatrixClientPeg.get().mxcUrlToHttp(result.avatar_url),
                busy: false,
            });
        }, function(error) {
            self.setState({
                errorString: _t("Failed to fetch avatar URL"),
                busy: false,
            });
        });
    },

    render: function() {
        const ChangeDisplayName = sdk.getComponent('settings.ChangeDisplayName');
        const ChangeAvatar = sdk.getComponent('settings.ChangeAvatar');
        const LoginPage = sdk.getComponent('login.LoginPage');
        const LoginHeader = sdk.getComponent('login.LoginHeader');
        return (
            <LoginPage>
                <div className="mx_Login_box">
                    <LoginHeader />
                    <div className="mx_Login_profile">
                        { _t('Set a display name:') }
                        <ChangeDisplayName />
                        { _t('Upload an avatar:') }
                        <ChangeAvatar
                            initialAvatarUrl={this.state.avatarUrl} />
                        <button onClick={this.props.onComplete}>{ _t('Continue') }</button>
                        { this.state.errorString }
                    </div>
                </div>
            </LoginPage>
        );
    },
});
