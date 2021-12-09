/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import { SERVICE_TYPES } from 'matrix-js-sdk/src/service-types';
import { logger } from "matrix-js-sdk/src/logger";

import SdkConfig from '../SdkConfig';
import { MatrixClientPeg } from '../MatrixClientPeg';

export function getDefaultIdentityServerUrl(): string {
    return SdkConfig.get()['validated_server_config']['isUrl'];
}

export function useDefaultIdentityServer(): void {
    const url = getDefaultIdentityServerUrl();
    // Account data change will update localstorage, client, etc through dispatcher
    MatrixClientPeg.get().setAccountData("m.identity_server", {
        base_url: url,
    });
}

export async function doesIdentityServerHaveTerms(fullUrl: string): Promise<boolean> {
    let terms;
    try {
        terms = await MatrixClientPeg.get().getTerms(SERVICE_TYPES.IS, fullUrl);
    } catch (e) {
        logger.error(e);
        if (e.cors === "rejected" || e.httpStatus === 404) {
            terms = null;
        } else {
            throw e;
        }
    }

    return terms && terms["policies"] && (Object.keys(terms["policies"]).length > 0);
}

export function doesAccountDataHaveIdentityServer(): boolean {
    const event = MatrixClientPeg.get().getAccountData("m.identity_server");
    return event && event.getContent() && event.getContent()['base_url'];
}
