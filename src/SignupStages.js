"use strict";
var q = require("q");

/**
 * An interface class which login types should abide by.
 */
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


/**
 * This stage requires no auth.
 */
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


/**
 * This stage uses Google's Recaptcha to do auth.
 */
class RecaptchaStage extends Stage {
    constructor(matrixClient, signupInstance) {
        super(RecaptchaStage.TYPE, matrixClient, signupInstance);
        this.defer = q.defer(); // resolved with the captcha response
        this.publicKey = null; // from the HS
        this.divId = null; // from the UI component
    }

    // called when the UI component has loaded the recaptcha <div> so we can
    // render to it.
    onReceiveData(data) {
        if (!data || !data.divId) {
            return;
        }
        this.divId = data.divId;
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
        if (!this.divId) {
            console.error("No div ID specified!");
            return;
        }
        console.log("Rendering to %s", this.divId);
        var self = this;
        global.grecaptcha.render(this.divId, {
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


/**
 * This state uses the IS to verify email addresses.
 */
class EmailIdentityStage extends Stage {
    constructor(matrixClient, signupInstance) {
        super(EmailIdentityStage.TYPE, matrixClient, signupInstance);
    }

    _completeVerify() {
        // pull out the host of the IS URL by creating an anchor element
        var isLocation = document.createElement('a');
        isLocation.href = this.signupInstance.getIdentityServerUrl();

        var clientSecret = this.clientSecret || this.signupInstance.params.clientSecret;
        var sid = this.sid || this.signupInstance.params.idSid;

        return q({
            auth: {
                type: 'm.login.email.identity',
                threepid_creds: {
                    sid: sid,
                    client_secret: clientSecret,
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
        // TODO: The Registration class shouldn't really know this info.
        if (this.signupInstance.params.hasEmailInfo) {
            return this._completeVerify();
        }

        this.clientSecret = this.client.generateClientSecret();
        var nextLink = this.signupInstance.params.registrationUrl +
                       '?client_secret=' +
                       encodeURIComponent(this.clientSecret) +
                       "&hs_url=" +
                       encodeURIComponent(this.signupInstance.getHomeserverUrl()) +
                       "&is_url=" +
                       encodeURIComponent(this.signupInstance.getIdentityServerUrl()) +
                       "&session_id=" +
                       encodeURIComponent(this.signupInstance.getServerData().session);

        var self = this;
        return this.client.requestRegisterEmailToken(
            this.signupInstance.email,
            this.clientSecret,
            1, // TODO: Multiple send attempts?
            nextLink
        ).then(function(response) {
            self.sid = response.sid;
            return self._completeVerify();
        }).then(function(request) {
            request.poll_for_success = true;
            return request;
        }, function(error) {
            console.error(error);
            var e = {
                isFatal: true
            };
            if (error.errcode == 'M_THREEPID_IN_USE') {
                e.message = "This email address is already registered";
            } else {
                e.message = 'Unable to contact the given identity server';
            }
            throw e;
        });
    }
}
EmailIdentityStage.TYPE = "m.login.email.identity";

module.exports = {
    [DummyStage.TYPE]: DummyStage,
    [RecaptchaStage.TYPE]: RecaptchaStage,
    [EmailIdentityStage.TYPE]: EmailIdentityStage
};
