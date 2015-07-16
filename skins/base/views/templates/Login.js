/*
Copyright 2015 OpenMarket Ltd

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

var ComponentBroker = require("../../../../src/ComponentBroker");

var ProgressBar = ComponentBroker.get("molecules/ProgressBar");
var Loader = require("react-loader");

var LoginController = require("../../../../src/controllers/templates/Login");

var ServerConfig = ComponentBroker.get("molecules/ServerConfig");

module.exports = React.createClass({
    DEFAULT_HS_URL: 'https://matrix.org',
    DEFAULT_IS_URL: 'https://matrix.org',

    displayName: 'Login',
    mixins: [LoginController],

    getInitialState: function() {
        return {
            serverConfigVisible: false
        };
    },

    componentWillMount: function() {
        this.onHSChosen();
        this.customHsUrl = this.DEFAULT_HS_URL;
        this.customIsUrl = this.DEFAULT_IS_URL;
    },

    getHsUrl: function() {
        if (this.state.serverConfigVisible) {
            return this.refs.serverConfig.getHsUrl();
        } else {
            return this.DEFAULT_HS_URL;
        }
    },

    getIsUrl: function() {
        if (this.state.serverConfigVisible) {
            return this.refs.serverConfig.getIsUrl();
        } else {
            return this.DEFAULT_IS_URL;
        }
    },

    onServerConfigVisibleChange: function(ev) {
        this.setState({
            serverConfigVisible: ev.target.checked
        });
    },

    /**
     * Gets the form field values for the current login stage
     */
    getFormVals: function() {
        return {
            'username': this.refs.user.getDOMNode().value,
            'password': this.refs.pass.getDOMNode().value
        };
    },

    onHsUrlChanged: function() {
        this.customHsUrl = this.getHsUrl();
        this.customIsUrl = this.getIsUrl();
        if (this.updateHsTimeout) {
            clearTimeout(this.updateHsTimeout);
        }
        /*var self = this;
        this.updateHsTimeout = setTimeout(function() {
            self.onHSChosen();
        }, 500);*/
    },

    componentForStep: function(step) {
        switch (step) {
            case 'choose_hs':
                var serverConfigStyle = {};
                if (!this.state.serverConfigVisible) {
                    serverConfigStyle.display = 'none';
                }
                return (
                    <div>
                        <input type="checkbox" value={this.state.serverConfigVisible} onChange={this.onServerConfigVisibleChange} />
                        Use custom server options (advanced)
                        <div style={serverConfigStyle}>
                        <ServerConfig ref="serverConfig"
                            defaultHsUrl={this.customHsUrl} defaultIsUrl={this.customIsUrl}
                            onHsUrlChanged={this.onHsUrlChanged}
                        />
                        </div>
                    </div>
                );
            // XXX: clearly these should be separate organisms
            case 'stage_m.login.password':
                return (
                    <div>
                        <form onSubmit={this.onUserPassEntered}>
                        <input ref="user" type="text" placeholder="username" /><br />
                        <input ref="pass" type="password" placeholder="password" /><br />
                        {this.componentForStep('choose_hs')}
                        <input type="submit" value="Log in" />
                        </form>
                    </div>
                );
        }
    },

    loginContent: function() {
        if (this.state.busy) {
            return (
                <Loader />
            );
        } else {
            return (
                <div>
                    <h1>Please log in:</h1>
                    {this.componentForStep(this.state.step)}
                    <div className="error">{this.state.errorText}</div>
                    <a onClick={this.showRegister} href="#">Create a new account</a>
                </div>
            );
        }
    },

    render: function() {
        return (
            <div className="mx_Login">
            {this.loginContent()}
            </div>
        );
    }
});
