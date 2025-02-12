/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IClientWellKnown, type MatrixClient } from "matrix-js-sdk/src/matrix";
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
    /**
     * Forces the encryption to disabled for all new rooms
     * When true, overrides configured 'default' behaviour
     * Hides the option to enable encryption on room creation
     * Disables the option to enable encryption in room settings for all new and existing rooms
     */
    force_disable?: boolean;
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
