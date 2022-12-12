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

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Starts a web server which serves the given HTML.
             * @param html The HTML to serve
             * @returns The URL at which the HTML can be accessed.
             */
            serveHtmlFile(html: string): Chainable<string>;

            /**
             * Stops all running web servers.
             */
            stopWebServers(): Chainable<void>;
        }
    }
}

function serveHtmlFile(html: string): Chainable<string> {
    return cy.task<string>("serveHtmlFile", html);
}

function stopWebServers(): Chainable<void> {
    return cy.task("stopWebServers");
}

Cypress.Commands.add("serveHtmlFile", serveHtmlFile);
Cypress.Commands.add("stopWebServers", stopWebServers);

// Needed to make this file a module
export {};
