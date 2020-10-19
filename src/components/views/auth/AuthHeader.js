/*
Copyright 2015, 2016 OpenMarket Ltd
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
import * as sdk from '../../../index';

export default class AuthHeader extends React.Component {
    static propTypes = {
        disableLanguageSelector: PropTypes.bool,
    };

    render() {
        const AuthHeaderLogo = sdk.getComponent('auth.AuthHeaderLogo');
        const LanguageSelector = sdk.getComponent('views.auth.LanguageSelector');

        return (
            <div className="mx_AuthHeader">
                <AuthHeaderLogo />
                <LanguageSelector disabled={this.props.disableLanguageSelector} />
            </div>
        );
    }
}
