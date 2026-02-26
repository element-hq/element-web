/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { IConfigOptions } from "../IConfigOptions";

// Load the config file. First try to load up a domain-specific config of the
// form "config.$domain.json" and if that fails, fall back to config.json.
export async function getVectorConfig(relativeLocation = ""): Promise<IConfigOptions | undefined> {
    if (relativeLocation !== "" && !relativeLocation.endsWith("/")) relativeLocation += "/";

    // Handle trailing dot FQDNs
    let domain = window.location.hostname.trimEnd();
    if (domain.endsWith(".")) {
        domain = domain.slice(0, -1);
    }

    const specificConfigPromise = getConfig(`${relativeLocation}config.${domain}.json`);
    const generalConfigPromise = getConfig(relativeLocation + "config.json");

    try {
        const configJson = await specificConfigPromise;
        // 404s succeed with an empty json config, so check that there are keys
        if (!configJson || Object.keys(configJson).length === 0) {
            throw new Error(); // throw to enter the catch
        }
        return configJson;
    } catch {
        return generalConfigPromise;
    }
}

async function getConfig(configJsonFilename: string): Promise<IConfigOptions | undefined> {
    const url = new URL(configJsonFilename, window.location.href);
    url.searchParams.set("cachebuster", Date.now().toString());
    const res = await fetch(url, {
        cache: "no-cache",
        method: "GET",
    });

    if (res.status === 404 || res.status === 0) {
        // Lack of a config isn't an error, we should just use the defaults.
        // Also treat a blank config as no config, assuming the status code is 0, because we don't get 404s from file:
        // URIs so this is the only way we can not fail if the file doesn't exist when loading from a file:// URI.
        return {} as IConfigOptions;
    }

    if (res.ok) {
        return res.json();
    }
}
