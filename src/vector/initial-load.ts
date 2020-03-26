/*
Copyright 2020 New Vector Ltd

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

import ElectronPlatform from './platform/ElectronPlatform';
import WebPlatform from './platform/WebPlatform';
import PlatformPeg from 'matrix-react-sdk/src/PlatformPeg';
import SdkConfig from "matrix-react-sdk/src/SdkConfig";

export function preparePlatform() {
    if ((<any>window).ipcRenderer) {
        console.log("Using Electron platform");
        const plaf = new ElectronPlatform();
        PlatformPeg.set(plaf);
    } else {
        console.log("Using Web platform");
        PlatformPeg.set(new WebPlatform());
    }
}

export async function loadConfig(): Promise<{configError?: Error, configSyntaxError: boolean}> {
    const platform = PlatformPeg.get();

    let configJson;
    let configError;
    let configSyntaxError = false;
    try {
        configJson = await platform.getConfig();
    } catch (e) {
        configError = e;

        if (e && e.err && e.err instanceof SyntaxError) {
            console.error("SyntaxError loading config:", e);
            configSyntaxError = true;
            configJson = {}; // to prevent errors between here and loading CSS for the error box
        }
    }

    // XXX: We call this twice, once here and once in MatrixChat as a prop. We call it here to ensure
    // granular settings are loaded correctly and to avoid duplicating the override logic for the theme.
    //
    // Note: this isn't called twice for some wrappers, like the Jitsi wrapper.
    SdkConfig.put(configJson);

    return {configError, configSyntaxError};
}
