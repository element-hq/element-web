/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IThreepid, type ThreepidMedium, type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";

import IdentityAuthClient from "./IdentityAuthClient";

export async function getThreepidsWithBindStatus(
    client: MatrixClient,
    filterMedium?: ThreepidMedium,
): Promise<IThreepid[]> {
    const userId = client.getUserId();

    let { threepids } = await client.getThreePids();
    if (filterMedium) {
        threepids = threepids.filter((a) => a.medium === filterMedium);
    }

    // Check bind status assuming we have an IS and terms are agreed
    if (threepids.length > 0 && !!client.getIdentityServerUrl()) {
        try {
            const authClient = new IdentityAuthClient();
            const identityAccessToken = await authClient.getAccessToken({ check: false });
            if (!identityAccessToken) {
                throw new Error("No identity access token found");
            }

            // Restructure for lookup query
            const query = threepids.map(({ medium, address }): [string, string] => [medium, address]);
            const lookupResults = await client.bulkLookupThreePids(query, identityAccessToken);

            // Record which are already bound
            for (const [medium, address, mxid] of lookupResults.threepids) {
                if (mxid !== userId) {
                    continue;
                }
                if (filterMedium && medium !== filterMedium) {
                    continue;
                }
                const threepid = threepids.find((e) => e.medium === medium && e.address === address);
                if (!threepid) continue;
                threepid.bound = true;
            }
        } catch (e) {
            // Ignore terms errors here and assume other flows handle this
            if (!(e instanceof MatrixError) || e.errcode !== "M_TERMS_NOT_SIGNED") {
                throw e;
            }
        }
    }

    return threepids;
}
