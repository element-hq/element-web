/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as projectNameGenerator from "project-name-generator";

/**
 * Generates a human readable identifier. This should not be used for anything
 * which needs secure/cryptographic random: just a level uniquness that is offered
 * by something like Date.now().
 * @returns {string} The randomly generated ID
 */
export function generateHumanReadableId(): string {
    return projectNameGenerator({words: 3}).raw.map(w => {
        return w[0].toUpperCase() + w.substring(1).toLowerCase();
    }).join('');
}
