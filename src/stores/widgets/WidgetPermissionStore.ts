/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Widget, WidgetKind } from "matrix-widget-api";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";
import { type SdkContextClass } from "../../contexts/SDKContext";

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

        let currentValues = SettingsStore.getValue("widgetOpenIDPermissions");
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
