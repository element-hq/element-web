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

import { Widget, WidgetKind } from "matrix-widget-api";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";
import { SdkContextClass } from "../../contexts/SDKContext";

export enum OIDCState {
    Allowed, // user has set the remembered value as allowed
    Denied, // user has set the remembered value as disallowed
    Unknown, // user has not set a remembered value
}

export class WidgetPermissionStore {
    public constructor(private readonly context: SdkContextClass) {}

    // TODO (all functions here): Merge widgetKind with the widget definition

    private packSettingKey(widget: Widget, kind: WidgetKind, roomId?: string): string {
        let location: string | null | undefined = roomId;
        if (kind !== WidgetKind.Room) {
            location = this.context.client?.getUserId();
        }
        if (kind === WidgetKind.Modal) {
            location = "*MODAL*-" + location; // to guarantee differentiation from whatever spawned it
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

    public setOIDCState(widget: Widget, kind: WidgetKind, roomId: string | undefined, newState: OIDCState): void {
        const settingsKey = this.packSettingKey(widget, kind, roomId);

        let currentValues = SettingsStore.getValue<{
            allow?: string[];
            deny?: string[];
        }>("widgetOpenIDPermissions");
        if (!currentValues) {
            currentValues = {};
        }
        if (!currentValues.allow) currentValues.allow = [];
        if (!currentValues.deny) currentValues.deny = [];

        if (newState === OIDCState.Allowed) {
            currentValues.allow.push(settingsKey);
        } else if (newState === OIDCState.Denied) {
            currentValues.deny.push(settingsKey);
        } else {
            currentValues.allow = currentValues.allow.filter((c) => c !== settingsKey);
            currentValues.deny = currentValues.deny.filter((c) => c !== settingsKey);
        }

        SettingsStore.setValue("widgetOpenIDPermissions", null, SettingLevel.DEVICE, currentValues);
    }
}
