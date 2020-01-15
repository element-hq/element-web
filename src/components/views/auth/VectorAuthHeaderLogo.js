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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import SdkConfig from 'matrix-react-sdk/src/SdkConfig';

export default class VectorAuthHeaderLogo extends React.PureComponent {
    static replaces = 'AuthHeaderLogo'

    static propTypes = {
        icon: PropTypes.string,
    }

    render() {
        const brandingConfig = SdkConfig.get().branding;
        let logoUrl = "themes/riot/img/logos/riot-im-logo-black-text.svg";
        if (brandingConfig && brandingConfig.authHeaderLogoUrl) {
            logoUrl = brandingConfig.authHeaderLogoUrl;
        }

        return (
            <div className="mx_AuthHeaderLogo">
                <img src={logoUrl} alt="Riot" />
            </div>
        );
    }
}
