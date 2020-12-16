/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

// @ts-ignore - XXX: tsc doesn't like this: our js-sdk imports are complex so this isn't surprising
import Matrix from "matrix-js-sdk";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { IMatrixClientCreds } from "./MatrixClientPeg";
import SecurityCustomisations from "./customisations/Security";

interface ILoginOptions {
    defaultDeviceDisplayName?: string;
}

// TODO: Move this to JS SDK
interface IPasswordFlow {
    type: "m.login.password";
}

export interface IIdentityProvider {
    id: string;
    name: string;
    icon?: string;
}

export interface ISSOFlow {
    type: "m.login.sso" | "m.login.cas";
    "org.matrix.msc2858.identity_providers": IIdentityProvider[]; // Unstable prefix for MSC2858
}

export type LoginFlow = ISSOFlow | IPasswordFlow;

// TODO: Move this to JS SDK
/* eslint-disable camelcase */
interface ILoginParams {
    identifier?: string;
    password?: string;
    token?: string;
    device_id?: string;
    initial_device_display_name?: string;
}
/* eslint-enable camelcase */

export default class Login {
    private hsUrl: string;
    private isUrl: string;
    private fallbackHsUrl: string;
    // TODO: Flows need a type in JS SDK
    private flows: Array<LoginFlow>;
    private defaultDeviceDisplayName: string;
    private tempClient: MatrixClient;

    constructor(
        hsUrl: string,
        isUrl: string,
        fallbackHsUrl?: string,
        opts?: ILoginOptions,
    ) {
        this.hsUrl = hsUrl;
        this.isUrl = isUrl;
        this.fallbackHsUrl = fallbackHsUrl;
        this.flows = [];
        this.defaultDeviceDisplayName = opts.defaultDeviceDisplayName;
        this.tempClient = null; // memoize
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
     * Get a temporary MatrixClient, which can be used for login or register
     * requests.
     * @returns {MatrixClient}
     */
    public createTemporaryClient(): MatrixClient {
        if (this.tempClient) return this.tempClient; // use memoization
        return this.tempClient = Matrix.createClient({
            baseUrl: this.hsUrl,
            idBaseUrl: this.isUrl,
        });
    }

    public async getFlows(): Promise<Array<LoginFlow>> {
        const client = this.createTemporaryClient();
        const { flows } = await client.loginFlows();
        this.flows = flows;
        return this.flows;
    }

    public loginViaPassword(
        username: string,
        phoneCountry: string,
        phoneNumber: string,
        password: string,
    ): Promise<IMatrixClientCreds> {
        const isEmail = username.indexOf("@") > 0;

        let identifier;
        if (phoneCountry && phoneNumber) {
            identifier = {
                type: 'm.id.phone',
                country: phoneCountry,
                phone: phoneNumber,
                // XXX: Synapse historically wanted `number` and not `phone`
                number: phoneNumber,
            };
        } else if (isEmail) {
            identifier = {
                type: 'm.id.thirdparty',
                medium: 'email',
                address: username,
            };
        } else {
            identifier = {
                type: 'm.id.user',
                user: username,
            };
        }

        const loginParams = {
            password,
            identifier,
            initial_device_display_name: this.defaultDeviceDisplayName,
        };

        const tryFallbackHs = (originalError) => {
            return sendLoginRequest(
                this.fallbackHsUrl, this.isUrl, 'm.login.password', loginParams,
            ).catch((fallbackError) => {
                console.log("fallback HS login failed", fallbackError);
                // throw the original error
                throw originalError;
            });
        };

        let originalLoginError = null;
        return sendLoginRequest(
            this.hsUrl, this.isUrl, 'm.login.password', loginParams,
        ).catch((error) => {
            originalLoginError = error;
            if (error.httpStatus === 403) {
                if (this.fallbackHsUrl) {
                    return tryFallbackHs(originalLoginError);
                }
            }
            throw originalLoginError;
        }).catch((error) => {
            console.log("Login failed", error);
            throw error;
        });
    }
}


/**
 * Send a login request to the given server, and format the response
 * as a MatrixClientCreds
 *
 * @param {string} hsUrl   the base url of the Homeserver used to log in.
 * @param {string} isUrl   the base url of the default identity server
 * @param {string} loginType the type of login to do
 * @param {ILoginParams} loginParams the parameters for the login
 *
 * @returns {MatrixClientCreds}
 */
export async function sendLoginRequest(
    hsUrl: string,
    isUrl: string,
    loginType: string,
    loginParams: ILoginParams,
): Promise<IMatrixClientCreds> {
    const client = Matrix.createClient({
        baseUrl: hsUrl,
        idBaseUrl: isUrl,
    });

    const data = await client.login(loginType, loginParams);

    const wellknown = data.well_known;
    if (wellknown) {
        if (wellknown["m.homeserver"] && wellknown["m.homeserver"]["base_url"]) {
            hsUrl = wellknown["m.homeserver"]["base_url"];
            console.log(`Overrode homeserver setting with ${hsUrl} from login response`);
        }
        if (wellknown["m.identity_server"] && wellknown["m.identity_server"]["base_url"]) {
            // TODO: should we prompt here?
            isUrl = wellknown["m.identity_server"]["base_url"];
            console.log(`Overrode IS setting with ${isUrl} from login response`);
        }
    }

    const creds: IMatrixClientCreds = {
        homeserverUrl: hsUrl,
        identityServerUrl: isUrl,
        userId: data.user_id,
        deviceId: data.device_id,
        accessToken: data.access_token,
    };

    SecurityCustomisations.examineLoginResponse?.(data, creds);

    return creds;
}
