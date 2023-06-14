/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { IAuthData, IRequestMsisdnTokenResponse, IRequestTokenResponse, MatrixClient } from "matrix-js-sdk/src/matrix";
import { MatrixError, HTTPError } from "matrix-js-sdk/src/matrix";

import Modal from "./Modal";
import { _t, UserFriendlyError } from "./languageHandler";
import IdentityAuthClient from "./IdentityAuthClient";
import { SSOAuthEntry } from "./components/views/auth/InteractiveAuthEntryComponents";
import InteractiveAuthDialog from "./components/views/dialogs/InteractiveAuthDialog";

function getIdServerDomain(matrixClient: MatrixClient): string {
    const idBaseUrl = matrixClient.getIdentityServerUrl(true);
    if (!idBaseUrl) {
        throw new UserFriendlyError("Identity server not set");
    }
    return idBaseUrl;
}

export type Binding = {
    bind: boolean;
    label: string;
    errorTitle: string;
};

/**
 * Allows a user to add a third party identifier to their homeserver and,
 * optionally, the identity servers.
 *
 * This involves getting an email token from the identity server to "prove" that
 * the client owns the given email address, which is then passed to the
 * add threepid API on the homeserver.
 *
 * Diagrams of the intended API flows here are available at:
 *
 * https://gist.github.com/jryans/839a09bf0c5a70e2f36ed990d50ed928
 */
export default class AddThreepid {
    private sessionId: string;
    private submitUrl?: string;
    private bind = false;
    private readonly clientSecret: string;

    public constructor(private readonly matrixClient: MatrixClient) {
        this.clientSecret = matrixClient.generateClientSecret();
    }

    /**
     * Attempt to add an email threepid to the homeserver.
     * This will trigger a side-effect of sending an email to the provided email address.
     * @param {string} emailAddress The email address to add
     * @return {Promise} Resolves when the email has been sent. Then call checkEmailLinkClicked().
     */
    public async addEmailAddress(emailAddress: string): Promise<IRequestTokenResponse> {
        try {
            const res = await this.matrixClient.requestAdd3pidEmailToken(emailAddress, this.clientSecret, 1);
            this.sessionId = res.sid;
            return res;
        } catch (err) {
            if (err instanceof MatrixError && err.errcode === "M_THREEPID_IN_USE") {
                throw new UserFriendlyError("This email address is already in use", { cause: err });
            }
            // Otherwise, just blurt out the same error
            throw err;
        }
    }

    /**
     * Attempt to bind an email threepid on the identity server via the homeserver.
     * This will trigger a side-effect of sending an email to the provided email address.
     * @param {string} emailAddress The email address to add
     * @return {Promise} Resolves when the email has been sent. Then call checkEmailLinkClicked().
     */
    public async bindEmailAddress(emailAddress: string): Promise<IRequestTokenResponse> {
        this.bind = true;
        if (await this.matrixClient.doesServerSupportSeparateAddAndBind()) {
            // For separate bind, request a token directly from the IS.
            const authClient = new IdentityAuthClient();
            const identityAccessToken = (await authClient.getAccessToken()) ?? undefined;
            try {
                const res = await this.matrixClient.requestEmailToken(
                    emailAddress,
                    this.clientSecret,
                    1,
                    undefined,
                    identityAccessToken,
                );
                this.sessionId = res.sid;
                return res;
            } catch (err) {
                if (err instanceof MatrixError && err.errcode === "M_THREEPID_IN_USE") {
                    throw new UserFriendlyError("This email address is already in use", { cause: err });
                }
                // Otherwise, just blurt out the same error
                throw err;
            }
        } else {
            // For tangled bind, request a token via the HS.
            return this.addEmailAddress(emailAddress);
        }
    }

    /**
     * Attempt to add a MSISDN threepid to the homeserver.
     * This will trigger a side-effect of sending an SMS to the provided phone number.
     * @param {string} phoneCountry The ISO 2 letter code of the country to resolve phoneNumber in
     * @param {string} phoneNumber The national or international formatted phone number to add
     * @return {Promise} Resolves when the text message has been sent. Then call haveMsisdnToken().
     */
    public async addMsisdn(phoneCountry: string, phoneNumber: string): Promise<IRequestMsisdnTokenResponse> {
        try {
            const res = await this.matrixClient.requestAdd3pidMsisdnToken(
                phoneCountry,
                phoneNumber,
                this.clientSecret,
                1,
            );
            this.sessionId = res.sid;
            this.submitUrl = res.submit_url;
            return res;
        } catch (err) {
            if (err instanceof MatrixError && err.errcode === "M_THREEPID_IN_USE") {
                throw new UserFriendlyError("This phone number is already in use", { cause: err });
            }
            // Otherwise, just blurt out the same error
            throw err;
        }
    }

    /**
     * Attempt to bind a MSISDN threepid on the identity server via the homeserver.
     * This will trigger a side-effect of sending an SMS to the provided phone number.
     * @param {string} phoneCountry The ISO 2 letter code of the country to resolve phoneNumber in
     * @param {string} phoneNumber The national or international formatted phone number to add
     * @return {Promise} Resolves when the text message has been sent. Then call haveMsisdnToken().
     */
    public async bindMsisdn(phoneCountry: string, phoneNumber: string): Promise<IRequestMsisdnTokenResponse> {
        this.bind = true;
        if (await this.matrixClient.doesServerSupportSeparateAddAndBind()) {
            // For separate bind, request a token directly from the IS.
            const authClient = new IdentityAuthClient();
            const identityAccessToken = (await authClient.getAccessToken()) ?? undefined;
            try {
                const res = await this.matrixClient.requestMsisdnToken(
                    phoneCountry,
                    phoneNumber,
                    this.clientSecret,
                    1,
                    undefined,
                    identityAccessToken,
                );
                this.sessionId = res.sid;
                return res;
            } catch (err) {
                if (err instanceof MatrixError && err.errcode === "M_THREEPID_IN_USE") {
                    throw new UserFriendlyError("This phone number is already in use", { cause: err });
                }
                // Otherwise, just blurt out the same error
                throw err;
            }
        } else {
            // For tangled bind, request a token via the HS.
            return this.addMsisdn(phoneCountry, phoneNumber);
        }
    }

    /**
     * Checks if the email link has been clicked by attempting to add the threepid
     * @return {Promise} Resolves if the email address was added. Rejects with an object
     * with a "message" property which contains a human-readable message detailing why
     * the request failed.
     */
    public async checkEmailLinkClicked(): Promise<[success?: boolean, result?: IAuthData | Error | null]> {
        try {
            if (await this.matrixClient.doesServerSupportSeparateAddAndBind()) {
                if (this.bind) {
                    const authClient = new IdentityAuthClient();
                    const identityAccessToken = await authClient.getAccessToken();
                    if (!identityAccessToken) {
                        throw new UserFriendlyError("No identity access token found");
                    }
                    await this.matrixClient.bindThreePid({
                        sid: this.sessionId,
                        client_secret: this.clientSecret,
                        id_server: getIdServerDomain(this.matrixClient),
                        id_access_token: identityAccessToken,
                    });
                } else {
                    try {
                        await this.makeAddThreepidOnlyRequest();

                        // The spec has always required this to use UI auth but synapse briefly
                        // implemented it without, so this may just succeed and that's OK.
                        return [true];
                    } catch (err) {
                        if (!(err instanceof MatrixError) || err.httpStatus !== 401 || !err.data || !err.data.flows) {
                            // doesn't look like an interactive-auth failure
                            throw err;
                        }

                        const dialogAesthetics = {
                            [SSOAuthEntry.PHASE_PREAUTH]: {
                                title: _t("Use Single Sign On to continue"),
                                body: _t(
                                    "Confirm adding this email address by using Single Sign On to prove your identity.",
                                ),
                                continueText: _t("Single Sign On"),
                                continueKind: "primary",
                            },
                            [SSOAuthEntry.PHASE_POSTAUTH]: {
                                title: _t("Confirm adding email"),
                                body: _t("Click the button below to confirm adding this email address."),
                                continueText: _t("Confirm"),
                                continueKind: "primary",
                            },
                        };
                        const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                            title: _t("Add Email Address"),
                            matrixClient: this.matrixClient,
                            authData: err.data,
                            makeRequest: this.makeAddThreepidOnlyRequest,
                            aestheticsForStagePhases: {
                                [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                                [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                            },
                        });
                        return finished;
                    }
                }
            } else {
                await this.matrixClient.addThreePid(
                    {
                        sid: this.sessionId,
                        client_secret: this.clientSecret,
                        id_server: getIdServerDomain(this.matrixClient),
                    },
                    this.bind,
                );
            }
        } catch (err) {
            if (err instanceof HTTPError && err.httpStatus === 401) {
                throw new UserFriendlyError(
                    "Failed to verify email address: make sure you clicked the link in the email",
                    { cause: err },
                );
            }
            // Otherwise, just blurt out the same error
            throw err;
        }
        return [];
    }

    /**
     * @param {{type: string, session?: string}} auth UI auth object
     * @return {Promise<Object>} Response from /3pid/add call (in current spec, an empty object)
     */
    private makeAddThreepidOnlyRequest = (auth?: { type: string; session?: string }): Promise<{}> => {
        return this.matrixClient.addThreePidOnly({
            sid: this.sessionId,
            client_secret: this.clientSecret,
            auth,
        });
    };

    /**
     * Takes a phone number verification code as entered by the user and validates
     * it with the identity server, then if successful, adds the phone number.
     * @param {string} msisdnToken phone number verification code as entered by the user
     * @return {Promise} Resolves if the phone number was added. Rejects with an object
     * with a "message" property which contains a human-readable message detailing why
     * the request failed.
     */
    public async haveMsisdnToken(
        msisdnToken: string,
    ): Promise<[success?: boolean, result?: IAuthData | Error | null] | undefined> {
        const authClient = new IdentityAuthClient();
        const supportsSeparateAddAndBind = await this.matrixClient.doesServerSupportSeparateAddAndBind();

        let result: { success: boolean } | MatrixError;
        if (this.submitUrl) {
            result = await this.matrixClient.submitMsisdnTokenOtherUrl(
                this.submitUrl,
                this.sessionId,
                this.clientSecret,
                msisdnToken,
            );
        } else if (this.bind || !supportsSeparateAddAndBind) {
            result = await this.matrixClient.submitMsisdnToken(
                this.sessionId,
                this.clientSecret,
                msisdnToken,
                await authClient.getAccessToken(),
            );
        } else {
            throw new UserFriendlyError("The add / bind with MSISDN flow is misconfigured");
        }
        if (result instanceof Error) {
            throw result;
        }

        if (supportsSeparateAddAndBind) {
            if (this.bind) {
                await this.matrixClient.bindThreePid({
                    sid: this.sessionId,
                    client_secret: this.clientSecret,
                    id_server: getIdServerDomain(this.matrixClient),
                    id_access_token: await authClient.getAccessToken(),
                });
            } else {
                try {
                    await this.makeAddThreepidOnlyRequest();

                    // The spec has always required this to use UI auth but synapse briefly
                    // implemented it without, so this may just succeed and that's OK.
                    return;
                } catch (err) {
                    if (!(err instanceof MatrixError) || err.httpStatus !== 401 || !err.data || !err.data.flows) {
                        // doesn't look like an interactive-auth failure
                        throw err;
                    }

                    const dialogAesthetics = {
                        [SSOAuthEntry.PHASE_PREAUTH]: {
                            title: _t("Use Single Sign On to continue"),
                            body: _t(
                                "Confirm adding this phone number by using Single Sign On to prove your identity.",
                            ),
                            continueText: _t("Single Sign On"),
                            continueKind: "primary",
                        },
                        [SSOAuthEntry.PHASE_POSTAUTH]: {
                            title: _t("Confirm adding phone number"),
                            body: _t("Click the button below to confirm adding this phone number."),
                            continueText: _t("Confirm"),
                            continueKind: "primary",
                        },
                    };
                    const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                        title: _t("Add Phone Number"),
                        matrixClient: this.matrixClient,
                        authData: err.data,
                        makeRequest: this.makeAddThreepidOnlyRequest,
                        aestheticsForStagePhases: {
                            [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                            [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                        },
                    });
                    return finished;
                }
            }
        } else {
            await this.matrixClient.addThreePid(
                {
                    sid: this.sessionId,
                    client_secret: this.clientSecret,
                    id_server: getIdServerDomain(this.matrixClient),
                },
                this.bind,
            );
        }
    }
}
