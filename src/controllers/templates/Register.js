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
    FieldErrors: {
        PasswordMismatch: 'PasswordMismatch',
        TooShort: 'TooShort',
        Missing: 'Missing',
        InUse: 'InUse'
    },

    getInitialState: function() {
        return {
            step: 'initial',
            busy: false,
            currentStep: 0,
            totalSteps: 1
        };
    },

    componentWillMount: function() {
        this.savedParams = {
            email: '',
            username: '',
            password: '',
            confirmPassword: ''
        };
        this.readNewProps();
    },

    componentWillReceiveProps: function() {
        this.readNewProps();
    },

    readNewProps: function() {
        if (this.props.clientSecret && this.props.hsUrl &&
                this.props.isUrl && this.props.sessionId &&
                this.props.idSid) {
            this.authSessionId = this.props.sessionId;
            MatrixClientPeg.replaceUsingUrls(
                this.props.hsUrl,
                this.props.isUrl
            );
            this.setState({
                hs_url: this.props.hsUrl,
                is_url: this.props.isUrl
            });
            this.savedParams = {client_secret: this.props.clientSecret};
            this.setState({busy: true});

            var isLocation = document.createElement('a');
            isLocation.href = this.props.isUrl;

            var auth = {
                type: 'm.login.email.identity',
                threepid_creds: {
                    sid: this.props.idSid,
                    client_secret: this.savedParams.client_secret,
                    id_server: isLocation.host
                }
            };
            this.tryRegister(auth);
        }
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

        if (
            this.savedParams.email != '' ||
            this.completedStages.indexOf('m.login.email.identity') > -1
        ) {
            return emailFlow;
        } else {
            return otherFlow;
        }
    },

    firstUncompletedStageIndex: function(flow) {
        if (this.completedStages === undefined) return 0;
        for (var i = 0; i < flow.stages.length; ++i) {
            if (this.completedStages.indexOf(flow.stages[i]) == -1) {
                return i;
            }
        }
    },

    numCompletedStages: function(flow) {
        if (this.completedStages === undefined) return 0;
        var nCompleted = 0;
        for (var i = 0; i < flow.stages.length; ++i) {
            if (this.completedStages.indexOf(flow.stages[i]) > -1) {
                ++nCompleted;
            }
        }
        return nCompleted;
    },

    onInitialStageSubmit: function(ev) {
        ev.preventDefault();

        var formVals = this.getRegFormVals();
        this.savedParams = formVals;

        var badFields = {};
        if (formVals.password != formVals.confirmPassword) {
            badFields.confirmPassword = this.FieldErrors.PasswordMismatch;
        }
        if (formVals.password == '') {
            badFields.password = this.FieldErrors.Missing;
        } else if (formVals.password.length < 6) {
            badFields.password = this.FieldErrors.Length;
        }
        if (formVals.username == '') {
            badFields.username = this.FieldErrors.Missing;
        }
        if (Object.keys(badFields).length > 0) {
            this.onBadFields(badFields);
            return;
        }

        MatrixClientPeg.replaceUsingUrls(
            this.getHsUrl(),
            this.getIsUrl()
        );
        this.setState({
            hs_url: this.getHsUrl(),
            is_url: this.getIsUrl()
        });
        var cli = MatrixClientPeg.get();
        this.setState({busy: true});
        var self = this;

        this.savedParams = {
            email: formVals.email,
            username: formVals.username,
            password: formVals.password
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
                this.savedParams.client_secret = cli.generateClientSecret();
                this.savedParams.send_attempt = 1;

                var nextLink = this.props.registrationUrl +
                               '?client_secret=' +
                               encodeURIComponent(this.savedParams.client_secret) +
                               "&hs_url=" +
                               encodeURIComponent(this.state.hs_url) +
                               "&is_url=" +
                               encodeURIComponent(this.state.is_url) +
                               "&session_id=" +
                               encodeURIComponent(this.authSessionId);

                cli.requestEmailToken(
                    this.savedParams.email,
                    this.savedParams.client_secret,
                    this.savedParams.send_attempt,
                    nextLink
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
            idBaseUrl: this.state.is_url,
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
            if (error.httpStatus == 401 && error.data.flows) {
                self.authParams = error.data.params;
                self.authSessionId = error.data.session;

                self.completedStages = error.data.completed || [];

                var flow = self.chooseFlow(error.data.flows);

                var flowStage = self.firstUncompletedStageIndex(flow);
                var numDone = self.numCompletedStages(flow);

                self.setState({
                    busy: false,
                    flows: flow,
                    currentStep: 1+numDone,
                    totalSteps: flow.stages.length+1,
                    flowStage: flowStage
                });
                self.startStage(flow.stages[flowStage]);
            } else {
                self.setStep("initial");
                var newState = {
                    busy: false,
                    errorText: "Unable to contact the given Home Server"
                };
                if (error.name == 'M_USER_IN_USE') {
                    delete newState.errorText;
                    self.onBadFields({
                        username: self.FieldErrors.InUse
                    });
                } else if (error.httpStatus == 401) {
                    newState.errorText = "Authorisation failed!";
                } else if (error.httpStatus >= 400 && error.httpStatus < 500) {
                    newState.errorText = "Registration failed!";
                } else if (error.httpStatus >= 500 && error.httpStatus < 600) {
                    newState.errorText = "Server error during registration!";
                } else if (error.name == "M_MISSING_PARAM") {
                    // The HS hasn't remembered the login params from
                    // the first try when the login email was sent.
                    newState.errorText = "This home server does not support resuming registration.";
                }
                self.setState(newState);
            }
        });
    },

    showLogin: function(ev) {
        ev.preventDefault();
        dis.dispatch({
            action: 'start_login'
        });
    }
};
