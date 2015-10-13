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

var MatrixClientPeg = require("../../MatrixClientPeg");
var Cas = require("../../CasLogic");

module.exports = {

    onCasClicked: function(ev) {
        var serviceRedirectUrl = Cas.getServiceUrl() + "#/login/cas";
        var self = this;
        MatrixClientPeg.get().getCasServer().done(function(data) {
            var serverUrl = data.serverUrl + "/login?service=" + encodeURIComponent(serviceRedirectUrl);
            window.location.href = serverUrl;
        }, function(error) {
            self.setStep("stage_m.login.cas");
            self.setState({errorText: 'Login failed.'});
        });
    },

};
