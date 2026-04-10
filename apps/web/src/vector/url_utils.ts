/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type QueryDict } from "matrix-js-sdk/src/utils";

// We want to support some name / value pairs in the fragment
// so we're re-using query string like format
//
export function parseQsFromFragment(location: Location): { location: string; params?: URLSearchParams } {
    // if we have a fragment, it will start with '#', which we need to drop.
    // (if we don't, this will return '').
    const fragment = location.hash.substring(1);

    // our fragment may contain a query-param-like section. we need to fish
    // this out *before* URI-decoding because the params may contain ? and &
    // characters which are only URI-encoded once.
    const hashparts = fragment.split("?");

    const result = {
        location: decodeURIComponent(hashparts[0]),
        params: undefined as URLSearchParams | undefined,
    };

    if (hashparts.length > 1) {
        result.params = new URLSearchParams(hashparts[1]);
    }
    return result;
}

/**
 * Convert a URLSearchParams object to QueryDict
 * Any keys with multiple values will be grouped into an array
 * @param params the URLSearchParams to convert
 */
export function searchParamsToQueryDict(params: URLSearchParams): QueryDict {
    const queryDict: QueryDict = {};
    for (const key of params.keys()) {
        const val = params.getAll(key);
        queryDict[key] = val.length === 1 ? val[0] : val;
    }
    return queryDict;
}
