/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { DispatcherApi as IDispatcherApi, DispatchToken, ActionPayload } from "@element-hq/element-web-module-api";
import type { MatrixDispatcher } from "../dispatcher/dispatcher";

/**
 * Implements a minimally exposed form of the MatrixDispatcher.
 */
export class DispatcherApi implements IDispatcherApi {
    public constructor(private readonly dispatcher: MatrixDispatcher) {

    }

    public register(callback: (payload: ActionPayload) => void): DispatchToken {
        return this.dispatcher.register(callback);
    };

    public unregister(id: DispatchToken): void {
        this.dispatcher.unregister(id);
    };
}
