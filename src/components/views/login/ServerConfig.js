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

var React = require('react');
var Modal = require('../../../Modal');
var sdk = require('../../../index');

/**
 * A pure UI component which displays the HS and IS to use.
 */
module.exports = React.createClass({
    displayName: 'ServerConfig',

    propTypes: {
        onServerConfigChange: React.PropTypes.func,

        // default URLs are defined in config.json (or the hardcoded defaults)
        // they are used if the user has not overridden them with a custom URL.
        // In other words, if the custom URL is blank, the default is used.
        defaultHsUrl: React.PropTypes.string, // e.g. https://matrix.org
        defaultIsUrl: React.PropTypes.string, // e.g. https://vector.im

        // custom URLs are explicitly provided by the user and override the
        // default URLs.  The user enters them via the component's input fields,
        // which is reflected on these properties whenever on..UrlChanged fires.
        // They are persisted in localStorage by MatrixClientPeg, and so can
        // override the default URLs when the component initially loads.
        customHsUrl: React.PropTypes.string,
        customIsUrl: React.PropTypes.string,

        withToggleButton: React.PropTypes.bool,
        delayTimeMs: React.PropTypes.number // time to wait before invoking onChanged
    },

    getDefaultProps: function() {
        return {
            onServerConfigChange: function() {},
            customHsUrl: "",
            customIsUrl: "",
            withToggleButton: false,
            delayTimeMs: 0
        };
    },

    getInitialState: function() {
        return {
            hs_url: this.props.customHsUrl,
            is_url: this.props.customIsUrl,
            // if withToggleButton is false, then show the config all the time given we have no way otherwise of making it visible
            configVisible: !this.props.withToggleButton ||
                           (this.props.customHsUrl !== this.props.defaultHsUrl) ||
                           (this.props.customIsUrl !== this.props.defaultIsUrl)
        };
    },

    onHomeserverChanged: function(ev) {
        this.setState({hs_url: ev.target.value}, function() {
            this._hsTimeoutId = this._waitThenInvoke(this._hsTimeoutId, function() {
                var hsUrl = this.state.hs_url.trim().replace(/\/$/, "");
                if (hsUrl === "") hsUrl = this.props.defaultHsUrl;
                this.props.onServerConfigChange({
                    hsUrl : this.state.hs_url,
                    isUrl : this.state.is_url,
                });
            });
        });
    },

    onIdentityServerChanged: function(ev) {
        this.setState({is_url: ev.target.value}, function() {
            this._isTimeoutId = this._waitThenInvoke(this._isTimeoutId, function() {
                var isUrl = this.state.is_url.trim().replace(/\/$/, "");
                if (isUrl === "") isUrl = this.props.defaultIsUrl;
                this.props.onServerConfigChange({
                    hsUrl : this.state.hs_url,
                    isUrl : this.state.is_url,
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

    onServerConfigVisibleChange: function(visible, ev) {
        this.setState({
            configVisible: visible
        });
        if (!visible) {
            this.props.onServerConfigChange({
                hsUrl : this.props.defaultHsUrl,
                isUrl : this.props.defaultIsUrl,
            });
        }
        else {
            this.props.onServerConfigChange({
                hsUrl : this.state.hs_url,
                isUrl : this.state.is_url,
            });
        }
    },

    showHelpPopup: function() {
        var CustomServerDialog = sdk.getComponent('login.CustomServerDialog');
        Modal.createDialog(CustomServerDialog);
    },

    render: function() {
        var serverConfigStyle = {};
        serverConfigStyle.display = this.state.configVisible ? 'block' : 'none';

        var toggleButton;
        if (this.props.withToggleButton) {
            toggleButton = (
                <div style={{ textAlign: 'center' }}>
                    <input className="mx_Login_radio" id="basic" name="configVisible" type="radio"
                        checked={!this.state.configVisible}
                        onChange={this.onServerConfigVisibleChange.bind(this, false)} />
                    <label className="mx_Login_label" htmlFor="basic">
                        Default server
                    </label>
                    &nbsp;&nbsp;
                    <input className="mx_Login_radio" id="advanced" name="configVisible" type="radio"
                        checked={this.state.configVisible}
                        onChange={this.onServerConfigVisibleChange.bind(this, true)} />
                    <label className="mx_Login_label" htmlFor="advanced">
                        Custom server
                    </label>
                </div>
            );
        }

        return (
        <div>
            {toggleButton}
            <div style={serverConfigStyle}>
                <div className="mx_ServerConfig">
                    <label className="mx_Login_label mx_ServerConfig_hslabel" htmlFor="hsurl">
                        Home server URL
                    </label>
                    <input className="mx_Login_field" id="hsurl" type="text"
                        placeholder={this.props.defaultHsUrl}
                        disabled={!this.props.withToggleButton}
                        value={this.state.hs_url}
                        onChange={this.onHomeserverChanged} />
                    <label className="mx_Login_label mx_ServerConfig_islabel" htmlFor="isurl">
                        Identity server URL
                    </label>
                    <input className="mx_Login_field" id="isurl" type="text"
                        placeholder={this.props.defaultIsUrl}
                        disabled={!this.props.withToggleButton}
                        value={this.state.is_url}
                        onChange={this.onIdentityServerChanged} />
                    <a className="mx_ServerConfig_help" href="#" onClick={this.showHelpPopup}>
                        What does this mean?
                    </a>
                </div>
            </div>
        </div>
        );
    }
});
