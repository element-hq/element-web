/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import IdentityAuthClient from './IdentityAuthClient';

export async function getThreepidsWithBindStatus(client, filterMedium) {
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

            // Restructure for lookup query
            const query = threepids.map(({ medium, address }) => [medium, address]);
            const lookupResults = await client.bulkLookupThreePids(query, identityAccessToken);

            // Record which are already bound
            for (const [medium, address, mxid] of lookupResults.threepids) {
                if (mxid !== userId) {
                    continue;
                }
                if (filterMedium && medium !== filterMedium) {
                    continue;
                }
                const threepid = threepids.find(e => e.medium === medium && e.address === address);
                if (!threepid) continue;
                threepid.bound = true;
            }
        } catch (e) {
            // Ignore terms errors here and assume other flows handle this
            if (!(e.errcode === "M_TERMS_NOT_SIGNED")) {
                throw e;
            }
        }
    }

    return threepids;
}
