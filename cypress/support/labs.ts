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

import Chainable = Cypress.Chainable;

/// <reference types="cypress" />

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Enables a labs feature for an element session.
             * Has to be called before the session is initialized
             * @param feature labsFeature to enable (e.g. "feature_spotlight")
             */
            enableLabsFeature(feature: string): Chainable<null>;
        }
    }
}

Cypress.Commands.add("enableLabsFeature", (feature: string): Chainable<null> => {
    return cy
        .window({ log: false })
        .then((win) => {
            win.localStorage.setItem(`mx_labs_feature_${feature}`, "true");
        })
        .then(() => null);
});

// Needed to make this file a module
export {};
