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

var ServerConfig = ComponentBroker.get("molecules/ServerConfig");

module.exports = {
    getInitialState: function() {
        return {
            step: 'initial',
            busy: false,
            currentStep: 0,
            totalSteps: 1
        };
    },

    setStep: function(step) {
        this.setState({ step: step, errorText: '', busy: false });
    },

    getSupportedStageTypes: function() {
        return ['m.login.email.identity', 'm.login.recaptcha'];
    },

    chooseFlow: function(flows) {
        // this is fairly simple right now
        var supportedTypes = this.getSupportedStageTypes();

        var emailFlow = null;
        var otherFlow = null;
        for (var flowI = 0; flowI < flows.length; ++flowI) {
            var flow = flows[flowI];
            var flowHasEmail = false;
            var flowSupported = true;
            for (var stageI = 0; stageI < flow.stages.length; ++stageI) {
                var stage = flow.stages[stageI];

                if (supportedTypes.indexOf(stage) == -1) {
                    flowSupported = false;
                }

                if (stage == 'm.login.email.identity') {
                    flowHasEmail = true;
                }
            }
            if (flowSupported) {
                if (flowHasEmail) {
                    emailFlow = flow;
                } else {
                    otherFlow = flow;
                }
            }
        }

        if (this.savedParams.email != '') {
            return emailFlow;
        } else {
            return otherFlow;
        }
    },

    onInitialStageSubmit: function(ev) {
        ev.preventDefault();
        MatrixClientPeg.replaceUsingUrl(this.refs.serverConfig.getHsUrl());
        this.setState({hs_url: this.refs.serverConfig.getHsUrl()});
        var cli = MatrixClientPeg.get();
        this.setState({busy: true});
        var self = this;

        var email = this.refs.email.getDOMNode().value;
        var username = this.refs.username.getDOMNode().value;
        var password = this.refs.password.getDOMNode().value;

        this.savedParams = {
            email: email,
            username: username,
            password: password
        };

        cli.register(username, password).done(function(result) {
            self.onRegistered();
        }, function(error) {
            if (error.httpStatus == 401) {
                var flow = self.chooseFlow(error.data.flows);
                self.setState({
                    busy: false,
                    flows: flow,
                    currentStep: 1,
                    totalSteps: flow.stages.length+1,
                    flowStage: 0
                });
                self.setStep('stage_'+flow.stages[0]);
            } else {
                self.setStep("initial");
                self.setState({
                    busy: false,
                    errorText: 'Unable to contact the given Home Server'
                });
            }
        });
    },

    onRegistered: function(user_id, access_token) {
        MatrixClientPeg.replace(Matrix.createClient({
            baseUrl: this.state.hs_url,
            userId: data.user_id,
            accessToken: data.access_token
        }));
        var localStorage = window.localStorage;
        if (localStorage) {
            localStorage.setItem("mx_hs_url", this.state.hs_url);
            localStorage.setItem("mx_user_id", user_id);
            localStorage.setItem("mx_access_token", access_token);
        } else {
            console.warn("No local storage available: can't persist session!");
        }
        if (that.props.onLoggedIn) {
            that.props.onLoggedIn();
        }
    },

    componentForStep: function(step) {
        switch (step) {
            case 'initial':
                return (
                    <div>
                        <form onSubmit={this.onInitialStageSubmit}>
                        Email: <input ref="email" /><br />
                        Username: <input ref="username" /><br />
                        Password: <input ref="password" /><br />
                        <ServerConfig ref="serverConfig" />
                        <input type="submit" value="Continue" />
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
                    <div>
                        This is the recaptcha stage. Sucks, doesn't it.
                    </div>
                );
        }
    },

    showLogin: function() {
        dis.dispatch({
            action: 'start_login'
        });
    }
};
