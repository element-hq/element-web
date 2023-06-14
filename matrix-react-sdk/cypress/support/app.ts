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

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Applies tweaks to the config read from config.json
             */
            tweakConfig(tweaks: Record<string, any>): Chainable<AUTWindow>;
        }
    }
}

Cypress.Commands.add("tweakConfig", (tweaks: Record<string, any>): Chainable<AUTWindow> => {
    return cy.window().then((win) => {
        // note: we can't *set* the object because the window version is effectively a pointer.
        for (const [k, v] of Object.entries(tweaks)) {
            // @ts-ignore - for some reason it's not picking up on global.d.ts types.
            win.mxReactSdkConfig[k] = v;
        }
    });
});

// Needed to make this file a module
export {};
