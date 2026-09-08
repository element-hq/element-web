/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Opaque token to track a registered callback.
 * @alpha Unlikely to change.
 */
export type DispatchToken = string;

/**
 * The base dispatch type, containing an `action` and
 * a freeform set of properties.
 * @alpha This payload format may change at any point.
 */
export interface ActionPayload {
    action: string;
    [property: string]: any; // effectively makes this 'extends Object'
}

/**
 * A dispatcher for ActionPayloads, which allows modules to listen
 * for application events.
 * @alpha Likely to change.
 */
export interface DispatcherApi {
    /**
     * Registers a callback to be invoked with every dispatched payload.
     *
     * @param callback A callback to call each time an an action is fired.
     * @returns A token that may be used with `unregister`.
     * @alpha Unlikely to change.
     */
    register(callback: (payload: ActionPayload) => void): DispatchToken;

    /**
     * Unregister a callback.
     *
     * @param id Dispatch token from calling `register`.
     * @alpha Unlikely to change.
     */
    unregister(id: DispatchToken): void;
}
