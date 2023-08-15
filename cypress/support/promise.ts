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

import Chainable = Cypress.Chainable;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Utility wrapper around promises to help control flow in tests
             * Calls `fn` function `tries` times, with a sleep of `interval` between calls.
             * Ensure you do not rely on any effects of calling any `cy.*` functions within the body of `fn`
             * as the calls will not happen until after waitForPromise returns.
             * @param fn the function to retry
             * @param tries the number of tries to call it
             * @param interval the time interval between tries
             */
            waitForPromise(fn: () => Promise<unknown>, tries?: number, interval?: number): Chainable<unknown>;
        }
    }
}

function waitForPromise(fn: () => Promise<unknown>, tries = 10, interval = 1000): Chainable<unknown> {
    return cy.then(
        () =>
            new Cypress.Promise(async (resolve, reject) => {
                for (let i = 0; i < tries; i++) {
                    try {
                        const v = await fn();
                        resolve(v);
                    } catch {
                        await new Cypress.Promise((resolve) => setTimeout(resolve, interval));
                    }
                }
                reject();
            }),
    );
}

Cypress.Commands.add("waitForPromise", waitForPromise);

export {};
