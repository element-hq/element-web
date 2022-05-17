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
             * Start measuring the duration of some task.
             * @param task The task name.
             */
            startMeasuring(task: string): Chainable<AUTWindow>;
            /**
             * Stop measuring the duration of some task.
             * The duration is reported in the Cypress log.
             * @param task The task name.
             */
            stopMeasuring(task: string): Chainable<AUTWindow>;
        }
    }
}

function getPrefix(task: string): string {
    return `cy:${Cypress.spec.name.split(".")[0]}:${task}`;
}

function startMeasuring(task: string): Chainable<AUTWindow> {
    return cy.window({ log: false }).then((win) => {
        win.mxPerformanceMonitor.start(getPrefix(task));
    });
}

function stopMeasuring(task: string): Chainable<AUTWindow> {
    return cy.window({ log: false }).then((win) => {
        const measure = win.mxPerformanceMonitor.stop(getPrefix(task));
        cy.log(`**${task}** ${measure.duration} ms`);
    });
}

Cypress.Commands.add("startMeasuring", startMeasuring);
Cypress.Commands.add("stopMeasuring", stopMeasuring);

Cypress.on("window:before:unload", (event: BeforeUnloadEvent) => {
    const doc = event.target as Document;
    if (doc.location.href === "about:blank") return;
    const win = doc.defaultView as AUTWindow;
    if (!win.mxPerformanceMonitor) return;
    const entries = win.mxPerformanceMonitor.getEntries().filter(entry => {
        return entry.name.startsWith("cy:");
    });
    if (!entries || entries.length === 0) return;
    cy.task("addMeasurements", entries);
});

// Needed to make this file a module
export { };
