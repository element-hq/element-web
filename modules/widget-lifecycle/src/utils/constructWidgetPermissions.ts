/*
Copyright 2026 Element Creations Ltd.
Copyright 2023 Nordeck IT + Consulting GmbH

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { WidgetLifecycleModuleConfig, WidgetConfiguration } from "../config";
import { matchPattern } from "./matchPattern";

/**
 * Returns the WidgetConfiguration for a widget.
 * If multiple WidgetConfigurations match, the most specific match wins per field.
 */
export function constructWidgetPermissions(
    config: WidgetLifecycleModuleConfig,
    widgetUrl: string,
): WidgetConfiguration {
    const widgetPermissionsMatched = Object.keys(config).filter((pattern) => matchPattern(widgetUrl, pattern));

    return widgetPermissionsMatched.sort(sortLongestMatchLast).reduce((prev, key) => ({ ...prev, ...config[key] }), {});
}

/** Sort strings alphabetically so longer, more-specific patterns are applied last. */
export function sortLongestMatchLast(a: string, b: string): number {
    return a.localeCompare(b, "en", { sensitivity: "base" });
}
