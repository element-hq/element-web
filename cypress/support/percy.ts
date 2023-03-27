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
import { SnapshotOptions as PercySnapshotOptions } from "@percy/core";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface SnapshotOptions extends PercySnapshotOptions {
            domTransformation?: (documentClone: Document) => void;
            allowSpinners?: boolean;
        }

        interface Chainable {
            percySnapshotElement(name?: string, options?: SnapshotOptions);
        }

        interface Chainable {
            /**
             * Takes a Percy snapshot of a given element
             */
            percySnapshotElement(name: string, options: SnapshotOptions): Chainable<void>;
        }
    }
}

Cypress.Commands.add("percySnapshotElement", { prevSubject: "element" }, (subject, name, options) => {
    if (!options?.allowSpinners) {
        // Await spinners to vanish
        cy.get(".mx_Spinner", { log: false }).should("not.exist");
        // But like really no more spinners please
        cy.get(".mx_Spinner", { log: false }).should("not.exist");
        // Await inline spinners to vanish
        cy.get(".mx_InlineSpinner", { log: false }).should("not.exist");
    }
    cy.percySnapshot(name, {
        domTransformation: (documentClone) => scope(documentClone, subject.selector),
        ...options,
    });
});

function scope(documentClone: Document, selector: string): Document {
    const element = documentClone.querySelector(selector);
    documentClone.querySelector("body").innerHTML = element.outerHTML;

    return documentClone;
}

export {};
