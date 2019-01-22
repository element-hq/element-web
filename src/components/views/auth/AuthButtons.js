/*
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd

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

const React = require('react');
import { _t } from '../../../languageHandler';
const dis = require('../../../dispatcher');
const AccessibleButton = require('../elements/AccessibleButton');

module.exports = React.createClass({
    displayName: 'AuthButtons',

    propTypes: {
    },

    onLoginClick: function() {
        dis.dispatch({ action: 'start_login' });
    },

    onRegisterClick: function() {
        dis.dispatch({ action: 'start_registration' });
    },

    render: function() {
        const loginButton = (
            <div className="mx_AuthButtons_loginButton_wrapper">
                <AccessibleButton className="mx_AuthButtons_loginButton" element="button" onClick={this.onLoginClick}>
                    { _t("Login") }
                </AccessibleButton>
                <AccessibleButton className="mx_AuthButtons_registerButton" element="button" onClick={this.onRegisterClick}>
                    { _t("Register") }
                </AccessibleButton>
            </div>
        );

        return (
            <div className="mx_AuthButtons">
                { loginButton }
            </div>
        );
    },
});
