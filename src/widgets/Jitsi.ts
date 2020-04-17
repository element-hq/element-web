/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import SdkConfig from "../SdkConfig";
import {MatrixClientPeg} from "../MatrixClientPeg";
import {AutoDiscovery} from "matrix-js-sdk/src/autodiscovery";

const JITSI_WK_PROPERTY = "im.vector.riot.jitsi";
const JITSI_WK_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours, arbitrarily selected

export class Jitsi {
    private static instance: Jitsi;

    private domain: string;

    public get preferredDomain(): string {
        return this.domain || 'jitsi.riot.im';
    }

    constructor() {
        // We rely on the first call to be an .update() instead of doing one here. Doing one
        // here could result in duplicate calls to the homeserver.

        // Start a timer to update the server info regularly
        setInterval(() => this.update(), JITSI_WK_CHECK_INTERVAL);
    }

    public async update(): Promise<any> {
        // Start with a default of the config's domain
        let domain = (SdkConfig.get()['jitsi'] || {})['preferredDomain'] || 'jitsi.riot.im';

        // Now request the .well-known config to see if it changed
        if (MatrixClientPeg.get()) {
            try {
                console.log("Attempting to get Jitsi conference information from homeserver");

                const homeserverDomain = MatrixClientPeg.getHomeserverName();
                const discoveryResponse = await AutoDiscovery.getRawClientConfig(homeserverDomain);
                if (discoveryResponse && discoveryResponse[JITSI_WK_PROPERTY]) {
                    const wkPreferredDomain = discoveryResponse[JITSI_WK_PROPERTY]['preferredDomain'];
                    if (wkPreferredDomain) domain = wkPreferredDomain;
                }
            } catch (e) {
                // These are non-fatal errors
                console.error(e);
            }
        }

        // Put the result into memory for us to use later
        this.domain = domain;
        console.log("Jitsi conference domain:", this.preferredDomain);
    }

    public static getInstance(): Jitsi {
        if (!Jitsi.instance) {
            Jitsi.instance = new Jitsi();
        }
        return Jitsi.instance;
    }
}
