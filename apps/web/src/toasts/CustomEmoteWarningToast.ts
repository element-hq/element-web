/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

import GenericToast from "../components/views/toasts/GenericToast";
import { hasCustomEmotes } from "../custom-emotes";
import { _t } from "../languageHandler";
import ToastStore from "../stores/ToastStore";

const STORAGE_KEY = "mx_custom_emote_e2ee_warning_seen";
const TOAST_KEY = "custom-emote-e2ee-warning";

export function maybeShowCustomEmoteE2EEWarning(room: Room, content: RoomMessageEventContent): void {
    if (!room.hasEncryptionStateEvent() || !hasCustomEmotes(content)) return;

    try {
        if (localStorage.getItem(STORAGE_KEY)) return;
        localStorage.setItem(STORAGE_KEY, "true");
    } catch {}

    const dismiss = (): void => ToastStore.sharedInstance().dismissToast(TOAST_KEY);
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("composer|custom_emote_e2ee_warning_title"),
        component: GenericToast,
        priority: 40,
        onCloseButtonClicked: dismiss,
        props: {
            description: _t("composer|custom_emote_e2ee_warning_description"),
            primaryLabel: _t("action|dismiss"),
            onPrimaryClick: dismiss,
        },
    });
}
