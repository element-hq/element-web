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

'use strict';

import React from 'react';
import * as sdk from 'matrix-react-sdk/src/index';
import SdkConfig from 'matrix-react-sdk/src/SdkConfig';

export default class VectorAuthPage extends React.PureComponent {
    static replaces = 'AuthPage'

    render() {
        const AuthFooter = sdk.getComponent('auth.AuthFooter');

        const brandingConfig = SdkConfig.get().branding;
        let backgroundUrl = "themes/riot/img/backgrounds/valley.jpg";
        if (brandingConfig && brandingConfig.welcomeBackgroundUrl) {
            if (Array.isArray(brandingConfig.welcomeBackgroundUrl)) {
                backgroundUrl = brandingConfig.welcomeBackgroundUrl[Math.floor(Math.random() * brandingConfig.welcomeBackgroundUrl.length)];
            } else {
                backgroundUrl = brandingConfig.welcomeBackgroundUrl;
            }
        }

        const pageStyle = {
            background: `center/cover fixed url(${backgroundUrl})`,
        };

        const modalStyle = {
            position: 'relative',
            background: 'initial',
        };

        const blurStyle = {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            filter: 'blur(10px)',
            background: pageStyle.background,
        };

        const modalContentStyle = {
            display: 'flex',
            zIndex: 1,
            background: 'rgba(255, 255, 255, 0.59)',
            borderRadius: '4px',
        };

        return (
            <div className="mx_AuthPage" style={pageStyle}>
                <div className="mx_AuthPage_modal" style={modalStyle}>
                    <div className="mx_AuthPage_modalBlur" style={blurStyle}></div>
                    <div className="mx_AuthPage_modalContent" style={modalContentStyle}>
                        { this.props.children }
                    </div>
                </div>
                <AuthFooter />
            </div>
        );
    }
}
