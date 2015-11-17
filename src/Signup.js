"use strict";
var MatrixClientPeg = require("./MatrixClientPeg");
var dis = require("./dispatcher");
var q = require("q");

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
        this._state = "Register.START";
    }

    getState() {
        return this._state;
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
