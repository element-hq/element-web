/*
Copyright 2018, 2020 New Vector Ltd

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

import type { IConfigOptions } from "matrix-react-sdk/src/IConfigOptions";

// Load the config file. First try to load up a domain-specific config of the
// form "config.$domain.json" and if that fails, fall back to config.json.
export async function getVectorConfig(relativeLocation = ""): Promise<IConfigOptions | undefined> {
    if (relativeLocation !== "" && !relativeLocation.endsWith("/")) relativeLocation += "/";

    // Handle trailing dot FQDNs
    let domain = window.location.hostname.trimEnd();
    if (domain[domain.length - 1] === ".") {
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
    } catch (e) {
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
