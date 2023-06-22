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

/**
 * Assert that a toast with the given title exists, and return it
 *
 * @param expectedTitle - Expected title of the test
 * @returns a Chainable for the DOM element of the toast
 */
export function getToast(expectedTitle: string): Cypress.Chainable<JQuery> {
    return cy.contains(".mx_Toast_toast h2", expectedTitle).should("exist").closest(".mx_Toast_toast");
}
