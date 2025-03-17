/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type IAddThreePidOnlyBody,
    type IRequestMsisdnTokenResponse,
    type IRequestTokenResponse,
    type MatrixClient,
    MatrixError,
    HTTPError,
    type IThreepid,
} from "matrix-js-sdk/src/matrix";

import Modal from "./Modal";
import { _t, UserFriendlyError } from "./languageHandler";
import IdentityAuthClient from "./IdentityAuthClient";
import { SSOAuthEntry } from "./components/views/auth/InteractiveAuthEntryComponents";
import InteractiveAuthDialog, {
    type InteractiveAuthDialogProps,
} from "./components/views/dialogs/InteractiveAuthDialog";

function getIdServerDomain(matrixClient: MatrixClient): string {
    const idBaseUrl = matrixClient.getIdentityServerUrl(true);
    if (!idBaseUrl) {
        throw new UserFriendlyError("settings|general|identity_server_not_set");
    }
    return idBaseUrl;
}

export type Binding = {
    bind: boolean;
    label: string;
    errorTitle: string;
};

// IThreepid modified stripping validated_at and added_at as they aren't necessary for our UI
export type ThirdPartyIdentifier = Omit<IThreepid, "validated_at" | "added_at">;

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
    private sessionId?: string;
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
                throw new UserFriendlyError("settings|general|email_address_in_use", { cause: err });
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
                throw new UserFriendlyError("settings|general|email_address_in_use", { cause: err });
            }
            // Otherwise, just blurt out the same error
            throw err;
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
                throw new UserFriendlyError("settings|general|msisdn_in_use", { cause: err });
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
                throw new UserFriendlyError("settings|general|msisdn_in_use", { cause: err });
            }
            // Otherwise, just blurt out the same error
            throw err;
        }
    }

    /**
     * Checks if the email link has been clicked by attempting to add the threepid
     * @return {Promise} Resolves if the email address was added. Rejects with an object
     * with a "message" property which contains a human-readable message detailing why
     * the request failed.
     */
    public async checkEmailLinkClicked(): Promise<[success?: boolean, result?: IAddThreePidOnlyBody | Error | null]> {
        try {
            if (this.bind) {
                const authClient = new IdentityAuthClient();
                const identityAccessToken = await authClient.getAccessToken();
                if (!identityAccessToken) {
                    throw new UserFriendlyError("settings|general|identity_server_no_token");
                }
                await this.matrixClient.bindThreePid({
                    sid: this.sessionId!,
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
                    if (!(err instanceof MatrixError) || err.httpStatus !== 401 || !err.data?.flows) {
                        // doesn't look like an interactive-auth failure
                        throw err;
                    }

                    const dialogAesthetics = {
                        [SSOAuthEntry.PHASE_PREAUTH]: {
                            title: _t("auth|uia|sso_title"),
                            body: _t("auth|uia|sso_body"),
                            continueText: _t("auth|sso"),
                            continueKind: "primary",
                        },
                        [SSOAuthEntry.PHASE_POSTAUTH]: {
                            title: _t("settings|general|confirm_adding_email_title"),
                            body: _t("settings|general|confirm_adding_email_body"),
                            continueText: _t("action|confirm"),
                            continueKind: "primary",
                        },
                    };
                    const { finished } = Modal.createDialog(InteractiveAuthDialog<IAddThreePidOnlyBody>, {
                        title: _t("settings|general|add_email_dialog_title"),
                        matrixClient: this.matrixClient,
                        authData: err.data,
                        makeRequest: this.makeAddThreepidOnlyRequest,
                        aestheticsForStagePhases: {
                            [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                            [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                        },
                    } as InteractiveAuthDialogProps<IAddThreePidOnlyBody>);
                    return finished;
                }
            }
        } catch (err) {
            if (err instanceof HTTPError && err.httpStatus === 401) {
                throw new UserFriendlyError("settings|general|add_email_failed_verification", { cause: err });
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
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    private makeAddThreepidOnlyRequest = (auth?: IAddThreePidOnlyBody["auth"] | null): Promise<{}> => {
        return this.matrixClient.addThreePidOnly({
            sid: this.sessionId!,
            client_secret: this.clientSecret,
            auth: auth ?? undefined,
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
    ): Promise<[success?: boolean, result?: IAddThreePidOnlyBody | Error | null]> {
        const authClient = new IdentityAuthClient();

        if (this.submitUrl) {
            await this.matrixClient.submitMsisdnTokenOtherUrl(
                this.submitUrl,
                this.sessionId!,
                this.clientSecret,
                msisdnToken,
            );
        } else if (this.bind) {
            await this.matrixClient.submitMsisdnToken(
                this.sessionId!,
                this.clientSecret,
                msisdnToken,
                await authClient.getAccessToken(),
            );
        } else {
            throw new UserFriendlyError("settings|general|add_msisdn_misconfigured");
        }

        if (this.bind) {
            await this.matrixClient.bindThreePid({
                sid: this.sessionId!,
                client_secret: this.clientSecret,
                id_server: getIdServerDomain(this.matrixClient),
                id_access_token: await authClient.getAccessToken(),
            });
            return [true];
        } else {
            try {
                await this.makeAddThreepidOnlyRequest();

                // The spec has always required this to use UI auth but synapse briefly
                // implemented it without, so this may just succeed and that's OK.
                return [true];
            } catch (err) {
                if (!(err instanceof MatrixError) || err.httpStatus !== 401 || !err.data?.flows) {
                    // doesn't look like an interactive-auth failure
                    throw err;
                }

                const dialogAesthetics = {
                    [SSOAuthEntry.PHASE_PREAUTH]: {
                        title: _t("auth|uia|sso_title"),
                        body: _t("settings|general|add_msisdn_confirm_sso_button"),
                        continueText: _t("auth|sso"),
                        continueKind: "primary",
                    },
                    [SSOAuthEntry.PHASE_POSTAUTH]: {
                        title: _t("settings|general|add_msisdn_confirm_button"),
                        body: _t("settings|general|add_msisdn_confirm_body"),
                        continueText: _t("action|confirm"),
                        continueKind: "primary",
                    },
                };
                const { finished } = Modal.createDialog(InteractiveAuthDialog<IAddThreePidOnlyBody>, {
                    title: _t("settings|general|add_msisdn_dialog_title"),
                    matrixClient: this.matrixClient,
                    authData: err.data,
                    makeRequest: this.makeAddThreepidOnlyRequest,
                    aestheticsForStagePhases: {
                        [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                        [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                    },
                } as InteractiveAuthDialogProps<IAddThreePidOnlyBody>);
                return finished;
            }
        }
    }
}
