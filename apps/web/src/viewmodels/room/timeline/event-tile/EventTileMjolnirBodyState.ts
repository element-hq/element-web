/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

/** Gets the application storage key used to remember that an event may be shown. */
export function getMjolnirBodyStorageKey(mxEvent: MatrixEvent): string {
    return `mx_mjolnir_render_${mxEvent.getRoomId()}__${mxEvent.getId()}`;
}

/** Allows a Mjolnir-hidden event to be shown and notifies the owning tile. */
export function allowMjolnirBody(mxEvent: MatrixEvent, onMessageAllowed?: () => void): void {
    localStorage.setItem(getMjolnirBodyStorageKey(mxEvent), "true");
    onMessageAllowed?.();
}
