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

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        // secret undocumented options to Cypress.log
        interface LogConfig {
            /** begin a new log group; remember to match with `groupEnd` */
            groupStart: boolean;

            /** end a log group that was previously started with `groupStart` */
            groupEnd: boolean;

            /** suppress regular output: useful for closing a log group without writing another log line */
            emitOnly: boolean;
        }
    }
}

/** collapse the last open log group in the Cypress UI
 *
 * Credit to https://j1000.github.io/blog/2022/10/27/enhanced_cypress_logging.html
 */
export function collapseLastLogGroup() {
    const openExpanders = window.top.document.getElementsByClassName("command-expander-is-open");
    const numExpanders = openExpanders.length;
    const el = openExpanders[numExpanders - 1];
    if (el) el.parentElement.click();
}
