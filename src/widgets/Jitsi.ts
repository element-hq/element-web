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

const JITSI_WK_PROPERTY = "im.vector.riot.jitsi";

export interface JitsiWidgetData {
    conferenceId: string;
    isAudioOnly: boolean;
    domain: string;
}

export class Jitsi {
    private static instance: Jitsi;

    private domain: string;

    public get preferredDomain(): string {
        return this.domain || 'jitsi.riot.im';
    }

    /**
     * Checks for auth needed by looking up a well-known file
     *
     * If the file does not exist, we assume no auth.
     *
     * See https://github.com/matrix-org/prosody-mod-auth-matrix-user-verification
     */
    public async getJitsiAuth(): Promise<string|null> {
        if (!this.preferredDomain) {
            return null;
        }
        let data;
        try {
            const response = await fetch(`https://${this.preferredDomain}/.well-known/element/jitsi`);
            data = await response.json();
        } catch (error) {
            return null;
        }
        if (data.auth) {
            return data.auth;
        }
        return null;
    }

    public start() {
        const cli = MatrixClientPeg.get();
        cli.on("WellKnown.client", this.update);
        // call update initially in case we missed the first WellKnown.client event and for if no well-known present
        this.update(cli.getClientWellKnown());
    }

    private update = async (discoveryResponse): Promise<any> => {
        // Start with a default of the config's domain
        let domain = (SdkConfig.get()['jitsi'] || {})['preferredDomain'] || 'jitsi.riot.im';

        console.log("Attempting to get Jitsi conference information from homeserver");
        if (discoveryResponse && discoveryResponse[JITSI_WK_PROPERTY]) {
            const wkPreferredDomain = discoveryResponse[JITSI_WK_PROPERTY]['preferredDomain'];
            if (wkPreferredDomain) domain = wkPreferredDomain;
        }

        // Put the result into memory for us to use later
        this.domain = domain;
        console.log("Jitsi conference domain:", this.preferredDomain);
    };

    /**
     * Parses the given URL into the data needed for a Jitsi widget, if the widget
     * URL matches the preferredDomain for the app.
     * @param {string} url The URL to parse.
     * @returns {JitsiWidgetData} The widget data if eligible, otherwise null.
     */
    public parsePreferredConferenceUrl(url: string): JitsiWidgetData {
        const parsed = new URL(url);
        if (parsed.hostname !== this.preferredDomain) return null; // invalid
        return {
            conferenceId: parsed.pathname,
            domain: parsed.hostname,
            isAudioOnly: false,
        };
    }

    public static getInstance(): Jitsi {
        if (!Jitsi.instance) {
            Jitsi.instance = new Jitsi();
        }
        return Jitsi.instance;
    }
}
