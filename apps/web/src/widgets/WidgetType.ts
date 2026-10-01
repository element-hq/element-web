/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// TODO: Move to matrix-widget-api
export class WidgetType {
    public static readonly JITSI = new WidgetType("m.jitsi", "jitsi");
    public static readonly STICKERPICKER = new WidgetType("m.stickerpicker", "m.stickerpicker");
    public static readonly INTEGRATION_MANAGER = new WidgetType("m.integration_manager", "m.integration_manager");
    public static readonly CUSTOM = new WidgetType("m.custom", "m.custom");
    public static readonly CALL = new WidgetType("m.call", "m.call");

    public constructor(
        public readonly preferred: string,
        public readonly legacy: string,
    ) {}

    public matches(type: string): boolean {
        return type === this.preferred || type === this.legacy;
    }

    public static fromString(type: string): WidgetType {
        // First try and match it against something we're already aware of
        const known = Object.values(WidgetType).filter((v) => v instanceof WidgetType);
        const knownMatch = known.find((w) => w.matches(type));
        if (knownMatch) return knownMatch;

        // If that fails, invent a new widget type
        return new WidgetType(type, type);
    }
}
