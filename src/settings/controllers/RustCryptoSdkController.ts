/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { _t } from "../../languageHandler";
import SettingsStore from "../SettingsStore";
import { SettingLevel } from "../SettingLevel";
import PlatformPeg from "../../PlatformPeg";
import SettingController from "./SettingController";
import { Features } from "../Settings";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import SdkConfig from "../../SdkConfig";

export default class RustCryptoSdkController extends SettingController {
    public onChange(level: SettingLevel, roomId: string | null, newValue: any): void {
        // If the crypto stack has already been initialized, we'll need to reload the app to make it take effect.
        if (MatrixClientPeg.get()?.getCrypto()) {
            PlatformPeg.get()?.reload();
        }
    }

    public get settingDisabled(): boolean | string {
        if (!SettingsStore.getValueAt(SettingLevel.DEVICE, Features.RustCrypto)) {
            // If rust crypto has not yet been enabled for this device, you can turn it on, IF YOU DARE
            return false;
        }

        if (SettingsStore.getValueAt(SettingLevel.CONFIG, Features.RustCrypto)) {
            // It's enabled in the config, so you can't get rid of it even by logging out.
            return _t("labs|rust_crypto_in_config", { brand: SdkConfig.get().brand });
        }

        // The setting is enabled at the device level, but not mandated at the config level.
        // You can only turn it off by logging out and in again.
        return _t("labs|rust_crypto_requires_logout");
    }
}
