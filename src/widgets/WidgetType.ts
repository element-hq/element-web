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

export class WidgetType {
    public static readonly JITSI = new WidgetType("m.jitsi", "jitsi");
    public static readonly STICKERPICKER = new WidgetType("m.stickerpicker", "m.stickerpicker");
    public static readonly INTEGRATION_MANAGER = new WidgetType("m.integration_manager", "m.integration_manager");
    public static readonly CUSTOM = new WidgetType("m.custom", "m.custom");

    constructor(public readonly preferred: string, public readonly legacy: string) {
    }

    public matches(type: string): boolean {
        return type === this.preferred || type === this.legacy;
    }

    static fromString(type: string): WidgetType {
        // First try and match it against something we're already aware of
        const known = Object.values(WidgetType).filter(v => v instanceof WidgetType);
        const knownMatch = known.find(w => w.matches(type));
        if (knownMatch) return knownMatch;

        // If that fails, invent a new widget type
        return new WidgetType(type, type);
    }
}
