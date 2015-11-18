"use strict";
var MatrixClientPeg = require("./MatrixClientPeg");
var SignupStages = require("./SignupStages");
var dis = require("./dispatcher");
var q = require("q");

const EMAIL_STAGE_TYPE = "m.login.email.identity";

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


class Register extends Signup {
    constructor(hsUrl, isUrl) {
        super(hsUrl, isUrl);
        this.setStep("START");
        this.data = null; // from the server
        this.username = null; // desired
        this.email = null; // desired
        this.password = null; // desired
        this.params = {}; // random other stuff (e.g. query params)
        this.credentials = null;
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

    getStep() {
        return this._step;
    }

    getCredentials() {
        return this.credentials;
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

    _tryRegister(authDict) {
        console.log("_tryRegister %s", JSON.stringify(authDict));
        var self = this;
        return MatrixClientPeg.get().register(
            this.username, this.password, this._sessionId, authDict
        ).then(function(result) {
            console.log("Got a final response");
            self.credentials = result;
            self.setStep("COMPLETE");
            return result; // contains the credentials
        }, function(error) {
            console.error(error);
            if (error.httpStatus === 401 && error.data && error.data.flows) {
                self.data = error.data || {};
                var flow = self.chooseFlow(error.data.flows);

                if (flow) {
                    var flowStage = self.firstUncompletedStageIndex(flow);
                    return self.startStage(flow.stages[flowStage]);
                }
                else {
                    throw new Error("Unable to register - missing email address?");
                }
            } else {
                if (error.errcode === 'M_USER_IN_USE') {
                    throw new Error("Username in use");
                } else if (error.httpStatus == 401) {
                    throw new Error("Authorisation failed!");
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

    firstUncompletedStageIndex(flow) {
        if (!this.completedStages) {
            return 0;
        }
        for (var i = 0; i < flow.stages.length; ++i) {
            if (this.completedStages.indexOf(flow.stages[i]) == -1) {
                return i;
            }
        }
    }

    numCompletedStages(flow) {
        if (!this.completedStages) {
            return 0;
        }
        var nCompleted = 0;
        for (var i = 0; i < flow.stages.length; ++i) {
            if (this.completedStages.indexOf(flow.stages[i]) > -1) {
                ++nCompleted;
            }
        }
        return nCompleted;
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
        return stage.complete().then(function(request) {
            if (request.auth) {
                return self._tryRegister(request.auth);
            }  
        });
    }

    hasCompletedStage(stageType) {
        var completed = (this.data || {}).completed || [];
        return completed.indexOf(stageType) !== -1;
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
}


class Login extends Signup {
    constructor(hsUrl, isUrl) {
        super(hsUrl, isUrl);
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
