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

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'CasLogin',

    getInitialState: function() {
        var splitLocation = window.location.href.split('/');
        return {serviceUrl: splitLocation[0] + "//" + splitLocation[2]};
    },

    onCasClicked: function(ev) {
        var serviceRedirectUrl = this.state.serviceUrl + "/#/login/cas";
        var self = this;
        MatrixClientPeg.get().getCasServer().done(function(data) {
            var serverUrl = data.serverUrl + "/login?service=" + encodeURIComponent(serviceRedirectUrl);
            window.location.href=serverUrl
        }, function(error) {
            self.setStep("stage_m.login.cas");
            self.setState({errorText: 'Login failed.'});
        });
    },

    render: function() {
        return (
            <div>
                <button onClick={this.onCasClicked}>Sign in with CAS</button>
            </div>
        );
    }
});