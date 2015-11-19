"use strict";
var q = require("q");

class Stage {
    constructor(type, matrixClient, signupInstance) {
        this.type = type;
        this.client = matrixClient;
        this.signupInstance = signupInstance;
    }

    complete() {
        // Return a promise which is:
        // RESOLVED => With an Object which has an 'auth' key which is the auth dict
        //             to submit.
        // REJECTED => With an Error if there was a problem with this stage.
        //             Has a "message" string and an "isFatal" flag.
        return q.reject("NOT IMPLEMENTED");
    }

    onReceiveData() {
        // NOP
    }
}
Stage.TYPE = "NOT IMPLEMENTED";


class DummyStage extends Stage {
    constructor(matrixClient, signupInstance) {
        super(DummyStage.TYPE, matrixClient, signupInstance);
    }

    complete() {
        return q({
            auth: {
                type: DummyStage.TYPE
            }
        });
    }
}
DummyStage.TYPE = "m.login.dummy";


class RecaptchaStage extends Stage {
    constructor(matrixClient, signupInstance) {
        super(RecaptchaStage.TYPE, matrixClient, signupInstance);
        this.defer = q.defer();
        this.publicKey = null;
    }

    onReceiveData(data) {
        if (data !== "loaded") {
            return;
        }
        this._attemptRender();
    }

    complete() {
        var publicKey;
        var serverParams = this.signupInstance.getServerData().params;
        if (serverParams && serverParams["m.login.recaptcha"]) {
            publicKey = serverParams["m.login.recaptcha"].public_key;
        }
        if (!publicKey) {
            return q.reject({
                message: "This server has not supplied enough information for Recaptcha " +
                "authentication",
                isFatal: true
            });
        }
        this.publicKey = publicKey;
        this._attemptRender();
        return this.defer.promise;
    }

    _attemptRender() {
        if (!global.grecaptcha) {
            console.error("grecaptcha not loaded!");
            return;
        }
        if (!this.publicKey) {
            console.error("No public key for recaptcha!");
            return;
        }
        var self = this;
        // FIXME: Tight coupling here and in CaptchaForm.js
        global.grecaptcha.render('mx_recaptcha', {
            sitekey: this.publicKey,
            callback: function(response) {
                console.log("Received captcha response");
                self.defer.resolve({
                    auth: {
                        type: 'm.login.recaptcha',
                        response: response
                    }
                });
            }
        });
    }
}
RecaptchaStage.TYPE = "m.login.recaptcha";


class EmailIdentityStage extends Stage {
    constructor(matrixClient, signupInstance) {
        super(EmailIdentityStage.TYPE, matrixClient, signupInstance);
    }

    _completeVerify() {
        console.log("_completeVerify");
        var isLocation = document.createElement('a');
        isLocation.href = this.signupInstance.getIdentityServerUrl();

        return q({
            auth: {
                type: 'm.login.email.identity',
                threepid_creds: {
                    sid: this.signupInstance.params.idSid,
                    client_secret: this.signupInstance.params.clientSecret,
                    id_server: isLocation.host
                }
            }
        });
    }

    /**
     * Complete the email stage.
     *
     * This is called twice under different circumstances:
     *   1) When requesting an email token from the IS
     *   2) When validating query parameters received from the link in the email
     */
    complete() {
        console.log("Email complete()");
        if (this.signupInstance.params.hasEmailInfo) {
            return this._completeVerify();
        }

        var config = {
            clientSecret: this.client.generateClientSecret(),
            sendAttempt: 1
        };
        this.signupInstance.params[EmailIdentityStage.TYPE] = config;

        var nextLink = this.signupInstance.params.registrationUrl +
                       '?client_secret=' +
                       encodeURIComponent(config.clientSecret) +
                       "&hs_url=" +
                       encodeURIComponent(this.signupInstance.getHomeserverUrl()) +
                       "&is_url=" +
                       encodeURIComponent(this.signupInstance.getIdentityServerUrl()) +
                       "&session_id=" +
                       encodeURIComponent(this.signupInstance.getServerData().session);

        return this.client.requestEmailToken(
            this.signupInstance.email,
            config.clientSecret,
            config.sendAttempt,
            nextLink
        ).then(function(response) {
            return {}; // don't want to make a request
        }, function(error) {
            console.error(error);
            var e = {
                isFatal: true
            };
            if (error.errcode == 'THREEPID_IN_USE') {
                e.message = "Email in use";
            } else {
                e.message = 'Unable to contact the given identity server';
            }
            return e;
        });
    }
}
EmailIdentityStage.TYPE = "m.login.email.identity";

module.exports = {
    [DummyStage.TYPE]: DummyStage,
    [RecaptchaStage.TYPE]: RecaptchaStage,
    [EmailIdentityStage.TYPE]: EmailIdentityStage
};