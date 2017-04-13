/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

var MatrixClientPeg = require("./MatrixClientPeg");

/**
 * Allows a user to add a third party identifier to their Home Server and,
 * optionally, the identity servers.
 *
 * This involves getting an email token from the identity server to "prove" that
 * the client owns the given email address, which is then passed to the
 * add threepid API on the homeserver.
 */
class AddThreepid {
    constructor() {
        this.clientSecret = MatrixClientPeg.get().generateClientSecret();
    }

    /**
     * Attempt to add an email threepid. This will trigger a side-effect of
     * sending an email to the provided email address.
     * @param {string} emailAddress The email address to add
     * @param {boolean} bind If True, bind this email to this mxid on the Identity Server
     * @return {Promise} Resolves when the email has been sent. Then call checkEmailLinkClicked().
     */
    addEmailAddress(emailAddress, bind) {
        this.bind = bind;
        return MatrixClientPeg.get().requestAdd3pidEmailToken(emailAddress, this.clientSecret, 1).then((res) => {
            this.sessionId = res.sid;
            return res;
        }, function(err) {
            if (err.errcode == 'M_THREEPID_IN_USE') {
                err.message = "This email address is already in use";
            } else if (err.httpStatus) {
                err.message = err.message + ` (Status ${err.httpStatus})`;
            }
            throw err;
        });
    }

    /**
     * Attempt to add a msisdn threepid. This will trigger a side-effect of
     * sending a test message to the provided phone number.
     * @param {string} phoneCountry The ISO 2 letter code of the country to resolve phoneNumber in
     * @param {string} phoneNumber The national or international formatted phone number to add
     * @param {boolean} bind If True, bind this phone number to this mxid on the Identity Server
     * @return {Promise} Resolves when the text message has been sent. Then call haveMsisdnToken().
     */
    addMsisdn(phoneCountry, phoneNumber, bind) {
        this.bind = bind;
        return MatrixClientPeg.get().requestAdd3pidMsisdnToken(
            phoneCountry, phoneNumber, this.clientSecret, 1,
        ).then((res) => {
            this.sessionId = res.sid;
            return res;
        }, function(err) {
            if (err.errcode == 'M_THREEPID_IN_USE') {
                err.message = "This phone number is already in use";
            } else if (err.httpStatus) {
                err.message = err.message + ` (Status ${err.httpStatus})`;
            }
            throw err;
        });
    }

    /**
     * Checks if the email link has been clicked by attempting to add the threepid
     * @return {Promise} Resolves if the email address was added. Rejects with an object
     * with a "message" property which contains a human-readable message detailing why
     * the request failed.
     */
    checkEmailLinkClicked() {
        var identityServerDomain = MatrixClientPeg.get().idBaseUrl.split("://")[1];
        return MatrixClientPeg.get().addThreePid({
            sid: this.sessionId,
            client_secret: this.clientSecret,
            id_server: identityServerDomain
        }, this.bind).catch(function(err) {
            if (err.httpStatus === 401) {
                err.message = "Failed to verify email address: make sure you clicked the link in the email";
            }
            else if (err.httpStatus) {
                err.message += ` (Status ${err.httpStatus})`;
            }
            throw err;
        });
    }

    /**
     * Takes a phone number verification code as entered by the user and validates
     * it with the ID server, then if successful, adds the phone number.
     * @return {Promise} Resolves if the phone number was added. Rejects with an object
     * with a "message" property which contains a human-readable message detailing why
     * the request failed.
     */
    haveMsisdnToken(token) {
        return MatrixClientPeg.get().submitMsisdnToken(
            this.sessionId, this.clientSecret, token,
        ).then((result) => {
            if (result.errcode) {
                throw result;
            }
            const identityServerDomain = MatrixClientPeg.get().idBaseUrl.split("://")[1];
            return MatrixClientPeg.get().addThreePid({
                sid: this.sessionId,
                client_secret: this.clientSecret,
                id_server: identityServerDomain
            }, this.bind);
        });
    }
}

module.exports = AddThreepid;
