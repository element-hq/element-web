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

import {MatrixClientPeg} from '../MatrixClientPeg';

const E2EE_WK_KEY = "io.element.e2ee";
const E2EE_WK_KEY_DEPRECATED = "im.vector.riot.e2ee";

export interface IE2EEWellKnown {
    default?: boolean;
}

export function getE2EEWellKnown(): IE2EEWellKnown {
    const clientWellKnown = MatrixClientPeg.get().getClientWellKnown();
    if (clientWellKnown && clientWellKnown[E2EE_WK_KEY]) {
        return clientWellKnown[E2EE_WK_KEY];
    }
    if (clientWellKnown && clientWellKnown[E2EE_WK_KEY_DEPRECATED]) {
        return clientWellKnown[E2EE_WK_KEY_DEPRECATED]
    }
    return null;
}

export function isSecureBackupRequired(): boolean {
    const wellKnown = getE2EEWellKnown();
    return wellKnown && wellKnown["secure_backup_required"] === true;
}
