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

import { MatrixClient } from "matrix-js-sdk/src/client";
import { AsyncStore } from "./AsyncStore";
import { ActionPayload } from "../dispatcher/payloads";


export abstract class AsyncStoreWithClient<T extends Object> extends AsyncStore<T> {
    protected matrixClient: MatrixClient;

    protected abstract async onAction(payload: ActionPayload);

    protected async onReady() {
        // Default implementation is to do nothing.
    }

    protected async onNotReady() {
        // Default implementation is to do nothing.
    }

    protected async onDispatch(payload: ActionPayload) {
        await this.onAction(payload);

        if (payload.action === 'MatrixActions.sync') {
            // Filter out anything that isn't the first PREPARED sync.
            if (!(payload.prevState === 'PREPARED' && payload.state !== 'PREPARED')) {
                return;
            }

            this.matrixClient = payload.matrixClient;
            await this.onReady();
        } else if (payload.action === 'on_client_not_viable' || payload.action === 'on_logged_out') {
            if (this.matrixClient) {
                await this.onNotReady();
                this.matrixClient = null;
            }
        }
    }
}
