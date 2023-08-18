/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

/// <reference types="cypress" />

import * as crypto from "crypto";

import Chainable = Cypress.Chainable;
import AUTWindow = Cypress.AUTWindow;
import { HomeserverInstance } from "../plugins/utils/homeserver";

export interface StartHomeserverOpts {
    /** path to template within cypress/plugins/{homeserver}docker/template/ directory. */
    template: string;

    /** Port of an OAuth server to configure the homeserver to use */
    oAuthServerPort?: number;

    /** Additional variables to inject into the configuration template **/
    variables?: Record<string, string | number>;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Start a homeserver instance with a given config template.
             *
             * @param opts: either the template path (within cypress/plugins/{homeserver}docker/template/), or
             *   an options object
             *
             * If any of opts.variables has the special value
             * '{{HOST_DOCKER_INTERNAL}}', it will be replaced by
             * 'host.docker.interal' if we are on Docker, or
             * 'host.containers.internal' on Podman.
             */
            startHomeserver(opts: string | StartHomeserverOpts): Chainable<HomeserverInstance>;

            /**
             * Custom command wrapping task:{homeserver}Stop whilst preventing uncaught exceptions
             * for if Homeserver stopping races with the app's background sync loop.
             *
             * @param homeserver the homeserver instance returned by {homeserver}Start (e.g. synapseStart).
             */
            stopHomeserver(homeserver: HomeserverInstance): Chainable<AUTWindow>;

            /**
             * Register a user on the given Homeserver using the shared registration secret.
             * @param homeserver the homeserver instance returned by start{Homeserver}
             * @param username the username of the user to register
             * @param password the password of the user to register
             * @param displayName optional display name to set on the newly registered user
             */
            registerUser(
                homeserver: HomeserverInstance,
                username: string,
                password: string,
                displayName?: string,
            ): Chainable<Credentials>;
        }
    }
}

function startHomeserver(opts: string | StartHomeserverOpts): Chainable<HomeserverInstance> {
    const homeserverName = Cypress.env("HOMESERVER");
    if (typeof opts === "string") {
        opts = { template: opts };
    }

    return cy.task<HomeserverInstance>(homeserverName + "Start", opts, { log: false }).then((x) => {
        Cypress.log({ name: "startHomeserver", message: `Started homeserver instance ${x.serverId}` });
    });
}

function stopHomeserver(homeserver?: HomeserverInstance): Chainable<AUTWindow> {
    if (!homeserver) return;
    // Navigate away from app to stop the background network requests which will race with Homeserver shutting down
    return cy.window({ log: false }).then((win) => {
        win.location.href = "about:blank";
        const homeserverName = Cypress.env("HOMESERVER");
        cy.task(homeserverName + "Stop", homeserver.serverId);
    });
}

export interface Credentials {
    accessToken: string;
    userId: string;
    deviceId: string;
    homeServer: string;
    password: string;
}

function registerUser(
    homeserver: HomeserverInstance,
    username: string,
    password: string,
    displayName?: string,
): Chainable<Credentials> {
    const url = `${homeserver.baseUrl}/_synapse/admin/v1/register`;
    return cy
        .then(() => {
            // get a nonce
            return cy.request<{ nonce: string }>({ url });
        })
        .then((response) => {
            const { nonce } = response.body;
            const mac = crypto
                .createHmac("sha1", homeserver.registrationSecret)
                .update(`${nonce}\0${username}\0${password}\0notadmin`)
                .digest("hex");

            return cy.request<{
                access_token: string;
                user_id: string;
                home_server: string;
                device_id: string;
            }>({
                url,
                method: "POST",
                body: {
                    nonce,
                    username,
                    password,
                    mac,
                    admin: false,
                    displayname: displayName,
                },
            });
        })
        .then((response) => ({
            homeServer: response.body.home_server,
            accessToken: response.body.access_token,
            userId: response.body.user_id,
            deviceId: response.body.device_id,
            password: password,
        }));
}

Cypress.Commands.add("startHomeserver", startHomeserver);
Cypress.Commands.add("stopHomeserver", stopHomeserver);
Cypress.Commands.add("registerUser", registerUser);
