/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SettingController from "./SettingController";

// Dev note: This whole class exists in the event someone logs out and back in - we want
// to make sure the right MatrixClient is listening for changes.

/**
 * Represents the base class for settings controllers which need access to a MatrixClient.
 * This class performs no logic and should be overridden.
 */
export default abstract class MatrixClientBackedController extends SettingController {
    private static _matrixClient?: MatrixClient;
    private static instances: MatrixClientBackedController[] = [];

    public static set matrixClient(client: MatrixClient) {
        const oldClient = MatrixClientBackedController._matrixClient;
        MatrixClientBackedController._matrixClient = client;

        for (const instance of MatrixClientBackedController.instances) {
            instance.initMatrixClient(client, oldClient);
        }
    }

    protected constructor() {
        super();

        MatrixClientBackedController.instances.push(this);
    }

    public get client(): MatrixClient | undefined {
        return MatrixClientBackedController._matrixClient;
    }

    protected abstract initMatrixClient(newClient: MatrixClient, oldClient?: MatrixClient): void;
}
