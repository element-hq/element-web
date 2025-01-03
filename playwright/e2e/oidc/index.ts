/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { API, Messages } from "mailhog";
import { Page } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";

export const test = base.extend<{}>({
    synapseConfigOptions: async ({ mas }, use) => {
        await use({
            enable_registration: undefined,
            enable_registration_without_verification: undefined,
            disable_msisdn_registration: undefined,
            experimental_features: {
                msc3861: {
                    enabled: true,
                    issuer: "http://mas:8080/",
                    issuer_metadata: {
                        "issuer": `http://localhost:${mas.getMappedPort(8080)}/`,
                        "authorization_endpoint": "http://mas:8080/authorize",
                        "token_endpoint": "http://mas:8080/oauth2/token",
                        "jwks_uri": "http://mas:8080/oauth2/keys.json",
                        "registration_endpoint": "http://mas:8080/oauth2/registration",
                        "scopes_supported": ["openid", "email"],
                        "response_types_supported": ["code", "id_token", "code id_token"],
                        "response_modes_supported": ["form_post", "query", "fragment"],
                        "grant_types_supported": [
                            "authorization_code",
                            "refresh_token",
                            "client_credentials",
                            "urn:ietf:params:oauth:grant-type:device_code",
                        ],
                        "token_endpoint_auth_methods_supported": [
                            "client_secret_basic",
                            "client_secret_post",
                            "client_secret_jwt",
                            "private_key_jwt",
                            "none",
                        ],
                        "token_endpoint_auth_signing_alg_values_supported": [
                            "HS256",
                            "HS384",
                            "HS512",
                            "RS256",
                            "RS384",
                            "RS512",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256",
                            "ES384",
                            "ES256K",
                        ],
                        "revocation_endpoint": "http://mas:8080/oauth2/revoke",
                        "revocation_endpoint_auth_methods_supported": [
                            "client_secret_basic",
                            "client_secret_post",
                            "client_secret_jwt",
                            "private_key_jwt",
                            "none",
                        ],
                        "revocation_endpoint_auth_signing_alg_values_supported": [
                            "HS256",
                            "HS384",
                            "HS512",
                            "RS256",
                            "RS384",
                            "RS512",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256",
                            "ES384",
                            "ES256K",
                        ],
                        "introspection_endpoint": "http://mas:8080/oauth2/introspect",
                        "introspection_endpoint_auth_methods_supported": [
                            "client_secret_basic",
                            "client_secret_post",
                            "client_secret_jwt",
                            "private_key_jwt",
                            "none",
                        ],
                        "introspection_endpoint_auth_signing_alg_values_supported": [
                            "HS256",
                            "HS384",
                            "HS512",
                            "RS256",
                            "RS384",
                            "RS512",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256",
                            "ES384",
                            "ES256K",
                        ],
                        "code_challenge_methods_supported": ["plain", "S256"],
                        "userinfo_endpoint": "http://mas:8080/oauth2/userinfo",
                        "subject_types_supported": ["public"],
                        "id_token_signing_alg_values_supported": [
                            "RS256",
                            "RS384",
                            "RS512",
                            "ES256",
                            "ES384",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256K",
                        ],
                        "userinfo_signing_alg_values_supported": [
                            "RS256",
                            "RS384",
                            "RS512",
                            "ES256",
                            "ES384",
                            "PS256",
                            "PS384",
                            "PS512",
                            "ES256K",
                        ],
                        "display_values_supported": ["page"],
                        "claim_types_supported": ["normal"],
                        "claims_supported": [
                            "iss",
                            "sub",
                            "aud",
                            "iat",
                            "exp",
                            "nonce",
                            "auth_time",
                            "at_hash",
                            "c_hash",
                        ],
                        "claims_parameter_supported": false,
                        "request_parameter_supported": false,
                        "request_uri_parameter_supported": false,
                        "prompt_values_supported": ["none", "login", "create"],
                        "device_authorization_endpoint": "http://mas:8080/oauth2/device",
                        "org.matrix.matrix-authentication-service.graphql_endpoint": "http://mas:8080/graphql",
                        "account_management_uri": "http://mas:8080/account/",
                        "account_management_actions_supported": [
                            "org.matrix.profile",
                            "org.matrix.sessions_list",
                            "org.matrix.session_view",
                            "org.matrix.session_end",
                        ],
                    },
                    client_id: "0000000000000000000SYNAPSE",
                    client_auth_method: "client_secret_basic",
                    client_secret: "SomeRandomSecret",
                    admin_token: "AnotherRandomSecret",
                    account_management_url: `http://localhost:${mas.getMappedPort(8080)}/account`,
                },
            },
        });
    },
    config: async ({ homeserver, mas, context }, use) => {
        const issuer = `http://localhost:${mas.getMappedPort(8080)}/`;
        const wellKnown = {
            "m.homeserver": {
                base_url: homeserver.baseUrl,
            },
            "org.matrix.msc2965.authentication": {
                issuer,
                account: `${issuer}account`,
            },
        };

        // Ensure org.matrix.msc2965.authentication is in well-known
        await context.route("https://localhost/.well-known/matrix/client", async (route) => {
            await route.fulfill({ json: wellKnown });
        });

        await use({
            default_server_config: wellKnown,
        });
    },
});

export { expect };

export async function registerAccountMas(
    page: Page,
    mailhog: API,
    username: string,
    email: string,
    password: string,
): Promise<void> {
    await expect(page.getByText("Please sign in to continue:")).toBeVisible();

    await page.getByRole("link", { name: "Create Account" }).click();
    await page.getByRole("textbox", { name: "Username" }).fill(username);
    await page.getByRole("textbox", { name: "Email address" }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByRole("textbox", { name: "Confirm Password" }).fill(password);
    await page.getByRole("button", { name: "Continue" }).click();

    let messages: Messages;
    await expect(async () => {
        messages = await mailhog.messages();
        expect(messages.items).toHaveLength(1);
    }).toPass();
    expect(messages.items[0].to).toEqual(`${username} <${email}>`);
    const [code] = messages.items[0].text.match(/(\d{6})/);

    await page.getByRole("textbox", { name: "6-digit code" }).fill(code);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Allow access to your account?")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
}
