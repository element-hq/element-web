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

import mailhog from "mailhog";

import Chainable = Cypress.Chainable;
import { Instance } from "../plugins/mailhog";

export interface Mailhog {
    api: mailhog.API;
    instance: Instance;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            startMailhog(): Chainable<Mailhog>;
            stopMailhog(instance: Mailhog): Chainable<void>;
        }
    }
}

Cypress.Commands.add("startMailhog", (): Chainable<Mailhog> => {
    return cy.task<Instance>("mailhogStart", { log: false }).then((x) => {
        Cypress.log({ name: "startHomeserver", message: `Started mailhog instance ${x.containerId}` });
        return {
            api: mailhog({
                host: "localhost",
                port: x.httpPort,
            }),
            instance: x,
        };
    });
});

Cypress.Commands.add("stopMailhog", (mailhog: Mailhog): Chainable<void> => {
    return cy.task("mailhogStop", mailhog.instance.containerId);
});
