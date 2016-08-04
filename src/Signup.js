"use strict";
var MatrixClientPeg = require("./MatrixClientPeg");
var SignupStages = require("./SignupStages");
var dis = require("./dispatcher");
var q = require("q");

const EMAIL_STAGE_TYPE = "m.login.email.identity";

/**
 * A base class for common functionality between Registration and Login e.g.
 * storage of HS/IS URLs.
 */
class Signup {
    constructor(hsUrl, isUrl) {
        this._hsUrl = hsUrl;
        this._isUrl = isUrl;
    }

    getHomeserverUrl() {
        return this._hsUrl;
    }

    getIdentityServerUrl() {
        return this._isUrl;
    }

    setHomeserverUrl(hsUrl) {
        this._hsUrl = hsUrl;
    }

    setIdentityServerUrl(isUrl) {
        this._isUrl = isUrl;
    }
}

/**
 * Registration logic class
 */
class Register extends Signup {
    constructor(hsUrl, isUrl) {
        super(hsUrl, isUrl);
        this.setStep("START");
        this.data = null; // from the server
        // random other stuff (e.g. query params, NOT params from the server)
        this.params = {};
        this.credentials = null;
        this.activeStage = null;
        this.registrationPromise = null;
        // These values MUST be undefined else we'll send "username: null" which
        // will error on Synapse rather than having the key absent.
        this.username = undefined; // desired
        this.email = undefined; // desired
        this.password = undefined; // desired
    }

    setClientSecret(secret) {
        this.params.clientSecret = secret;
    }

    setSessionId(sessionId) {
        this.params.sessionId = sessionId;
    }

    setRegistrationUrl(regUrl) {
        this.params.registrationUrl = regUrl;
    }

    setIdSid(idSid) {
        this.params.idSid = idSid;
    }

    setGuestAccessToken(token) {
        this.guestAccessToken = token;
    }

    getStep() {
        return this._step;
    }

    getCredentials() {
        return this.credentials;
    }

    getServerData() {
        return this.data || {};
    }

    getPromise() {
        return this.registrationPromise;
    }

    setStep(step) {
        this._step = 'Register.' + step;
        // TODO:
        // It's a shame this is going to the global dispatcher, we only really
        // want things which have an instance of this class to be able to add
        // listeners...
        console.log("Dispatching 'registration_step_update' for step %s", this._step);
        dis.dispatch({
            action: "registration_step_update"
        });
    }

    register(formVals) {
        var {username, password, email} = formVals;
        this.email = email;
        this.username = username;
        this.password = password;

        // feels a bit wrong to be clobbering the global client for something we
        // don't even know if it'll work, but we'll leave this here for now to
        // not complicate matters further. It would be nicer to isolate this
        // logic entirely from the rest of the app though.
        MatrixClientPeg.replaceUsingUrls(
            this._hsUrl,
            this._isUrl
        );
        return this._tryRegister();
    }

    _tryRegister(authDict, poll_for_success) {
        var self = this;

        var bindEmail;

        if (this.username && this.password) {
            // only need to bind_email when sending u/p - sending it at other
            // times clobbers the u/p resulting in M_MISSING_PARAM (password)
            bindEmail = true;
        }

        return MatrixClientPeg.get().register(
            this.username, this.password, this.params.sessionId, authDict, bindEmail,
            this.guestAccessToken
        ).then(function(result) {
            self.credentials = result;
            self.setStep("COMPLETE");
            return result; // contains the credentials
        }, function(error) {
            if (error.httpStatus === 401) {
                if (error.data && error.data.flows) {
                    // Remember the session ID from the server:
                    // Either this is our first 401 in which case we need to store the
                    // session ID for future calls, or it isn't in which case this
                    // is just a no-op since it ought to be the same (or if it isn't,
                    // we should use the latest one from the server in any case).
                    self.params.sessionId = error.data.session;
                    self.data = error.data || {};
                    var flow = self.chooseFlow(error.data.flows);

                    if (flow) {
                        console.log("Active flow => %s", JSON.stringify(flow));
                        var flowStage = self.firstUncompletedStage(flow);
                        if (flowStage != self.activeStage) {
                            return self.startStage(flowStage).catch(function(err) {
                                self.setStep('START');
                                throw err;
                            });
                        }
                    }
                }
                if (poll_for_success) {
                    return q.delay(5000).then(function() {
                        return self._tryRegister(authDict, poll_for_success);
                    });
                } else {
                    throw new Error("Authorisation failed!");
                }
            } else {
                if (error.errcode === 'M_USER_IN_USE') {
                    throw new Error("Username in use");
                } else if (error.errcode == 'M_INVALID_USERNAME') {
                    throw new Error("User names may only contain alphanumeric characters, underscores or dots!");
                } else if (error.httpStatus >= 400 && error.httpStatus < 500) {
                    throw new Error(`Registration failed! (${error.httpStatus})`);
                } else if (error.httpStatus >= 500 && error.httpStatus < 600) {
                    throw new Error(
                        `Server error during registration! (${error.httpStatus})`
                    );
                } else if (error.name == "M_MISSING_PARAM") {
                    // The HS hasn't remembered the login params from
                    // the first try when the login email was sent.
                    throw new Error(
                        "This home server does not support resuming registration."
                    );
                }
            }
        });
    }

    firstUncompletedStage(flow) {
        for (var i = 0; i < flow.stages.length; ++i) {
            if (!this.hasCompletedStage(flow.stages[i])) {
                return flow.stages[i];
            }
        }
    }

    hasCompletedStage(stageType) {
        var completed = (this.data || {}).completed || [];
        return completed.indexOf(stageType) !== -1;
    }

    startStage(stageName) {
        var self = this;
        this.setStep(`STEP_${stageName}`);
        var StageClass = SignupStages[stageName];
        if (!StageClass) {
            // no idea how to handle this!
            throw new Error("Unknown stage: " + stageName);
        }

        var stage = new StageClass(MatrixClientPeg.get(), this);
        this.activeStage = stage;
        return stage.complete().then(function(request) {
            if (request.auth) {
                console.log("Stage %s is returning an auth dict", stageName);
                return self._tryRegister(request.auth, request.poll_for_success);
            }
            else {
                // never resolve the promise chain. This is for things like email auth
                // which display a "check your email" message and relies on the
                // link in the email to actually register you.
                console.log("Waiting for external action.");
                return q.defer().promise;
            }
        });
    }

    chooseFlow(flows) {
        // If the user gave us an email then we want to pick an email
        // flow we can do, else any other flow.
        var emailFlow = null;
        var otherFlow = null;
        flows.forEach(function(flow) {
            var flowHasEmail = false;
            for (var stageI = 0; stageI < flow.stages.length; ++stageI) {
                var stage = flow.stages[stageI];

                if (!SignupStages[stage]) {
                    // we can't do this flow, don't have a Stage impl.
                    return;
                }

                if (stage === EMAIL_STAGE_TYPE) {
                    flowHasEmail = true;
                }
            }

            if (flowHasEmail) {
                emailFlow = flow;
            } else {
                otherFlow = flow;
            }
        });

        if (this.email || this.hasCompletedStage(EMAIL_STAGE_TYPE)) {
            // we've been given an email or we've already done an email part
            return emailFlow;
        } else {
            return otherFlow;
        }
    }

    recheckState() {
        // feels a bit wrong to be clobbering the global client for something we
        // don't even know if it'll work, but we'll leave this here for now to
        // not complicate matters further. It would be nicer to isolate this
        // logic entirely from the rest of the app though.
        MatrixClientPeg.replaceUsingUrls(
            this._hsUrl,
            this._isUrl
        );
        // We've been given a bunch of data from a previous register step,
        // this only happens for email auth currently. It's kinda ming we need
        // to know this though. A better solution would be to ask the stages if
        // they are ready to do something rather than accepting that we know about
        // email auth and its internals.
        this.params.hasEmailInfo = (
            this.params.clientSecret && this.params.sessionId && this.params.idSid
        );

        if (this.params.hasEmailInfo) {
            this.registrationPromise = this.startStage(EMAIL_STAGE_TYPE);
        }
        return this.registrationPromise;
    }

    tellStage(stageName, data) {
        if (this.activeStage && this.activeStage.type === stageName) {
            console.log("Telling stage %s about something..", stageName);
            this.activeStage.onReceiveData(data);
        }
    }
}


class Login extends Signup {
    constructor(hsUrl, isUrl, fallbackHsUrl) {
        super(hsUrl, isUrl);
        this._fallbackHsUrl = fallbackHsUrl;
        this._currentFlowIndex = 0;
        this._flows = [];
    }

    getFlows() {
        var self = this;
        // feels a bit wrong to be clobbering the global client for something we
        // don't even know if it'll work, but we'll leave this here for now to
        // not complicate matters further. It would be nicer to isolate this
        // logic entirely from the rest of the app though.
        MatrixClientPeg.replaceUsingUrls(
            this._hsUrl,
            this._isUrl
        );
        return MatrixClientPeg.get().loginFlows().then(function(result) {
            self._flows = result.flows;
            self._currentFlowIndex = 0;
            // technically the UI should display options for all flows for the
            // user to then choose one, so return all the flows here.
            return self._flows;
        });
    }

    chooseFlow(flowIndex) {
        this._currentFlowIndex = flowIndex;
    }

    getCurrentFlowStep() {
        // technically the flow can have multiple steps, but no one does this
        // for login so we can ignore it.
        var flowStep = this._flows[this._currentFlowIndex];
        return flowStep ? flowStep.type : null;
    }

    loginViaPassword(username, pass) {
        var self = this;
        var isEmail = username.indexOf("@") > 0;
        var loginParams = {
            password: pass
        };
        if (isEmail) {
            loginParams.medium = 'email';
            loginParams.address = username;
        } else {
            loginParams.user = username;
        }

        return MatrixClientPeg.get().login('m.login.password', loginParams).then(function(data) {
            return q({
                homeserverUrl: self._hsUrl,
                identityServerUrl: self._isUrl,
                userId: data.user_id,
                accessToken: data.access_token
            });
        }, function(error) {
            if (error.httpStatus == 400 && loginParams.medium) {
                error.friendlyText = (
                    'This Home Server does not support login using email address.'
                );
            }
            else if (error.httpStatus === 403) {
                error.friendlyText = (
                    'Incorrect username and/or password.'
                );
                if (self._fallbackHsUrl) {
                    // as per elsewhere, it would be much nicer to not replace the global
                    // client just to try an alternate HS
                    MatrixClientPeg.replaceUsingUrls(
                        self._fallbackHsUrl,
                        self._isUrl
                    );
                    return MatrixClientPeg.get().login('m.login.password', loginParams).then(function(data) {
                        return q({
                            homeserverUrl: self._fallbackHsUrl,
                            identityServerUrl: self._isUrl,
                            userId: data.user_id,
                            accessToken: data.access_token
                        });
                    }, function(fallback_error) {
                        // We also have to put the default back again if it fails...
                        MatrixClientPeg.replaceUsingUrls(
                            this._hsUrl,
                            this._isUrl
                        );
                        // throw the original error
                        throw error;
                    });
                }
            }
            else {
                error.friendlyText = (
                    'There was a problem logging in. (HTTP ' + error.httpStatus + ")"
                );
            }
            throw error;
        });
    }
}

module.exports.Register = Register;
module.exports.Login = Login;
