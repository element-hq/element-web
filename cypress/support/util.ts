/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        type ChainableValue<T> = T extends Cypress.Chainable<infer V> ? V : T;

        interface cy {
            all<T extends Cypress.Chainable[] | []>(
                commands: T,
            ): Cypress.Chainable<{ [P in keyof T]: ChainableValue<T[P]> }>;
        }
    }
}

/**
 * @description Returns a single Chainable that resolves when all of the Chainables pass.
 * @param {Cypress.Chainable[]} commands - List of Cypress.Chainable to resolve.
 * @returns {Cypress.Chainable} Cypress when all Chainables are resolved.
 */
cy.all = function all(commands): Cypress.Chainable {
    const resultArray = [];

    // as each command completes, store the result in the corresponding location of resultArray.
    for (let i = 0; i < commands.length; i++) {
        commands[i].then((val) => {
            resultArray[i] = val;
        });
    }

    // add an entry to the log which, when clicked, will write the results to the console.
    Cypress.log({
        name: "all",
        consoleProps: () => ({ Results: resultArray }),
    });

    // return a chainable which wraps the resultArray. Although this doesn't have a direct dependency on the input
    // commands, cypress won't process it until the commands that precede it on the command queue (which must include
    // the input commands) have passed.
    return cy.wrap(resultArray, { log: false });
};

/**
 * Check if Cypress has been configured to enable rust crypto, and bail out if so.
 */
export function skipIfRustCrypto() {
    if (isRustCryptoEnabled()) {
        cy.log("Skipping due to rust crypto");
        //@ts-ignore: 'state' is a secret internal command
        cy.state("runnable").skip();
    }
}

/**
 * Determine if Cypress has been configured to enable rust crypto (by checking the environment variable)
 */
export function isRustCryptoEnabled(): boolean {
    return !!Cypress.env("RUST_CRYPTO");
}
