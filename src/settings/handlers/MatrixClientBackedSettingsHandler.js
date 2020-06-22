/*
Copyright 2019 New Vector Ltd.

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

import SettingsHandler from "./SettingsHandler";

// Dev note: This whole class exists in the event someone logs out and back in - we want
// to make sure the right MatrixClient is listening for changes.

/**
 * Represents the base class for settings handlers which need access to a MatrixClient.
 * This class performs no logic and should be overridden.
 */
export default class MatrixClientBackedSettingsHandler extends SettingsHandler {
    static _matrixClient;
    static _instances = [];

    static set matrixClient(client) {
        const oldClient = MatrixClientBackedSettingsHandler._matrixClient;
        MatrixClientBackedSettingsHandler._matrixClient = client;

        for (const instance of MatrixClientBackedSettingsHandler._instances) {
            instance.initMatrixClient(oldClient, client);
        }
    }

    constructor() {
        super();

        MatrixClientBackedSettingsHandler._instances.push(this);
    }

    get client() {
        return MatrixClientBackedSettingsHandler._matrixClient;
    }

    initMatrixClient() {
        console.warn("initMatrixClient not overridden");
    }
}
