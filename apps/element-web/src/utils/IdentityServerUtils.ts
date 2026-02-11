/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SERVICE_TYPES, HTTPError, type MatrixClient, type Terms } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import SdkConfig from "../SdkConfig";

export function getDefaultIdentityServerUrl(): string | undefined {
    return SdkConfig.get("validated_server_config")?.isUrl;
}

export function setToDefaultIdentityServer(matrixClient: MatrixClient): void {
    const url = getDefaultIdentityServerUrl();
    // Account data change will update localstorage, client, etc through dispatcher
    matrixClient.setAccountData("m.identity_server", {
        base_url: url ?? null,
    });
}

export async function doesIdentityServerHaveTerms(matrixClient: MatrixClient, fullUrl: string): Promise<boolean> {
    let terms: Partial<Terms> | null;
    try {
        terms = await matrixClient.getTerms(SERVICE_TYPES.IS, fullUrl);
    } catch (e) {
        logger.error(e);
        if (e instanceof HTTPError && e.httpStatus === 404) {
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
