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
    displayName: 'Login',
    mixins: [LoginController],

    getHsUrl: function() {
        return this.refs.serverConfig.getHsUrl();
    },

    getIsUrl: function() {
        return this.refs.serverConfig.getIsUrl();
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

    componentForStep: function(step) {
        switch (step) {
            case 'choose_hs':
                return (
                    <div>
                        <form onSubmit={this.onHSChosen}>
                        <ServerConfig ref="serverConfig" />
                        <input type="submit" value="Continue" />
                        </form>
                    </div>
                );
            // XXX: clearly these should be separate organisms
            case 'stage_m.login.password':
                return (
                    <div>
                        <form onSubmit={this.onUserPassEntered}>
                        <input ref="user" type="text" placeholder="username" /><br />
                        <input ref="pass" type="password" placeholder="password" /><br />
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
            <ProgressBar value={this.state.currentStep} max={this.state.totalSteps} />
            {this.loginContent()}
            </div>
        );
    }
});
