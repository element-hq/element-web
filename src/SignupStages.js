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
    }

    complete() {
        var publicKey;
        if (this.signupInstance.params['m.login.recaptcha']) {
            publicKey = this.signupInstance.params['m.login.recaptcha'].public_key;
        }
        if (!publicKey) {
            return q.reject({
                message: "This server has not supplied enough information for Recaptcha " +
                "authentication",
                isFatal: true
            });
        }

        var defer = q.defer();
        global.grecaptcha.render('mx_recaptcha', {
            sitekey: publicKey,
            callback: function(response) {
                return defer.resolve({
                    auth: {
                        type: 'm.login.recaptcha',
                        response: response
                    }
                });
            }
        });

        return defer.promise;
    }
}
RecaptchaStage.TYPE = "m.login.recaptcha";


class EmailIdentityStage extends Stage {
    constructor(matrixClient, signupInstance) {
        super(EmailIdentityStage.TYPE, matrixClient, signupInstance);
    }

    complete() {
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
                       encodeURIComponent(this.signupInstance.getSessionId());

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