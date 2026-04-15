/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type QueryDict } from "matrix-js-sdk/src/utils";

// We want to support some name / value pairs in the fragment
// so we're re-using query string like format, where we accept a `?key=value&key2=value2` string at the end of the hash
// but we also accept a hash like `key=value&key2=value2` for compatibility with oAuth response_mode = fragment
export function parseQsFromFragment(url: Location | URL): { location: string; params?: URLSearchParams } {
    // if we have a fragment, it will start with '#', which we need to drop.
    // (if we don't, this will return '').
    const fragment = url.hash.substring(1);

    // our fragment may contain a query-param-like section. we need to fish
    // this out *before* URI-decoding because the params may contain ? and &
    // characters which are only URI-encoded once.
    const [main, query] = fragment.split("?", 2);

    // Handle oAuth-style fragment parameters
    if (main.includes("=")) {
        return {
            location: "",
            params: new URLSearchParams(main),
        };
    }

    return {
        location: decodeURIComponent(main),
        params: query ? new URLSearchParams(query) : undefined,
    };
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

const urlParameterConfig = {
    // Query string params for legacy SSO login, added by the Matrix homeserver
    legacy_sso: {
        keys: ["loginToken"],
        location: "query",
    },
    // Fragment params for OIDC login, added by the Identity Provider
    oidc: {
        keys: ["code", "state"],
        location: "fragment",
    },
    // Fragment params relating to 3pid (email) invites, added in url within the invite email itself
    threepid: {
        keys: ["client_secret", "session_id", "hs_url", "is_url", "sid"],
        location: "fragment",
    },
    // XXX: unclear where, if anywhere, this is set
    defaults: {
        keys: ["defaultUsername"],
        location: "fragment",
    },
    // XXX: Fragment params seemingly relating to 3pid invites, though the code in the area doubts they are ever specified
    guest: {
        keys: ["guest_user_id", "guest_access_token"],
        location: "fragment",
    },
} as const satisfies Record<
    string,
    {
        keys: string[];
        // Query params live in the query string, in the middle of the URL, after a `?`, in a `key=value` format, delimited by `&`.
        // Fragment params live in the fragment string, at the end of the URL, after a `?`, in a `key=value` format, delimited by `&`.
        location: "query" | "fragment";
    }
>;

export type URLParams = Partial<{
    -readonly [K in keyof typeof urlParameterConfig]: Partial<{
        [P in (typeof urlParameterConfig)[K]["keys"][number]]: string;
    }>;
}>;

/**
 * Utility to parse parameters held in the app's URL.
 * Currently focusing only on at-load URL parameters.
 * @param url - the URL to parse.
 * @return an object keyed by the groups defined in {@link urlParameterConfig} with values for each key listed,
 *     sourced from the location (query/fragment/either) specified. If no parameters in a group are found the entire group
 *     will be omitted from the returned object to simplify presence checking.
 */
export function parseAppUrl(url: Location | URL): {
    location: string;
    params: URLParams;
} {
    const queryParams = new URLSearchParams(url.search);
    const parsedFragment = parseQsFromFragment(url);

    const urlParams: Partial<URLParams> = {};

    for (const group in urlParameterConfig) {
        const groupKey = group as keyof URLParams;
        const groupConfig = urlParameterConfig[groupKey];

        const params = groupConfig.location === "fragment" ? parsedFragment.params : queryParams;
        if (!params) continue; // no params

        const target: Record<string, string> = {};
        for (const k of groupConfig.keys) {
            const key = k as (typeof groupConfig)["keys"][number];

            const value = params.get(key);
            if (value !== null) {
                target[key] = value;
            }
        }

        if (Object.keys(target).length > 0) {
            urlParams[groupKey] = target;
        }
    }

    return { params: urlParams as URLParams, location: parsedFragment.location };
}
