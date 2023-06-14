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

import "cypress-axe";
import * as axe from "axe-core";
import { Options } from "cypress-axe";

import Chainable = Cypress.Chainable;

function terminalLog(violations: axe.Result[]): void {
    cy.task(
        "log",
        `${violations.length} accessibility violation${violations.length === 1 ? "" : "s"} ${
            violations.length === 1 ? "was" : "were"
        } detected`,
    );

    // pluck specific keys to keep the table readable
    const violationData = violations.map(({ id, impact, description, nodes }) => ({
        id,
        impact,
        description,
        nodes: nodes.length,
    }));

    cy.task("table", violationData);
}

Cypress.Commands.overwrite(
    "checkA11y",
    (
        originalFn: Chainable["checkA11y"],
        context?: string | Node | axe.ContextObject | undefined,
        options: Options = {},
        violationCallback?: ((violations: axe.Result[]) => void) | undefined,
        skipFailures?: boolean,
    ): void => {
        return originalFn(
            context,
            {
                ...options,
                rules: {
                    // Disable contrast checking for now as we have too many issues with it
                    "color-contrast": {
                        enabled: false,
                    },
                    // link-in-text-block also complains due to known contrast issues
                    "link-in-text-block": {
                        enabled: false,
                    },
                    ...options.rules,
                },
            },
            violationCallback ?? terminalLog,
            skipFailures,
        );
    },
);

// Load axe-core into the window under test.
//
// The injectAxe in cypress-axe attempts to load axe via an `eval`. That conflicts with our CSP
// which disallows "unsafe-eval". So, replace it with an implementation that loads it via an
// injected <script> element.
Cypress.Commands.overwrite("injectAxe", (originalFn: Chainable["injectAxe"]): void => {
    Cypress.log({ name: "injectAxe" });

    // load the minified axe source, and create an intercept to serve it up
    cy.readFile("node_modules/axe-core/axe.min.js", { log: false }).then((source) => {
        cy.intercept("/_axe", source);
    });

    // inject a script tag to load it
    cy.get("head", { log: false }).then(
        (head) =>
            new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.type = "text/javascript";
                script.async = true;
                script.onload = resolve;
                script.onerror = (_e) => {
                    // Unfortunately there does not seem to be a way to get a reason for the error.
                    // The error event is useless.
                    reject(new Error("Unable to load axe"));
                };
                script.src = "/_axe";
                head.get()[0].appendChild(script);
            }),
    );
});
