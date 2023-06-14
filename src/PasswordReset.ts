/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

import { createClient, IRequestTokenResponse, MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "./languageHandler";

/**
 * Allows a user to reset their password on a homeserver.
 *
 * This involves getting an email token from the identity server to "prove" that
 * the client owns the given email address, which is then passed to the password
 * API on the homeserver in question with the new password.
 */
export default class PasswordReset {
    private client: MatrixClient;
    private clientSecret: string;
    private password = "";
    private sessionId = "";
    private logoutDevices = false;
    private sendAttempt = 0;

    /**
     * Configure the endpoints for password resetting.
     * @param {string} homeserverUrl The URL to the HS which has the account to reset.
     * @param {string} identityUrl The URL to the IS which has linked the email -> mxid mapping.
     */
    public constructor(homeserverUrl: string, identityUrl: string) {
        this.client = createClient({
            baseUrl: homeserverUrl,
            idBaseUrl: identityUrl,
        });
        this.clientSecret = this.client.generateClientSecret();
    }

    /**
     * Attempt to reset the user's password. This will trigger a side-effect of
     * sending an email to the provided email address.
     * @param {string} emailAddress The email address
     * @param {string} newPassword The new password for the account.
     * @param {boolean} logoutDevices Should all devices be signed out after the reset? Defaults to `true`.
     * @return {Promise} Resolves when the email has been sent. Then call checkEmailLinkClicked().
     */
    public async resetPassword(
        emailAddress: string,
        newPassword: string,
        logoutDevices = true,
    ): Promise<IRequestTokenResponse> {
        this.password = newPassword;
        this.logoutDevices = logoutDevices;
        this.sendAttempt++;

        try {
            const result = await this.client.requestPasswordEmailToken(
                emailAddress,
                this.clientSecret,
                this.sendAttempt,
            );
            this.sessionId = result.sid;
            return result;
        } catch (err: any) {
            if (err.errcode === "M_THREEPID_NOT_FOUND") {
                err.message = _t("This email address was not found");
            } else if (err.httpStatus) {
                err.message = err.message + ` (Status ${err.httpStatus})`;
            }
            throw err;
        }
    }

    /**
     * Request a password reset token.
     * This will trigger a side-effect of sending an email to the provided email address.
     */
    public requestResetToken(emailAddress: string): Promise<IRequestTokenResponse> {
        this.sendAttempt++;
        return this.client.requestPasswordEmailToken(emailAddress, this.clientSecret, this.sendAttempt).then(
            (res) => {
                this.sessionId = res.sid;
                return res;
            },
            function (err) {
                if (err.errcode === "M_THREEPID_NOT_FOUND") {
                    err.message = _t("This email address was not found");
                } else if (err.httpStatus) {
                    err.message = err.message + ` (Status ${err.httpStatus})`;
                }
                throw err;
            },
        );
    }

    public setLogoutDevices(logoutDevices: boolean): void {
        this.logoutDevices = logoutDevices;
    }

    public async setNewPassword(password: string): Promise<void> {
        this.password = password;
        await this.checkEmailLinkClicked();
    }

    /**
     * Checks if the email link has been clicked by attempting to change the password
     * for the mxid linked to the email.
     * @return {Promise} Resolves if the password was reset. Rejects with an object
     * with a "message" property which contains a human-readable message detailing why
     * the reset failed, e.g. "There is no mapped matrix user ID for the given email address".
     */
    public async checkEmailLinkClicked(): Promise<void> {
        const creds = {
            sid: this.sessionId,
            client_secret: this.clientSecret,
        };

        try {
            await this.client.setPassword(
                {
                    // Note: Though this sounds like a login type for identity servers only, it
                    // has a dual purpose of being used for homeservers too.
                    type: "m.login.email.identity",
                    // TODO: Remove `threepid_creds` once servers support proper UIA
                    // See https://github.com/matrix-org/synapse/issues/5665
                    // See https://github.com/matrix-org/matrix-doc/issues/2220
                    threepid_creds: creds,
                    threepidCreds: creds,
                },
                this.password,
                this.logoutDevices,
            );
        } catch (err: any) {
            if (err.httpStatus === 401) {
                err.message = _t("Failed to verify email address: make sure you clicked the link in the email");
            } else if (err.httpStatus === 404) {
                err.message = _t(
                    "Your email address does not appear to be associated with a Matrix ID on this homeserver.",
                );
            } else if (err.httpStatus) {
                err.message += ` (Status ${err.httpStatus})`;
            }
            throw err;
        }
    }
}
