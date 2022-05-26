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

// @see https://github.com/cypress-io/cypress/issues/915#issuecomment-475862672
// Modified due to changes to `cy.queue` https://github.com/cypress-io/cypress/pull/17448
// Note: this DOES NOT run Promises in parallel like `Promise.all` due to the nature
// of Cypress promise-like objects and command queue. This only makes it convenient to use the same
// API but runs the commands sequentially.

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        type ChainableValue<T> = T extends Cypress.Chainable<infer V> ? V : T;

        interface cy {
            all<T extends Cypress.Chainable[] | []>(
                commands: T
            ): Cypress.Chainable<{ [P in keyof T]: ChainableValue<T[P]> }>;
            queue: any;
        }

        interface Chainable {
            chainerId: string;
        }
    }
}

const chainStart = Symbol("chainStart");

/**
 * @description Returns a single Chainable that resolves when all of the Chainables pass.
 * @param {Cypress.Chainable[]} commands - List of Cypress.Chainable to resolve.
 * @returns {Cypress.Chainable} Cypress when all Chainables are resolved.
 */
cy.all = function all(commands): Cypress.Chainable {
    const chain = cy.wrap(null, { log: false });
    const stopCommand = Cypress._.find(cy.queue.get(), {
        attributes: { chainerId: chain.chainerId },
    });
    const startCommand = Cypress._.find(cy.queue.get(), {
        attributes: { chainerId: commands[0].chainerId },
    });
    const p = chain.then(() => {
        return cy.wrap(
            // @see https://lodash.com/docs/4.17.15#lodash
            Cypress._(commands)
                .map(cmd => {
                    return cmd[chainStart]
                        ? cmd[chainStart].attributes
                        : Cypress._.find(cy.queue.get(), {
                            attributes: { chainerId: cmd.chainerId },
                        }).attributes;
                })
                .concat(stopCommand.attributes)
                .slice(1)
                .map(cmd => {
                    return cmd.prev.get("subject");
                })
                .value(),
        );
    });
    p[chainStart] = startCommand;
    return p;
};

// Needed to make this file a module
export { };
