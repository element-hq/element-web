/*
Copyright 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

export interface ConfigOptions {
    [key: string]: any;
}

export const DEFAULTS: ConfigOptions = {
    // Brand name of the app
    brand: "Element",
    // URL to a page we show in an iframe to configure integrations
    integrations_ui_url: "https://scalar.vector.im/",
    // Base URL to the REST interface of the integrations server
    integrations_rest_url: "https://scalar.vector.im/api",
    // Where to send bug reports. If not specified, bugs cannot be sent.
    bug_report_endpoint_url: null,
    // Jitsi conference options
    jitsi: {
        // Default conference domain
        preferredDomain: "jitsi.riot.im",
    },
};

export default class SdkConfig {
    private static instance: ConfigOptions;

    private static setInstance(i: ConfigOptions) {
        SdkConfig.instance = i;

        // For debugging purposes
        (<any>window).mxReactSdkConfig = i;
    }

    static get() {
        return SdkConfig.instance || {};
    }

    static put(cfg: ConfigOptions) {
        const defaultKeys = Object.keys(DEFAULTS);
        for (let i = 0; i < defaultKeys.length; ++i) {
            if (cfg[defaultKeys[i]] === undefined) {
                cfg[defaultKeys[i]] = DEFAULTS[defaultKeys[i]];
            }
        }
        SdkConfig.setInstance(cfg);
    }

    static unset() {
        SdkConfig.setInstance({});
    }

    static add(cfg: ConfigOptions) {
        const liveConfig = SdkConfig.get();
        const newConfig = Object.assign({}, liveConfig, cfg);
        SdkConfig.put(newConfig);
    }
}
