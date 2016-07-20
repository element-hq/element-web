/*
Copyright 2015, 2016 OpenMarket Ltd

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

var Matrix = require("matrix-js-sdk");

/**
 * Allows a user to reset their password on a homeserver.
 *
 * This involves getting an email token from the identity server to "prove" that
 * the client owns the given email address, which is then passed to the password
 * API on the homeserver in question with the new password.
 */
class PasswordReset {

    /**
     * Configure the endpoints for password resetting.
     * @param {string} homeserverUrl The URL to the HS which has the account to reset.
     * @param {string} identityUrl The URL to the IS which has linked the email -> mxid mapping.
     */
    constructor(homeserverUrl, identityUrl) {
        this.client = Matrix.createClient({
            baseUrl: homeserverUrl,
            idBaseUrl: identityUrl
        });
        this.clientSecret = this.client.generateClientSecret();
        this.identityServerDomain = identityUrl.split("://")[1];
    }

    /**
     * Attempt to reset the user's password. This will trigger a side-effect of
     * sending an email to the provided email address.
     * @param {string} emailAddress The email address
     * @param {string} newPassword The new password for the account.
     * @return {Promise} Resolves when the email has been sent. Then call checkEmailLinkClicked().
     */
    resetPassword(emailAddress, newPassword) {
        this.password = newPassword;
        return this.client.requestPasswordEmailToken(emailAddress, this.clientSecret, 1).then((res) => {
            this.sessionId = res.sid;
            return res;
        }, function(err) {
            if (err.errcode == 'M_THREEPID_NOT_FOUND') {
                 err.message = "This email address was not found";
            } else if (err.httpStatus) {
                err.message = err.message + ` (Status ${err.httpStatus})`;
            }
            throw err;
        });
    }

    /**
     * Checks if the email link has been clicked by attempting to change the password
     * for the mxid linked to the email.
     * @return {Promise} Resolves if the password was reset. Rejects with an object
     * with a "message" property which contains a human-readable message detailing why
     * the reset failed, e.g. "There is no mapped matrix user ID for the given email address".
     */
    checkEmailLinkClicked() {
        return this.client.setPassword({
            type: "m.login.email.identity",
            threepid_creds: {
                sid: this.sessionId,
                client_secret: this.clientSecret,
                id_server: this.identityServerDomain
            }
        }, this.password).catch(function(err) {
            if (err.httpStatus === 401) {
                err.message = "Failed to verify email address: make sure you clicked the link in the email";
            }
            else if (err.httpStatus === 404) {
                err.message = "Your email address does not appear to be associated with a Matrix ID on this Homeserver.";
            }
            else if (err.httpStatus) {
                err.message += ` (Status ${err.httpStatus})`;
            }
            throw err;
        });
    }
}

module.exports = PasswordReset;
