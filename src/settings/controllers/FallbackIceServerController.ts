/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, type IClientWellKnown, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { type SettingLevel } from "../SettingLevel";
import SettingsStore from "../SettingsStore.ts";
import MatrixClientBackedController from "./MatrixClientBackedController.ts";

/**
 * Settings controller for the fallback ICE server setting.
 * This setting may be forcibly disabled by well-known value ["io.element.voip"]["disable_fallback_ice"].
 * This controller will update the MatrixClient's knowledge when the setting is changed.
 */
export default class FallbackIceServerController extends MatrixClientBackedController {
    private disabled = false;

    public constructor() {
        super();
    }

    private checkWellKnown = (wellKnown: IClientWellKnown): void => {
        this.disabled = !!wellKnown["io.element.voip"]?.["disable_fallback_ice"];
    };

    protected async initMatrixClient(newClient: MatrixClient, oldClient?: MatrixClient): Promise<void> {
        oldClient?.off(ClientEvent.ClientWellKnown, this.checkWellKnown);
        newClient.on(ClientEvent.ClientWellKnown, this.checkWellKnown);
        const wellKnown = newClient.getClientWellKnown();
        if (wellKnown) this.checkWellKnown(wellKnown);
    }

    public getValueOverride(): any {
        if (this.disabled) {
            return false;
        }

        return null; // no override
    }

    public get settingDisabled(): boolean | string {
        return this.disabled;
    }

    public onChange(_level: SettingLevel, _roomId: string | null, _newValue: any): void {
        this.client?.setFallbackICEServerAllowed(!!SettingsStore.getValue("fallbackICEServerAllowed"));
    }
}
