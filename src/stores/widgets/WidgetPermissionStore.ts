/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import SettingsStore from "../../settings/SettingsStore";
import { Widget, WidgetKind } from "matrix-widget-api";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { SettingLevel } from "../../settings/SettingLevel";

export enum OIDCState {
    Allowed, // user has set the remembered value as allowed
    Denied, // user has set the remembered value as disallowed
    Unknown, // user has not set a remembered value
}

export class WidgetPermissionStore {
    private static internalInstance: WidgetPermissionStore;

    private constructor() {
    }

    public static get instance(): WidgetPermissionStore {
        if (!WidgetPermissionStore.internalInstance) {
            WidgetPermissionStore.internalInstance = new WidgetPermissionStore();
        }
        return WidgetPermissionStore.internalInstance;
    }

    // TODO (all functions here): Merge widgetKind with the widget definition

    private packSettingKey(widget: Widget, kind: WidgetKind, roomId?: string): string {
        let location = roomId;
        if (kind !== WidgetKind.Room) {
            location = MatrixClientPeg.get().getUserId();
        }
        if (kind === WidgetKind.Modal) {
            location = '*MODAL*-' + location; // to guarantee differentiation from whatever spawned it
        }
        if (!location) {
            throw new Error("Failed to determine a location to check the widget's OIDC state with");
        }

        return encodeURIComponent(`${location}::${widget.templateUrl}`);
    }

    public getOIDCState(widget: Widget, kind: WidgetKind, roomId?: string): OIDCState {
        const settingsKey = this.packSettingKey(widget, kind, roomId);
        const settings = SettingsStore.getValue("widgetOpenIDPermissions");
        if (settings?.deny?.includes(settingsKey)) {
            return OIDCState.Denied;
        }
        if (settings?.allow?.includes(settingsKey)) {
            return OIDCState.Allowed;
        }
        return OIDCState.Unknown;
    }

    public setOIDCState(widget: Widget, kind: WidgetKind, roomId: string, newState: OIDCState) {
        const settingsKey = this.packSettingKey(widget, kind, roomId);

        const currentValues = SettingsStore.getValue("widgetOpenIDPermissions");
        if (!currentValues.allow) currentValues.allow = [];
        if (!currentValues.deny) currentValues.deny = [];

        if (newState === OIDCState.Allowed) {
            currentValues.allow.push(settingsKey);
        } else if (newState === OIDCState.Denied) {
            currentValues.deny.push(settingsKey);
        } else {
            currentValues.allow = currentValues.allow.filter(c => c !== settingsKey);
            currentValues.deny = currentValues.deny.filter(c => c !== settingsKey);
        }

        SettingsStore.setValue("widgetOpenIDPermissions", null, SettingLevel.DEVICE, currentValues);
    }
}
