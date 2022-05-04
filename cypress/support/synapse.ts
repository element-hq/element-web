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
import { SynapseInstance } from "../plugins/synapsedocker";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Start a synapse instance with a given config template.
             * @param template path to template within cypress/plugins/synapsedocker/template/ directory.
             */
            startSynapse(template: string): Chainable<SynapseInstance>;
            /**
             * Custom command wrapping task:synapseStop whilst preventing uncaught exceptions
             * for if Synapse stopping races with the app's background sync loop.
             * @param synapse the synapse instance returned by startSynapse
             */
            stopSynapse(synapse: SynapseInstance): Chainable<AUTWindow>;
        }
    }
}

function startSynapse(template: string): Chainable<SynapseInstance> {
    return cy.task<SynapseInstance>("synapseStart", template);
}

function stopSynapse(synapse: SynapseInstance): Chainable<AUTWindow> {
    // Navigate away from app to stop the background network requests which will race with Synapse shutting down
    return cy.window().then((win) => {
        win.location.href = 'about:blank';
        cy.task("synapseStop", synapse.synapseId);
    });
}

Cypress.Commands.add("startSynapse", startSynapse);
Cypress.Commands.add("stopSynapse", stopSynapse);
