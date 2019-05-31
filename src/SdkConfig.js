/*
Copyright 2016 OpenMarket Ltd

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

export const DEFAULTS = {
    // URL to a page we show in an iframe to configure integrations
    integrations_ui_url: "https://scalar.vector.im/",
    // Base URL to the REST interface of the integrations server
    integrations_rest_url: "https://scalar.vector.im/api",
    // Where to send bug reports. If not specified, bugs cannot be sent.
    bug_report_endpoint_url: null,
};

class SdkConfig {
    static get() {
        return global.mxReactSdkConfig || {};
    }

    static put(cfg) {
        const defaultKeys = Object.keys(DEFAULTS);
        for (let i = 0; i < defaultKeys.length; ++i) {
            if (cfg[defaultKeys[i]] === undefined) {
                cfg[defaultKeys[i]] = DEFAULTS[defaultKeys[i]];
            }
        }
        global.mxReactSdkConfig = cfg;
    }

    static unset() {
        global.mxReactSdkConfig = undefined;
    }

    static add(cfg) {
        const liveConfig = SdkConfig.get();
        const newConfig = Object.assign({}, liveConfig, cfg);
        SdkConfig.put(newConfig);
    }
}

module.exports = SdkConfig;
