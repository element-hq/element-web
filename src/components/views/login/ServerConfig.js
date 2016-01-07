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
        onHsUrlChanged: React.PropTypes.func,
        onIsUrlChanged: React.PropTypes.func,
        defaultHsUrl: React.PropTypes.string,
        defaultIsUrl: React.PropTypes.string,
        withToggleButton: React.PropTypes.bool,
        delayTimeMs: React.PropTypes.number // time to wait before invoking onChanged
    },

    getDefaultProps: function() {
        return {
            onHsUrlChanged: function() {},
            onIsUrlChanged: function() {},
            withToggleButton: false,
            delayTimeMs: 0
        };
    },

    getInitialState: function() {
        return {
            hs_url: this.props.defaultHsUrl,
            is_url: this.props.defaultIsUrl,
            original_hs_url: this.props.defaultHsUrl,
            original_is_url: this.props.defaultIsUrl,
            // no toggle button = show, toggle button = hide
            configVisible: !this.props.withToggleButton
        }
    },

    onHomeserverChanged: function(ev) {
        this.setState({hs_url: ev.target.value}, function() {
            this._hsTimeoutId = this._waitThenInvoke(this._hsTimeoutId, function() {
                this.props.onHsUrlChanged(this.state.hs_url);
            });
        });
    },

    onIdentityServerChanged: function(ev) {
        this.setState({is_url: ev.target.value}, function() {
            this._isTimeoutId = this._waitThenInvoke(this._isTimeoutId, function() {
                this.props.onIsUrlChanged(this.state.is_url);
            });
        });
    },

    _waitThenInvoke: function(existingTimeoutId, fn) {
        if (existingTimeoutId) {
            clearTimeout(existingTimeoutId);
        }
        return setTimeout(fn.bind(this), this.props.delayTimeMs);
    },

    getHsUrl: function() {
        return this.state.hs_url;
    },

    getIsUrl: function() {
        return this.state.is_url;
    },

    onServerConfigVisibleChange: function(ev) {
        this.setState({
            configVisible: ev.target.checked
        });
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
                <div>
                    <input className="mx_Login_checkbox" id="advanced" type="checkbox"
                        checked={this.state.configVisible}
                        onChange={this.onServerConfigVisibleChange} />
                    <label className="mx_Login_label" htmlFor="advanced">
                        Use custom server options (advanced)
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
                        placeholder={this.state.original_hs_url}
                        value={this.state.hs_url}
                        onChange={this.onHomeserverChanged} />
                    <label className="mx_Login_label mx_ServerConfig_islabel" htmlFor="isurl">
                        Identity server URL
                    </label>
                    <input className="mx_Login_field" id="isurl" type="text"
                        placeholder={this.state.original_is_url}
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
