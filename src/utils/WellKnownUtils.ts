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

import { IClientWellKnown, MatrixClient } from "matrix-js-sdk/src/client";
import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";

const CALL_BEHAVIOUR_WK_KEY = "io.element.call_behaviour";
const E2EE_WK_KEY = "io.element.e2ee";
const E2EE_WK_KEY_DEPRECATED = "im.vector.riot.e2ee";
export const TILE_SERVER_WK_KEY = new UnstableValue("m.tile_server", "org.matrix.msc3488.tile_server");
const EMBEDDED_PAGES_WK_PROPERTY = "io.element.embedded_pages";

/* eslint-disable camelcase */
export interface ICallBehaviourWellKnown {
    widget_build_url?: string;
    ignore_dm?: boolean;
}

export interface IE2EEWellKnown {
    default?: boolean;
    secure_backup_required?: boolean;
    secure_backup_setup_methods?: SecureBackupSetupMethod[];
}

export interface ITileServerWellKnown {
    map_style_url?: string;
}

export interface IEmbeddedPagesWellKnown {
    home_url?: string;
}
/* eslint-enable camelcase */

export function getCallBehaviourWellKnown(matrixClient: MatrixClient): ICallBehaviourWellKnown {
    const clientWellKnown = matrixClient.getClientWellKnown();
    return clientWellKnown?.[CALL_BEHAVIOUR_WK_KEY];
}

export function getE2EEWellKnown(matrixClient: MatrixClient): IE2EEWellKnown | null {
    const clientWellKnown = matrixClient.getClientWellKnown();
    if (clientWellKnown?.[E2EE_WK_KEY]) {
        return clientWellKnown[E2EE_WK_KEY];
    }
    if (clientWellKnown?.[E2EE_WK_KEY_DEPRECATED]) {
        return clientWellKnown[E2EE_WK_KEY_DEPRECATED];
    }
    return null;
}

export function getTileServerWellKnown(matrixClient: MatrixClient): ITileServerWellKnown | undefined {
    return tileServerFromWellKnown(matrixClient.getClientWellKnown());
}

export function tileServerFromWellKnown(clientWellKnown?: IClientWellKnown | undefined): ITileServerWellKnown {
    return clientWellKnown?.[TILE_SERVER_WK_KEY.name] ?? clientWellKnown?.[TILE_SERVER_WK_KEY.altName];
}

export function getEmbeddedPagesWellKnown(matrixClient: MatrixClient | undefined): IEmbeddedPagesWellKnown | undefined {
    return embeddedPagesFromWellKnown(matrixClient?.getClientWellKnown());
}

export function embeddedPagesFromWellKnown(clientWellKnown?: IClientWellKnown): IEmbeddedPagesWellKnown {
    return clientWellKnown?.[EMBEDDED_PAGES_WK_PROPERTY];
}

export function isSecureBackupRequired(matrixClient: MatrixClient): boolean {
    return getE2EEWellKnown(matrixClient)?.["secure_backup_required"] === true;
}

export enum SecureBackupSetupMethod {
    Key = "key",
    Passphrase = "passphrase",
}

export function getSecureBackupSetupMethods(matrixClient: MatrixClient): SecureBackupSetupMethod[] {
    const wellKnown = getE2EEWellKnown(matrixClient);
    if (
        !wellKnown ||
        !wellKnown["secure_backup_setup_methods"] ||
        !wellKnown["secure_backup_setup_methods"].length ||
        !(
            wellKnown["secure_backup_setup_methods"].includes(SecureBackupSetupMethod.Key) ||
            wellKnown["secure_backup_setup_methods"].includes(SecureBackupSetupMethod.Passphrase)
        )
    ) {
        return [SecureBackupSetupMethod.Key, SecureBackupSetupMethod.Passphrase];
    }
    return wellKnown["secure_backup_setup_methods"];
}
