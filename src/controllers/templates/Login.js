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

    onHSChosen: function(ev) {
        ev.preventDefault();
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
        var that = this;
        cli.loginFlows().done(function(result) {
            that.setState({
                flows: result.flows,
                currentStep: 1,
                totalSteps: result.flows.length+1
            });
            that.setStep('stage_'+result.flows[0].type);
        }, function(error) {
            that.setStep("choose_hs");
            that.setState({errorText: 'Unable to contact the given Home Server'});
        });
    },

    onUserPassEntered: function(ev) {
        ev.preventDefault();
        this.setState({busy: true});
        var that = this;

        var formVals = this.getFormVals();

        MatrixClientPeg.get().login('m.login.password', {
            'user': formVals.username,
            'password': formVals.password
        }).done(function(data) {
            MatrixClientPeg.replaceUsingAccessToken(
                this.state.hs_url, this.state.is_url,
                data.user_id, data.access_token
            );
            }));
            if (that.props.onLoggedIn) {
                that.props.onLoggedIn();
            }
        }, function(error) {
            that.setStep("stage_m.login.password");
            that.setState({errorText: 'Login failed.'});
        });
    },

    showRegister: function(ev) {
        ev.preventDefault();
        dis.dispatch({
            action: 'start_registration'
        });
    }
};
