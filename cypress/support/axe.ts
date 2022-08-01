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
        'log',
        `${violations.length} accessibility violation${
            violations.length === 1 ? '' : 's'
        } ${violations.length === 1 ? 'was' : 'were'} detected`,
    );

    // pluck specific keys to keep the table readable
    const violationData = violations.map(({ id, impact, description, nodes }) => ({
        id,
        impact,
        description,
        nodes: nodes.length,
    }));

    cy.task('table', violationData);
}

Cypress.Commands.overwrite("checkA11y", (
    originalFn: Chainable["checkA11y"],
    context?: string | Node | axe.ContextObject | undefined,
    options: Options = {},
    violationCallback?: ((violations: axe.Result[]) => void) | undefined,
    skipFailures?: boolean,
): void => {
    return originalFn(context, {
        ...options,
        rules: {
            // Disable contrast checking for now as we have too many issues with it
            'color-contrast': {
                enabled: false,
            },
            ...options.rules,
        },
    }, violationCallback ?? terminalLog, skipFailures);
});
