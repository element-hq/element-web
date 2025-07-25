/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type AccountAuthInfo } from "@element-hq/element-web-module-api";
import { sleep } from "matrix-js-sdk/src/utils";

import type { OverwriteLoginPayload } from "../dispatcher/payloads/OverwriteLoginPayload.ts";
import { Action } from "../dispatcher/actions.ts";
import defaultDispatcher from "../dispatcher/dispatcher.ts";
import type { ActionPayload } from "../dispatcher/payloads.ts";

export async function overwriteAccountAuth(accountInfo: AccountAuthInfo): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();

    const onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.OnLoggedIn) {
            // We want to wait for the new login to complete before returning.
            // See `Action.OnLoggedIn` in dispatcher.
            resolve();
        }
    };
    const dispatcherRef = defaultDispatcher.register(onAction);

    defaultDispatcher.dispatch<OverwriteLoginPayload>(
        {
            action: Action.OverwriteLogin,
            credentials: {
                ...accountInfo,
                guest: false,
            },
        },
        true,
    ); // require to be sync to match inherited interface behaviour

    // wait for login to complete
    await promise;
    defaultDispatcher.unregister(dispatcherRef);
    await sleep(0); // wait for the next tick to ensure the login is fully processed
}
