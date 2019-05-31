/*
Copyright 2019 New Vector Ltd

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

import {AutoDiscovery} from "matrix-js-sdk";
import {_td, newTranslatableError} from "../languageHandler";
import {makeType} from "./TypeUtils";
import SdkConfig from "../SdkConfig";

export class ValidatedServerConfig {
    hsUrl: string;
    hsName: string;
    hsNameIsDifferent: string;

    isUrl: string;
    identityEnabled: boolean;

    isDefault: boolean;
}

export default class AutoDiscoveryUtils {
    static async validateServerConfigWithStaticUrls(homeserverUrl: string, identityUrl: string): ValidatedServerConfig {
        if (!homeserverUrl) {
            throw newTranslatableError(_td("No homeserver URL provided"));
        }

        const wellknownConfig = {
            "m.homeserver": {
                base_url: homeserverUrl,
            },
            "m.identity_server": {
                base_url: identityUrl,
            },
        };

        const result = await AutoDiscovery.fromDiscoveryConfig(wellknownConfig);

        const url = new URL(homeserverUrl);
        const serverName = url.hostname;

        return AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, result);
    }

    static async validateServerName(serverName: string): ValidatedServerConfig {
        const result = await AutoDiscovery.findClientConfig(serverName);
        return AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, result);
    }

    static buildValidatedConfigFromDiscovery(serverName: string, discoveryResult): ValidatedServerConfig {
        if (!discoveryResult || !discoveryResult["m.homeserver"]) {
            // This shouldn't happen without major misconfiguration, so we'll log a bit of information
            // in the log so we can find this bit of codee but otherwise tell teh user "it broke".
            console.error("Ended up in a state of not knowing which homeserver to connect to.");
            throw newTranslatableError(_td("Unexpected error resolving homeserver configuration"));
        }

        const hsResult = discoveryResult['m.homeserver'];
        if (hsResult.state !== AutoDiscovery.SUCCESS) {
            if (AutoDiscovery.ALL_ERRORS.indexOf(hsResult.error) !== -1) {
                throw newTranslatableError(hsResult.error);
            }
            throw newTranslatableError(_td("Unexpected error resolving homeserver configuration"));
        }

        const isResult = discoveryResult['m.identity_server'];
        let preferredIdentityUrl = "https://vector.im";
        if (isResult && isResult.state === AutoDiscovery.SUCCESS) {
            preferredIdentityUrl = isResult["base_url"];
        } else if (isResult && isResult.state !== AutoDiscovery.PROMPT) {
            console.error("Error determining preferred identity server URL:", isResult);
            throw newTranslatableError(_td("Unexpected error resolving homeserver configuration"));
        }

        const preferredHomeserverUrl = hsResult["base_url"];
        let preferredHomeserverName = serverName ? serverName : hsResult["server_name"];

        const url = new URL(preferredHomeserverUrl);
        if (!preferredHomeserverName) preferredHomeserverName = url.hostname;

        // It should have been set by now, so check it
        if (!preferredHomeserverName) {
            console.error("Failed to parse homeserver name from homeserver URL");
            throw newTranslatableError(_td("Unexpected error resolving homeserver configuration"));
        }

        return makeType(ValidatedServerConfig, {
            hsUrl: preferredHomeserverUrl,
            hsName: preferredHomeserverName,
            hsNameIsDifferent: url.hostname !== preferredHomeserverName,
            isUrl: preferredIdentityUrl,
            identityEnabled: !SdkConfig.get()['disable_identity_server'],
            isDefault: false,
        });
    }
}
