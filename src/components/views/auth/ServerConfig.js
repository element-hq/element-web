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

const React = require('react');
import PropTypes from 'prop-types';
const Modal = require('../../../Modal');
const sdk = require('../../../index');
import { _t } from '../../../languageHandler';

/**
 * A pure UI component which displays the HS and IS to use.
 */
module.exports = React.createClass({
    displayName: 'ServerConfig',

    propTypes: {
        onServerConfigChange: PropTypes.func,

        // default URLs are defined in config.json (or the hardcoded defaults)
        // they are used if the user has not overridden them with a custom URL.
        // In other words, if the custom URL is blank, the default is used.
        defaultHsUrl: PropTypes.string, // e.g. https://matrix.org
        defaultIsUrl: PropTypes.string, // e.g. https://vector.im

        // custom URLs are explicitly provided by the user and override the
        // default URLs.  The user enters them via the component's input fields,
        // which is reflected on these properties whenever on..UrlChanged fires.
        // They are persisted in localStorage by MatrixClientPeg, and so can
        // override the default URLs when the component initially loads.
        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,

        delayTimeMs: PropTypes.number, // time to wait before invoking onChanged
    },

    getDefaultProps: function() {
        return {
            onServerConfigChange: function() {},
            customHsUrl: "",
            customIsUrl: "",
            delayTimeMs: 0,
        };
    },

    getInitialState: function() {
        return {
            hsUrl: this.props.customHsUrl,
            isUrl: this.props.customIsUrl,
        };
    },

    componentWillReceiveProps: function(newProps) {
        if (newProps.customHsUrl === this.state.hsUrl &&
            newProps.customIsUrl === this.state.isUrl) return;

        this.setState({
            hsUrl: newProps.customHsUrl,
            isUrl: newProps.customIsUrl,
        });
        this.props.onServerConfigChange({
            hsUrl: newProps.customHsUrl,
            isUrl: newProps.customIsUrl,
        });
    },

    onHomeserverChanged: function(ev) {
        this.setState({hsUrl: ev.target.value}, () => {
            this._hsTimeoutId = this._waitThenInvoke(this._hsTimeoutId, () => {
                let hsUrl = this.state.hsUrl.trim().replace(/\/$/, "");
                if (hsUrl === "") hsUrl = this.props.defaultHsUrl;
                this.props.onServerConfigChange({
                    hsUrl: this.state.hsUrl,
                    isUrl: this.state.isUrl,
                });
            });
        });
    },

    onIdentityServerChanged: function(ev) {
        this.setState({isUrl: ev.target.value}, () => {
            this._isTimeoutId = this._waitThenInvoke(this._isTimeoutId, () => {
                let isUrl = this.state.isUrl.trim().replace(/\/$/, "");
                if (isUrl === "") isUrl = this.props.defaultIsUrl;
                this.props.onServerConfigChange({
                    hsUrl: this.state.hsUrl,
                    isUrl: this.state.isUrl,
                });
            });
        });
    },

    _waitThenInvoke: function(existingTimeoutId, fn) {
        if (existingTimeoutId) {
            clearTimeout(existingTimeoutId);
        }
        return setTimeout(fn.bind(this), this.props.delayTimeMs);
    },

    showHelpPopup: function() {
        const CustomServerDialog = sdk.getComponent('auth.CustomServerDialog');
        Modal.createTrackedDialog('Custom Server Dialog', '', CustomServerDialog);
    },

    render: function() {
        const Field = sdk.getComponent('elements.Field');

        return (
            <div className="mx_ServerConfig">
                <h3>{_t("Other servers")}</h3>
                {_t("Enter custom server URLs <a>What does this mean?</a>", {}, {
                    a: sub => <a className="mx_ServerConfig_help" href="#" onClick={this.showHelpPopup}>
                        { sub }
                    </a>,
                })}
                <div className="mx_ServerConfig_fields">
                    <Field id="mx_ServerConfig_hsUrl"
                        label={_t("Homeserver URL")}
                        placeholder={this.props.defaultHsUrl}
                        value={this.state.hsUrl}
                        onChange={this.onHomeserverChanged}
                    />
                    <Field id="mx_ServerConfig_isUrl"
                        label={_t("Identity Server URL")}
                        placeholder={this.props.defaultIsUrl}
                        value={this.state.isUrl}
                        onChange={this.onIdentityServerChanged}
                    />
                </div>
            </div>
        );
    },
});
