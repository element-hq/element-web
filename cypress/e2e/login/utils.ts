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

/** Visit the login page, choose to log in with "OAuth test", register a new account, and redirect back to Element
 */
export function doTokenRegistration(homeserverUrl: string) {
    cy.visit("/#/login");

    cy.findByRole("button", { name: "Edit" }).click();
    cy.findByRole("textbox", { name: "Other homeserver" }).type(homeserverUrl);
    cy.findByRole("button", { name: "Continue" }).click();
    // wait for the dialog to go away
    cy.get(".mx_ServerPickerDialog").should("not.exist");

    // click on "Continue with OAuth test"
    cy.findByRole("button", { name: "Continue with OAuth test" }).click();

    // wait for the Test OAuth Page to load
    cy.findByText("Test OAuth page");

    // click the submit button
    cy.findByRole("button", { name: "Submit" }).click();

    // Synapse prompts us to pick a user ID
    cy.findByRole("heading", { name: "Create your account" });
    cy.findByRole("textbox", { name: "Username (required)" }).type("alice");

    // wait for username validation to start, and complete
    cy.wait(50);
    cy.get("#field-username-output").should("have.value", "");
    cy.findByRole("button", { name: "Continue" }).click();

    // Synapse prompts us to grant permission to Element
    cy.findByRole("heading", { name: "Continue to your account" });
    cy.findByRole("link", { name: "Continue" }).click();
}
