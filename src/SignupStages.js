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
        this.authDict = {
            auth: {
                type: 'm.login.recaptcha',
                // we'll add in the response param if we get one from the local user.
            },
            poll_for_success: true,
        };
    }

    // called when the recaptcha has been completed.
    onReceiveData(data) {
        if (!data || !data.response) {
            return;
        }
        this.authDict.auth.response = data.response;
    }

    complete() {
        // we return the authDict with no response, telling Signup to keep polling
        // the server in case the captcha is filled in on another window (e.g. by
        // following a nextlink from an email signup).  If the user completes the
        // captcha locally, then we return at the next poll.
        return q(this.authDict);
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

        this.clientSecret = this.signupInstance.params.clientSecret;
        if (!this.clientSecret) {
            return q.reject(new Error("No client secret specified by Signup class!"));
        }

        var nextLink = this.signupInstance.params.registrationUrl +
                       '?client_secret=' +
                       encodeURIComponent(this.clientSecret) +
                       "&hs_url=" +
                       encodeURIComponent(this.signupInstance.getHomeserverUrl()) +
                       "&is_url=" +
                       encodeURIComponent(this.signupInstance.getIdentityServerUrl()) +
                       "&session_id=" +
                       encodeURIComponent(this.signupInstance.getServerData().session);

        // Add the user ID of the referring user, if set
        if (this.signupInstance.params.referrer) {
            nextLink += "&referrer=" + encodeURIComponent(this.signupInstance.params.referrer);
        }

        var self = this;
        return this.client.requestRegisterEmailToken(
            this.signupInstance.email,
            this.clientSecret,
            1, // TODO: Multiple send attempts?
            nextLink
        ).then(function(response) {
            self.sid = response.sid;
            self.signupInstance.setIdSid(self.sid);
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
