/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createClient, type IRequestTokenResponse, type MatrixClient } from "matrix-js-sdk/src/matrix";

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
                    err.message = _t("auth|reset_password_email_not_found_title");
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
                    threepid_creds: creds,
                },
                this.password,
                this.logoutDevices,
            );
        } catch (err: any) {
            if (err.httpStatus === 401) {
                err.message = _t("settings|general|add_email_failed_verification");
            } else if (err.httpStatus === 404) {
                err.message = _t("auth|reset_password_email_not_associated");
            } else if (err.httpStatus) {
                err.message += ` (Status ${err.httpStatus})`;
            }
            throw err;
        }
    }
}
