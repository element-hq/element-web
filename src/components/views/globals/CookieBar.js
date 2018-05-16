/*
Copyright 2018 New Vector Ltd.

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
import dis from '../../../dispatcher';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';

const makeLink = (href) => (sub) =>
    <a
        className="mx_MatrixToolbar_link"
        target="_blank"
        href={href}
    >
        { sub }
    </a>;

export default React.createClass({
    onAccept: function() {
        dis.dispatch({
            action: 'accept_cookies',
        });
    },

    onReject: function() {
        dis.dispatch({
            action: 'reject_cookies',
        });
    },

    render: function() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const toolbarClasses = "mx_MatrixToolbar";
        return (
            <div className={toolbarClasses}>
                <img className="mx_MatrixToolbar_warning" src="img/warning.svg" width="24" height="23" alt="Warning" />
                <div className="mx_MatrixToolbar_content">
                    { _t(
                        "Help us improve Riot by sending usage data. " +
                        "This will use a cookie " +
                        "(see our <CookieLink>cookie</CookieLink> and " +
                        "<PrivacyLink>privacy</PrivacyLink> policies)",
                        {},
                        {
                            // XXX: We need to link to the page that explains our cookies
                            'CookieLink': makeLink("https://riot.im/privacy"),
                            'PrivacyLink': makeLink("https://riot.im/privacy"),
                        },
                    ) }
                </div>
                <AccessibleButton element='button' className="mx_MatrixToolbar_action" onClick={this.onAccept}>
                    { _t("Send usage data") }
                </AccessibleButton>
                <AccessibleButton className="mx_MatrixToolbar_close" onClick={this.onReject}>
                    <img src="img/cancel.svg" width="18" height="18" />
                </AccessibleButton>
            </div>
        );
    },
});
