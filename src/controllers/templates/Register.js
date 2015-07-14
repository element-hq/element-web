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

    componentDidUpdate: function() {
        // Just putting a script tag into the returned jsx doesn't work, annoyingly,
        // so we do this instead.
        if (this.refs.recaptchaContainer) {
            var scriptTag = document.createElement('script');
            window.mx_on_recaptcha_loaded = this.onCaptchaLoaded;
            scriptTag.setAttribute('src', "https://www.google.com/recaptcha/api.js?onload=mx_on_recaptcha_loaded&render=explicit");
            this.refs.recaptchaContainer.getDOMNode().appendChild(scriptTag);
        }
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
t
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

        this.savedParams = {
            email: this.refs.email.getDOMNode().value,
            username: this.refs.username.getDOMNode().value,
            password: this.refs.password.getDOMNode().value
        };

        this.tryRegister();
    },

    startStage: function(stageName) {
        var self = this;
        this.setStep('stage_'+stageName);
        switch(stageName) {
            case 'm.login.email.identity':
                self.setState({
                    busy: true
                });
                var cli = MatrixClientPeg.get();
                this.savedParams.client_secret = cli.generarteClientSecret();
                this.savedParams.send_attempt = 1;
                cli.requestEmailToken(
                    this.savedParams.email,
                    this.savedParams.client_secret,
                    this.savedParams.send_attempt
                ).done(function(response) {
                    self.setState({
                        busy: false,
                    });
                    self.setStep('stage_m.login.email.identity');
                }, function(error) {
                    self.setState({
                        busy: false,
                        errorText: 'Unable to contact the given Home Server'
                    });
                });
                break;
            case 'm.login.recaptcha':
                if (!this.authParams || !this.authParams['m.login.recaptcha'].public_key) {
                    this.setState({
                        errorText: "This server has not supplied enough information for Recaptcha authentication"
                    });
                }
                break;
        }
    },

    onRegistered: function(user_id, access_token) {
        MatrixClientPeg.replace(Matrix.createClient({
            baseUrl: this.state.hs_url,
            userId: user_id,
            accessToken: access_token
        }));
        var localStorage = window.localStorage;
        if (localStorage) {
            localStorage.setItem("mx_hs_url", this.state.hs_url);
            localStorage.setItem("mx_user_id", user_id);
            localStorage.setItem("mx_access_token", access_token);
        } else {
            console.warn("No local storage available: can't persist session!");
        }
        if (this.props.onLoggedIn) {
            this.props.onLoggedIn();
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
                    <div ref="recaptchaContainer">
                        This Home Server would like to make sure you're not a robot
                        <div id="mx_recaptcha"></div>
                    </div>
                );
        }
    },

    onCaptchaLoaded: function() {
        if (this.refs.recaptchaContainer) {
            var sitekey = this.authParams['m.login.recaptcha'].public_key;
            global.grecaptcha.render('mx_recaptcha', {
                'sitekey': sitekey,
                'callback': this.onCaptchaDone
            });
        }
    },

    onCaptchaDone: function(captcha_response) {
        this.tryRegister({
            type: 'm.login.recaptcha',
            response: captcha_response
        });
    },

    tryRegister: function(auth) {
        var self = this;
        MatrixClientPeg.get().register(
            this.savedParams.username,
            this.savedParams.password,
            this.authSessionId,
            auth
        ).done(function(result) {
            self.onRegistered(result.user_id, result.access_token);
        }, function(error) {
            if (error.httpStatus == 401) {
                self.authParams = error.data.params;
                var flow = self.chooseFlow(error.data.flows);
                self.setState({
                    busy: false,
                    flows: flow,
                    currentStep: 1,
                    totalSteps: flow.stages.length+1,
                    flowStage: 0
                });
                self.startStage(flow.stages[0]);
            } else {
                self.setStep("initial");
                self.setState({
                    busy: false,
                    errorText: 'Unable to contact the given Home Server'
                });
            }
        });
    },

    showLogin: function() {
        dis.dispatch({
            action: 'start_login'
        });
    }
};
