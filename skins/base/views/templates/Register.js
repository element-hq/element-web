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

var Loader = require("react-loader");

var RegisterController = require("../../../../src/controllers/templates/Register");

module.exports = React.createClass({
    displayName: 'Register',
    mixins: [RegisterController],

    registerContent: function() {
        if (this.state.busy) {
            return (
                <Loader />
            );
        } else {
            return (
                <div>
                    <h1>Create a new account:</h1>
                    {this.componentForStep(this.state.step)}
                    <div className="error">{this.state.errorText}</div>
                    <a onClick={this.showLogin} href="#">Sign in with existing account</a>
                </div>
            );
        }
    },

    render: function() {
        return (
            <div className="mx_Register">
            {this.registerContent()}
            </div>
        );
    }
});
