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
import SdkConfig from 'matrix-react-sdk/lib/SdkConfig';

import { _t } from 'matrix-react-sdk/lib/languageHandler';

module.exports = () => {
    const brandingConfig = SdkConfig.get().branding;
    let links = [
        {"text": "blog", "url": "https://medium.com/@RiotChat"},
        {"text": "twitter", "url": "https://twitter.com/@RiotChat"},
        {"text": "github", "url": "https://github.com/vector-im/riot-web"},
    ];

    if (brandingConfig && brandingConfig.authFooterLinks) {
        links = brandingConfig.authFooterLinks;
    }

    const authFooterLinks = [];
    for (const linkEntry of links) {
        authFooterLinks.push(
            <a href={linkEntry.url} key={linkEntry.text} target="_blank" rel="noopener">
                {linkEntry.text}
            </a>,
        );
    }

    return (
        <div className="mx_AuthFooter">
            {authFooterLinks}
            <a href="https://matrix.org" target="_blank" rel="noopener">{ _t('powered by Matrix') }</a>
        </div>
    );
};
module.exports.statics = {
    replaces: 'AuthFooter',
};
