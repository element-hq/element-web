/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    createClient,
    type MatrixClient,
    type LoginFlow,
    DELEGATED_OIDC_COMPATIBILITY,
    type ILoginFlow,
    type LoginRequest,
    type OidcClientConfig,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { type IMatrixClientCreds } from "./MatrixClientPeg";
import { ModuleRunner } from "./modules/ModuleRunner";
import { getOidcClientId } from "./utils/oidc/registerClient";
import { type IConfigOptions } from "./IConfigOptions";
import SdkConfig from "./SdkConfig";
import { isUserRegistrationSupported } from "./utils/oidc/isUserRegistrationSupported";

/**
 * Login flows supported by this client
 * LoginFlow type use the client API /login endpoint
 * OidcNativeFlow is specific to this client
 */
export type ClientLoginFlow = LoginFlow | OidcNativeFlow;

interface ILoginOptions {
    defaultDeviceDisplayName?: string;
    /**
     * Delegated auth config from server's .well-known.
     *
     * If this property is set, we will attempt an OIDC login using the delegated auth settings.
     * The caller is responsible for checking that OIDC is enabled in the labs settings.
     */
    delegatedAuthentication?: OidcClientConfig;
}

export default class Login {
    private flows: Array<ClientLoginFlow> = [];
    private readonly defaultDeviceDisplayName?: string;
    private delegatedAuthentication?: OidcClientConfig;
    private tempClient: MatrixClient | null = null; // memoize

    public constructor(
        private hsUrl: string,
        private isUrl: string,
        private fallbackHsUrl: string | null,
        opts: ILoginOptions,
    ) {
        this.defaultDeviceDisplayName = opts.defaultDeviceDisplayName;
        this.delegatedAuthentication = opts.delegatedAuthentication;
    }

    public getHomeserverUrl(): string {
        return this.hsUrl;
    }

    public getIdentityServerUrl(): string {
        return this.isUrl;
    }

    public setHomeserverUrl(hsUrl: string): void {
        this.tempClient = null; // clear memoization
        this.hsUrl = hsUrl;
    }

    public setIdentityServerUrl(isUrl: string): void {
        this.tempClient = null; // clear memoization
        this.isUrl = isUrl;
    }

    /**
     * Set delegated authentication config, clears tempClient.
     * @param delegatedAuthentication delegated auth config, from ValidatedServerConfig
     */
    public setDelegatedAuthentication(delegatedAuthentication?: OidcClientConfig): void {
        this.tempClient = null; // clear memoization
        this.delegatedAuthentication = delegatedAuthentication;
    }

    /**
     * Get a temporary MatrixClient, which can be used for login or register
     * requests.
     * @returns {MatrixClient}
     */
    public createTemporaryClient(): MatrixClient {
        if (!this.tempClient) {
            this.tempClient = createClient({
                baseUrl: this.hsUrl,
                idBaseUrl: this.isUrl,
            });
        }
        return this.tempClient;
    }

    /**
     * Get supported login flows
     * @param isRegistration OPTIONAL used to verify registration is supported in delegated authentication config
     * @returns Promise that resolves to supported login flows
     */
    public async getFlows(isRegistration?: boolean): Promise<Array<ClientLoginFlow>> {
        // try to use oidc native flow if we have delegated auth config
        if (this.delegatedAuthentication) {
            try {
                const oidcFlow = await tryInitOidcNativeFlow(
                    this.delegatedAuthentication,
                    SdkConfig.get().oidc_static_clients,
                    isRegistration,
                );
                return [oidcFlow];
            } catch (error) {
                logger.error(error);
            }
        }

        // oidc native flow not supported, continue with matrix login
        const client = this.createTemporaryClient();
        const { flows }: { flows: LoginFlow[] } = await client.loginFlows();
        // If an m.login.sso flow is present which is also flagged as being for MSC3824 OIDC compatibility then we only
        // return that flow as (per MSC3824) it is the only one that the user should be offered to give the best experience
        const oidcCompatibilityFlow = flows.find(
            (f) => f.type === "m.login.sso" && DELEGATED_OIDC_COMPATIBILITY.findIn(f),
        );
        this.flows = oidcCompatibilityFlow ? [oidcCompatibilityFlow] : flows;
        return this.flows;
    }

    public loginViaPassword(
        username: string | undefined,
        phoneCountry: string | undefined,
        phoneNumber: string | undefined,
        password: string,
    ): Promise<IMatrixClientCreds> {
        const isEmail = !!username && username.indexOf("@") > 0;

        let identifier;
        if (phoneCountry && phoneNumber) {
            identifier = {
                type: "m.id.phone",
                country: phoneCountry,
                phone: phoneNumber,
                // XXX: Synapse historically wanted `number` and not `phone`
                number: phoneNumber,
            };
        } else if (isEmail) {
            identifier = {
                type: "m.id.thirdparty",
                medium: "email",
                address: username,
            };
        } else {
            identifier = {
                type: "m.id.user",
                user: username,
            };
        }

        const loginParams = {
            password,
            identifier,
            initial_device_display_name: this.defaultDeviceDisplayName,
        };

        const tryFallbackHs = (originalError: Error): Promise<IMatrixClientCreds> => {
            return sendLoginRequest(this.fallbackHsUrl!, this.isUrl, "m.login.password", loginParams).catch(
                (fallbackError) => {
                    logger.log("fallback HS login failed", fallbackError);
                    // throw the original error
                    throw originalError;
                },
            );
        };

        let originalLoginError: Error | null = null;
        return sendLoginRequest(this.hsUrl, this.isUrl, "m.login.password", loginParams)
            .catch((error) => {
                originalLoginError = error;
                if (error.httpStatus === 403) {
                    if (this.fallbackHsUrl) {
                        return tryFallbackHs(originalLoginError!);
                    }
                }
                throw originalLoginError;
            })
            .catch((error) => {
                logger.log("Login failed", error);
                throw error;
            });
    }
}

/**
 * Describes the OIDC native login flow
 * Separate from js-sdk's `LoginFlow` as this does not use the same /login flow
 * to which that type belongs.
 */
export interface OidcNativeFlow extends ILoginFlow {
    type: "oidcNativeFlow";
    // this client's id as registered with the configured OIDC OP
    clientId: string;
}
/**
 * Prepares an OidcNativeFlow for logging into the server.
 *
 * Finds a static clientId for configured issuer, or attempts dynamic registration with the OP, and wraps the
 * results.
 *
 * @param delegatedAuthConfig  Auth config from ValidatedServerConfig
 * @param staticOidcClientIds static client config from config.json, used during client registration with OP
 * @param isRegistration true when we are attempting registration
 * @returns Promise<OidcNativeFlow> when oidc native authentication flow is supported and correctly configured
 * @throws when client can't register with OP, or any unexpected error
 */
const tryInitOidcNativeFlow = async (
    delegatedAuthConfig: OidcClientConfig,
    staticOidcClientIds?: IConfigOptions["oidc_static_clients"],
    isRegistration?: boolean,
): Promise<OidcNativeFlow> => {
    // if registration is not supported, bail before attempting to get the clientId
    if (isRegistration && !isUserRegistrationSupported(delegatedAuthConfig)) {
        throw new Error("Registration is not supported by OP");
    }
    const clientId = await getOidcClientId(delegatedAuthConfig, staticOidcClientIds);

    const flow = {
        type: "oidcNativeFlow",
        clientId,
    } as OidcNativeFlow;

    return flow;
};

/**
 * Send a login request to the given server, and format the response
 * as a MatrixClientCreds
 *
 * @param {string} hsUrl   the base url of the Homeserver used to log in.
 * @param {string} isUrl   the base url of the default identity server
 * @param {string} loginType the type of login to do
 * @param {ILoginParams} loginParams the parameters for the login
 *
 * @returns {IMatrixClientCreds}
 */
export async function sendLoginRequest(
    hsUrl: string,
    isUrl: string | undefined,
    loginType: string,
    loginParams: Omit<LoginRequest, "type">,
): Promise<IMatrixClientCreds> {
    const client = createClient({
        baseUrl: hsUrl,
        idBaseUrl: isUrl,
    });

    const data = await client.login(loginType, loginParams);

    const wellknown = data.well_known;
    if (wellknown) {
        if (wellknown["m.homeserver"]?.["base_url"]) {
            hsUrl = wellknown["m.homeserver"]["base_url"];
            logger.log(`Overrode homeserver setting with ${hsUrl} from login response`);
        }
        if (wellknown["m.identity_server"]?.["base_url"]) {
            // TODO: should we prompt here?
            isUrl = wellknown["m.identity_server"]["base_url"];
            logger.log(`Overrode IS setting with ${isUrl} from login response`);
        }
    }

    const creds: IMatrixClientCreds = {
        homeserverUrl: hsUrl,
        identityServerUrl: isUrl,
        userId: data.user_id,
        deviceId: data.device_id,
        accessToken: data.access_token,
    };

    ModuleRunner.instance.extensions.cryptoSetup.examineLoginResponse(data, creds);

    return creds;
}
