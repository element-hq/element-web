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

import SettingsStore from "../../../settings/SettingsStore";

const React = require('react');

module.exports = React.createClass({
    displayName: 'LoginPage',

    render: function() {
        // FIXME: this should be turned into a proper skin with a StatusLoginPage component
        if (SettingsStore.getValue("theme") === 'status') {
            return (
                <div className="mx_StatusLogin">
                    <div className="mx_StatusLogin_brand">
                        <img src="themes/status/img/logo.svg" alt="Status" width="221" height="53" />
                    </div>
                    <div className="mx_StatusLogin_content">
                        <div className="mx_StatusLogin_header">
                            <h1>Status Community Chat</h1>
                            <div className="mx_StatusLogin_subtitle">
                                A safer, decentralised communication
                                platform <a href="https://riot.im">powered by Riot</a>
                            </div>
                        </div>
                        { this.props.children }
                        <div className="mx_StatusLogin_footer">
                            <p>This channel is for our development community.</p>
                            <p>Interested in SNT and discussions on the cryptocurrency market?</p>
                            <p><a href="https://t.me/StatusNetworkChat" target="_blank" className="mx_StatusLogin_footer_cta">Join Telegram Chat</a></p>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="mx_Login">
                    { this.props.children }
                </div>
            );
        }
    },
});
