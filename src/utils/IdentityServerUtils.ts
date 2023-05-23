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

import { SERVICE_TYPES } from "matrix-js-sdk/src/service-types";
import { logger } from "matrix-js-sdk/src/logger";
import { HTTPError } from "matrix-js-sdk/src/http-api";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../SdkConfig";
import { Policies } from "../Terms";

export function getDefaultIdentityServerUrl(): string | undefined {
    return SdkConfig.get("validated_server_config")?.isUrl;
}

export function setToDefaultIdentityServer(matrixClient: MatrixClient): void {
    const url = getDefaultIdentityServerUrl();
    // Account data change will update localstorage, client, etc through dispatcher
    matrixClient.setAccountData("m.identity_server", {
        base_url: url,
    });
}

export async function doesIdentityServerHaveTerms(matrixClient: MatrixClient, fullUrl: string): Promise<boolean> {
    let terms: { policies?: Policies } | null;
    try {
        terms = await matrixClient.getTerms(SERVICE_TYPES.IS, fullUrl);
    } catch (e) {
        logger.error(e);
        if (e.cors === "rejected" || (e instanceof HTTPError && e.httpStatus === 404)) {
            terms = null;
        } else {
            throw e;
        }
    }

    return !!terms?.["policies"] && Object.keys(terms["policies"]).length > 0;
}

export function doesAccountDataHaveIdentityServer(matrixClient: MatrixClient): boolean {
    const event = matrixClient.getAccountData("m.identity_server");
    return event?.getContent()["base_url"];
}
