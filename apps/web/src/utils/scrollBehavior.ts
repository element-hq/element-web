/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingsStore from "../settings/SettingsStore";

/** Whether the operating system requests reduced motion via the prefers-reduced-motion media query. */
export function prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Whether smooth scrolling should be suppressed, honouring both the explicit user setting and
 * the operating system's reduced-motion preference.
 */
export function smoothScrollingDisabled(): boolean {
    return SettingsStore.getValue("Accessibility.disableSmoothScrolling") || prefersReducedMotion();
}

/** Returns the ScrollBehavior to use, honoring the user setting + OS reduced-motion preference. */
export function getScrollBehavior(preferred: ScrollBehavior = "smooth"): ScrollBehavior {
    return smoothScrollingDisabled() ? "auto" : preferred;
}
