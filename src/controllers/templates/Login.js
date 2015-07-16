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
            this.refs.serverConfig.getHsUrl(),
            this.refs.serverConfig.getIsUrl()
        );
        this.setState({
            hs_url: this.refs.serverConfig.getHsUrl(),
            is_url: this.refs.serverConfig.getIsUrl()
        });
        this.setStep("fetch_stages");
        var cli = MatrixClientPeg.get();
        this.setState({busy: true});
        var that = this;
        cli.loginFlows().then(function(result) {
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
        MatrixClientPeg.get().login('m.login.password', {
            'user': that.refs.user.getDOMNode().value,
            'password': that.refs.pass.getDOMNode().value
        }).then(function(data) {
            // XXX: we assume this means we're logged in, but there could be a next stage
            MatrixClientPeg.replace(Matrix.createClient({
                baseUrl: that.state.hs_url,
                idBaseUrl: that.state.is_url,
                userId: data.user_id,
                accessToken: data.access_token
            }));
            var localStorage = window.localStorage;
            if (localStorage) {
                try {
                    localStorage.clear();
                    localStorage.setItem("mx_hs_url", that.state.hs_url);
                    localStorage.setItem("mx_is_url", that.state.is_url);
                    localStorage.setItem("mx_user_id", data.user_id);
                    localStorage.setItem("mx_access_token", data.access_token);
                } catch (e) {
                    console.warn("Error using local storage: can't persist session!");
                }
            } else {
                console.warn("No local storage available: can't persist session!");
            }
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
