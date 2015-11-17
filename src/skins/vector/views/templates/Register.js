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

var sdk = require('matrix-react-sdk')
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg')

var RegisterController = require('../../../../controllers/templates/Register')
var ServerConfig = require("../../../../components/login/ServerConfig");

var config = require('../../../../../config.json');

module.exports = React.createClass({
    displayName: 'Register',
    mixins: [RegisterController],

    getInitialState: function() {
        // TODO: factor out all localstorage stuff into its own home.
        // This is common to Login, Register and MatrixClientPeg
        var localStorage = window.localStorage;
        var hs_url, is_url;
        if (localStorage) {
            hs_url = localStorage.getItem("mx_hs_url");
            is_url = localStorage.getItem("mx_is_url");
        }

        // make sure we have our MatrixClient set up whatever
        // Useful for debugging only.
        // MatrixClientPeg.replaceUsingUrls(
        //     hs_url || config.default_hs_url,
        //     is_url || config.default_is_url
        // );

        return {
            customHsUrl: hs_url || config.default_hs_url,
            customIsUrl: is_url || config.default_is_url,
            serverConfigVisible: (hs_url && hs_url !== config.default_hs_url ||
                                  is_url && is_url !== config.default_is_url)
        }
    },

    getRegFormVals: function() {
        return {
            email: this.refs.email.value.trim(),
            username: this.refs.username.value.trim(),
            password: this.refs.password.value.trim(),
            confirmPassword: this.refs.confirmPassword.value.trim()
        };
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
        });
    },

    onServerUrlChanged: function(newUrl) {
        this.setState({
            customHsUrl: this.refs.serverConfig.getHsUrl(),
            customIsUrl: this.refs.serverConfig.getIsUrl(),
        });
        this.forceUpdate();
    },

    onProfileContinueClicked: function() {
        this.onAccountReady();
    },

    componentForStep: function(step) {
        switch (step) {
            case 'initial':
                var serverConfigStyle = {};
                serverConfigStyle.display = this.state.serverConfigVisible ? 'block' : 'none';
                return (
                    <div>
                        <form onSubmit={this.onInitialStageSubmit}>
                        <input className="mx_Login_field" type="text" ref="email" autoFocus={true} placeholder="Email address" defaultValue={this.savedParams.email} /><br />
                        <input className="mx_Login_field" type="text" ref="username" placeholder="User name" defaultValue={this.savedParams.username} /><br />
                        <input className="mx_Login_field" type="password" ref="password" placeholder="Password" defaultValue={this.savedParams.password} /><br />
                        <input className="mx_Login_field" type="password" ref="confirmPassword" placeholder="Confirm password" defaultValue={this.savedParams.confirmPassword} /><br />

                        <input className="mx_Login_checkbox" id="advanced" type="checkbox" checked={this.state.serverConfigVisible} onChange={this.onServerConfigVisibleChange} />
                        <label htmlFor="advanced">Use custom server options (advanced)</label>
                        <div style={serverConfigStyle}>
                        <ServerConfig ref="serverConfig"
                            defaultHsUrl={this.state.customHsUrl} defaultIsUrl={this.state.customIsUrl}
                            onHsUrlChanged={this.onServerUrlChanged} onIsUrlChanged={this.onServerUrlChanged} />
                        </div>
                        <br />
                        <input className="mx_Login_submit" type="submit" value="Register" />
                        </form>
                    </div>
                );
            // XXX: clearly these should be separate organisms
            case 'stage_m.login.email.identity':
                return (
                    <div>
                        Please check your email to continue registration.
                    </div>
                );
            case 'stage_m.login.recaptcha':
                return (
                    <div ref="recaptchaContainer">
                        This Home Server would like to make sure you are not a robot
                        <div id="mx_recaptcha"></div>
                    </div>
                );
        }
    },

    registerContent: function() {
        if (this.state.busy) {
            var Loader = sdk.getComponent("atoms.Spinner");            
            return (
                <Loader />
            );
        } else if (this.state.step == 'profile') {
            var ChangeDisplayName = sdk.getComponent('molecules.ChangeDisplayName');
            var ChangeAvatar = sdk.getComponent('molecules.ChangeAvatar');
            return (
                <div className="mx_Login_profile">
                    Set a display name:
                    <ChangeDisplayName />
                    Upload an avatar:
                    <ChangeAvatar initialAvatarUrl={MatrixClientPeg.get().mxcUrlToHttp(this.state.avatarUrl)} />
                    <button onClick={this.onProfileContinueClicked}>Continue</button>
                </div>
            );
        } else {
            return (
                <div>
                    <h2>Create an account</h2>
                    {this.componentForStep(this.state.step)}
                    <div className="mx_Login_error">{this.state.errorText}</div>
                    <a className="mx_Login_create" onClick={this.showLogin} href="#">I already have an account</a>
                </div>
            );
        }
    },

    onBadFields: function(bad) {
        var keys = Object.keys(bad);
        var strings = [];
        for (var i = 0; i < keys.length; ++i) {
            switch (bad[keys[i]]) {
                case this.FieldErrors.PasswordMismatch:
                    strings.push("Passwords don't match");
                    break;
                case this.FieldErrors.Missing:
                    strings.push("Missing "+keys[i]);
                    break;
                case this.FieldErrors.TooShort:
                    strings.push(keys[i]+" is too short");
                    break;
                case this.FieldErrors.InUse:
                    strings.push(keys[i]+" is already taken");
                    break;
                case this.FieldErrors.Length:
                    strings.push(keys[i] + " is not long enough.");
                    break;
                default:
                    console.error("Unhandled FieldError: %s", bad[keys[i]]);
                    break;
            }
        }
        var errtxt = strings.join(', ');
        this.setState({
            errorText: errtxt
        });
    },

    render: function() {
        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <div className="mx_Login_logo">
                        <img src="img/logo.png" width="249" height="78" alt="vector"/>
                    </div>
                    {this.registerContent()}
                </div>
            </div>
        );
    }
});
