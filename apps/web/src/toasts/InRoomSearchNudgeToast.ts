/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../languageHandler";
import { IS_ELECTRON, IS_MAC, Key } from "../Keyboard";
import { isKeyComboMatch } from "../KeyBindingsManager";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import ToastStore from "../stores/ToastStore";
import GenericToast from "../components/views/toasts/GenericToast";

const TOAST_KEY = "in-room-search-nudge";

const dismiss = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};

const markShown = (): void => {
    // Device-local: the nudge is about this browser's opt-in web shortcut, so it never needs the account.
    void SettingsStore.setValue("ctrlFForSearchNudgeShown", null, SettingLevel.DEVICE, true);
};

/**
 * Show the one-time toast that points the user at the opt-in in-room search shortcut.
 * Exported for testing; prefer {@link showInRoomSearchNudgeIfNeeded} from the keydown handler.
 */
export function showInRoomSearchNudgeToast(): void {
    markShown();
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("room|search|nudge_title"),
        props: {
            description: _t("room|search|nudge_description"),
            primaryLabel: _t("action|enable"),
            onPrimaryClick: () => {
                void SettingsStore.setValue("ctrlFForSearch", null, SettingLevel.ACCOUNT, true);
                dismiss();
            },
            secondaryLabel: _t("action|dismiss"),
            onSecondaryClick: dismiss,
        },
        component: GenericToast,
        // Low priority: this is a passive discoverability hint, not an urgent action.
        priority: 30,
    });
}

/**
 * On the web build the in-room search shortcut (Ctrl/Cmd+F) is opt-in so that the browser's native
 * find-on-page keeps working. The first time the user presses it while it is disabled, surface a
 * one-time toast pointing them at the setting.
 *
 * The caller MUST NOT preventDefault the event, so the browser find bar still opens (element-web
 * #33360), and should only call this on the "nothing focused" path so a focused composer never
 * competes with the shortcut.
 */
export function showInRoomSearchNudgeIfNeeded(ev: KeyboardEvent): void {
    // Desktop enables the shortcut by default and has no browser find bar to preserve — nothing to nudge.
    if (IS_ELECTRON) return;
    // Already enabled, or we have already shown the nudge once on this device.
    if (SettingsStore.getValue("ctrlFForSearch")) return;
    if (SettingsStore.getValue("ctrlFForSearchNudgeShown")) return;
    if (!isKeyComboMatch(ev, { key: Key.F, ctrlOrCmdKey: true }, IS_MAC)) return;

    showInRoomSearchNudgeToast();
}
