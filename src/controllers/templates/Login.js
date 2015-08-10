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

var MatrixClientPeg = require("../../MatrixClientPeg");
var Matrix = require("matrix-js-sdk");
var dis = require("../../dispatcher");

var ComponentBroker = require("../../ComponentBroker");

module.exports = {
    getInitialState: function() {
        return {
            step: 'choose_hs',
            busy: false,
            currentStep: 0,
            totalSteps: 1
        };
    },

    setStep: function(step) {
        this.setState({ step: step, errorText: '', busy: false });
    },

    onHSChosen: function() {
        MatrixClientPeg.replaceUsingUrls(
            this.getHsUrl(),
            this.getIsUrl()
        );
        this.setState({
            hs_url: this.getHsUrl(),
            is_url: this.getIsUrl()
        });
        this.setStep("fetch_stages");
        var cli = MatrixClientPeg.get();
        this.setState({busy: true});
        var self = this;
        cli.loginFlows().done(function(result) {
            self.setState({
                flows: result.flows,
                currentStep: 1,
                totalSteps: result.flows.length+1
            });
            self.setStep('stage_'+result.flows[0].type);
        }, function(error) {
            self.setStep("choose_hs");
            self.setState({errorText: 'Unable to contact the given Home Server'});
        });
    },

    onUserPassEntered: function(ev) {
        ev.preventDefault();
        this.setState({busy: true});
        var self = this;

        var formVals = this.getFormVals();

        var loginParams = {
            password: formVals.password
        };
        if (formVals.username.indexOf('@') > 0) {
            loginParams.medium = 'email';
            loginParams.address = formVals.username;
        } else {
            loginParams.user = formVals.username;
        }

        MatrixClientPeg.get().login('m.login.password', loginParams).done(function(data) {
            MatrixClientPeg.replaceUsingAccessToken(
                self.state.hs_url, self.state.is_url,
                data.user_id, data.access_token
            );
            if (self.props.onLoggedIn) {
                self.props.onLoggedIn();
            }
        }, function(error) {
            self.setStep("stage_m.login.password");
            if (error.httpStatus == 400 && loginParams.medium) {
                self.setState({errorText: 'This Home Server does not support login using email address.'});
            } else {
                self.setState({errorText: 'Login failed.'});
            }
        });
    },

    showRegister: function(ev) {
        ev.preventDefault();
        dis.dispatch({
            action: 'start_registration'
        });
    }
};
