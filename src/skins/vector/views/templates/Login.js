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
var ReactDOM = require('react-dom');

var sdk = require('matrix-react-sdk')
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

var LoginController = require('matrix-react-sdk/lib/controllers/templates/Login')

var config = require('../../../../../config.json');

module.exports = React.createClass({
    displayName: 'Login',
    mixins: [LoginController],

    getInitialState: function() {
        // TODO: factor out all localstorage stuff into its own home.
        // This is common to Login, Register and MatrixClientPeg
        var localStorage = window.localStorage;
        var hs_url, is_url;
        if (localStorage) {
            hs_url = localStorage.getItem("mx_hs_url");
            is_url = localStorage.getItem("mx_is_url");
        }

        return {
            customHsUrl: hs_url || config.default_hs_url,
            customIsUrl: is_url || config.default_is_url,
            serverConfigVisible: (hs_url && hs_url !== config.default_hs_url ||
                                  is_url && is_url !== config.default_is_url)
        };
    },

    componentDidMount: function() {
        this.onHSChosen();
    },

    componentDidUpdate: function() {
        if (!this.state.focusFired && this.refs.user) {
            this.refs.user.focus();
            this.setState({ focusFired: true });
        }
    },

    getHsUrl: function() {
        if (this.state.serverConfigVisible) {
            return this.state.customHsUrl;
        } else {
            return config.default_hs_url;
        }
    },

    getIsUrl: function() {
        if (this.state.serverConfigVisible) {
            return this.state.customIsUrl;
        } else {
            return config.default_is_url;
        }
    },

    onServerConfigVisibleChange: function(ev) {
        this.setState({
            serverConfigVisible: ev.target.checked
        }, this.onHSChosen);
    },

    /**
     * Gets the form field values for the current login stage
     */
    getFormVals: function() {
        return {
            'username': this.refs.user.value.trim(),
            'password': this.refs.pass.value.trim()
        };
    },

    onHsUrlChanged: function() {
        var newHsUrl = this.refs.serverConfig.getHsUrl().trim();
        var newIsUrl = this.refs.serverConfig.getIsUrl().trim();

        if (newHsUrl == this.state.customHsUrl &&
            newIsUrl == this.state.customIsUrl)
        {
            return;
        }
        else {
            this.setState({
                customHsUrl: newHsUrl,
                customIsUrl: newIsUrl,
            });
        }

        // XXX: why are we replacing the MatrixClientPeg here when we're about
        // to do it again 1s later in the setTimeout to onHSChosen? -- matthew
        // Commenting it out for now to see what breaks.
        /*
        MatrixClientPeg.replaceUsingUrls(
            this.getHsUrl(),
            this.getIsUrl()
        );
        this.setState({
            hs_url: this.getHsUrl(),
            is_url: this.getIsUrl()
        });
        */

        // XXX: HSes do not have to offer password auth, so we
        // need to update and maybe show a different component
        // when a new HS is entered.
        if (this.updateHsTimeout) {
            clearTimeout(this.updateHsTimeout);
        }
        var self = this;
        this.updateHsTimeout = setTimeout(function() {
            self.onHSChosen();
        }, 1000);
    },

    componentForStep: function(step) {
        switch (step) {
            case 'choose_hs':
            case 'fetch_stages':
                var serverConfigStyle = {};
                serverConfigStyle.display = this.state.serverConfigVisible ? 'block' : 'none';
                var ServerConfig = sdk.getComponent("molecules.ServerConfig");

                return (
                    <div>
                        <input className="mx_Login_checkbox" id="advanced" type="checkbox" checked={this.state.serverConfigVisible} onChange={this.onServerConfigVisibleChange} />
                        <label className="mx_Login_label" htmlFor="advanced">Use custom server options (advanced)</label>
                        <div style={serverConfigStyle}>
                            <ServerConfig ref="serverConfig"
                                defaultHsUrl={this.state.customHsUrl} defaultIsUrl={this.state.customIsUrl}
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
                        <input className="mx_Login_field" ref="user" type="text" value={this.state.username} onChange={this.onUsernameChanged} placeholder="Email or user name" /><br />
                        <input className="mx_Login_field" ref="pass" type="password" value={this.state.password} onChange={this.onPasswordChanged} placeholder="Password" /><br />
                        { this.componentForStep('choose_hs') }
                        <input className="mx_Login_submit" type="submit" value="Log in" />
                        </form>
                    </div>
                );
            case 'stage_m.login.cas':
                var CasLogin = sdk.getComponent('organisms.CasLogin');
                return (
                    <CasLogin />
                );
        }
    },

    onUsernameChanged: function(ev) {
        this.setState({username: ev.target.value});
    },

    onPasswordChanged: function(ev) {
        this.setState({password: ev.target.value});
    },

    loginContent: function() {
        var Loader = sdk.getComponent("atoms.Spinner");
        var loader = this.state.busy ? <div className="mx_Login_loader"><Loader /></div> : null;
        return (
            <div>
                <h2>Sign in</h2>
                {this.componentForStep(this.state.step)}
                <div className="mx_Login_error">
                        { loader }
                        {this.state.errorText}
                </div>
                <a className="mx_Login_create" onClick={this.showRegister} href="#">Create a new account</a>
                <br/>
                <div className="mx_Login_links">
                    <a href="https://medium.com/@Vector">blog</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                    <a href="https://twitter.com/@VectorCo">twitter</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                    <a href="https://github.com/vector-im/vector-web">github</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                    <a href="https://matrix.org">powered by Matrix</a>
                </div>
            </div>
        );
    },

    render: function() {
        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <div className="mx_Login_logo">
                        <img  src="img/logo.png" width="249" height="78" alt="vector"/>
                    </div>
                    {this.loginContent()}
                </div>
            </div>
        );
    }
});
