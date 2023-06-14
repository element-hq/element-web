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
import AUTWindow = Cypress.AUTWindow;
import { ProxyInstance } from "../plugins/sliding-sync";
import { HomeserverInstance } from "../plugins/utils/homeserver";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Start a sliding sync proxy instance.
             * @param homeserver the homeserver instance returned by startHomeserver
             */
            startProxy(homeserver: HomeserverInstance): Chainable<ProxyInstance>;

            /**
             * Custom command wrapping task:proxyStop whilst preventing uncaught exceptions
             * for if Docker stopping races with the app's background sync loop.
             * @param proxy the proxy instance returned by startProxy
             */
            stopProxy(proxy: ProxyInstance): Chainable<AUTWindow>;
        }
    }
}

function startProxy(homeserver: HomeserverInstance): Chainable<ProxyInstance> {
    return cy.task<ProxyInstance>("proxyStart", homeserver);
}

function stopProxy(proxy?: ProxyInstance): Chainable<AUTWindow> {
    if (!proxy) return;
    // Navigate away from app to stop the background network requests which will race with Homeserver shutting down
    return cy.window({ log: false }).then((win) => {
        win.location.href = "about:blank";
        cy.task("proxyStop", proxy);
    });
}

Cypress.Commands.add("startProxy", startProxy);
Cypress.Commands.add("stopProxy", stopProxy);
