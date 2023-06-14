/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import Chainable = Cypress.Chainable;
import { HomeserverInstance } from "../plugins/utils/homeserver";
import { collapseLastLogGroup } from "./log";

export interface UserCredentials {
    accessToken: string;
    username: string;
    userId: string;
    deviceId: string;
    password: string;
    homeServer: string;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Generates a test user and instantiates an Element session with that user.
             * @param synapse the synapse returned by startSynapse
             * @param displayName the displayName to give the test user
             * @param prelaunchFn optional function to run before the app is visited
             * @param userIdPrefix optional prefix to use for the generated user id. If unspecified, `user_` will be
             *     useed.
             */
            initTestUser(
                homeserver: HomeserverInstance,
                displayName: string,
                prelaunchFn?: () => void,
                userIdPrefix?: string,
            ): Chainable<UserCredentials>;
            /**
             * Logs into synapse with the given username/password
             * @param synapse the synapse returned by startSynapse
             * @param username login username
             * @param password login password
             */
            loginUser(synapse: HomeserverInstance, username: string, password: string): Chainable<UserCredentials>;
        }
    }
}

// eslint-disable-next-line max-len
Cypress.Commands.add(
    "loginUser",
    (homeserver: HomeserverInstance, username: string, password: string): Chainable<UserCredentials> => {
        const url = `${homeserver.baseUrl}/_matrix/client/r0/login`;
        return cy
            .request<{
                access_token: string;
                user_id: string;
                device_id: string;
                home_server: string;
            }>({
                url,
                method: "POST",
                body: {
                    type: "m.login.password",
                    identifier: {
                        type: "m.id.user",
                        user: username,
                    },
                    password: password,
                },
            })
            .then((response) => ({
                password,
                username,
                accessToken: response.body.access_token,
                userId: response.body.user_id,
                deviceId: response.body.device_id,
                homeServer: response.body.home_server,
            }));
    },
);

// eslint-disable-next-line max-len
Cypress.Commands.add(
    "initTestUser",
    (
        homeserver: HomeserverInstance,
        displayName: string,
        prelaunchFn?: () => void,
        userIdPrefix = "user_",
    ): Chainable<UserCredentials> => {
        Cypress.log({ name: "initTestUser", groupStart: true });
        // XXX: work around Cypress not clearing IDB between tests
        cy.window({ log: false }).then((win) => {
            win.indexedDB.databases()?.then((databases) => {
                databases.forEach((database) => {
                    win.indexedDB.deleteDatabase(database.name);
                });
            });
        });

        const username = Cypress._.uniqueId(userIdPrefix);
        const password = Cypress._.uniqueId("password_");
        return cy
            .registerUser(homeserver, username, password, displayName)
            .then(() => {
                return cy.loginUser(homeserver, username, password);
            })
            .then((response) => {
                cy.log(`Registered test user ${username} with displayname ${displayName}`);
                cy.window({ log: false }).then((win) => {
                    // Seed the localStorage with the required credentials
                    win.localStorage.setItem("mx_hs_url", homeserver.baseUrl);
                    win.localStorage.setItem("mx_user_id", response.userId);
                    win.localStorage.setItem("mx_access_token", response.accessToken);
                    win.localStorage.setItem("mx_device_id", response.deviceId);
                    win.localStorage.setItem("mx_is_guest", "false");
                    win.localStorage.setItem("mx_has_pickle_key", "false");
                    win.localStorage.setItem("mx_has_access_token", "true");

                    // Ensure the language is set to a consistent value
                    win.localStorage.setItem("mx_local_settings", '{"language":"en"}');
                });

                prelaunchFn?.();

                return cy
                    .visit("/")
                    .then(() => {
                        // wait for the app to load
                        return cy.get(".mx_MatrixChat", { timeout: 30000 });
                    })
                    .then(() => {
                        Cypress.log({
                            groupEnd: true,
                            emitOnly: true,
                        });
                        collapseLastLogGroup();
                    })
                    .then(() => ({
                        password,
                        username,
                        accessToken: response.accessToken,
                        userId: response.userId,
                        deviceId: response.deviceId,
                        homeServer: response.homeServer,
                    }));
            });
    },
);
