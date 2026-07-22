/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { type Room } from "matrix-js-sdk/src/matrix";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { maybeShowCustomEmoteE2EEWarning } from "./CustomEmoteWarningToast";
import ToastStore from "../stores/ToastStore";

const content = {
    msgtype: "m.text",
    body: ":wave:",
    format: "org.matrix.custom.html",
    formatted_body: '<img data-mx-emoticon src="mxc://example.org/wave" alt="A wave" title="wave">',
} as RoomMessageEventContent;

describe("custom emote encryption warning", () => {
    beforeEach(() => {
        localStorage.clear();
        ToastStore.sharedInstance().reset();
    });

    it("shows once for encrypted rooms and can be dismissed", () => {
        const room = { hasEncryptionStateEvent: vi.fn().mockReturnValue(true) } as unknown as Room;
        maybeShowCustomEmoteE2EEWarning(room, content);
        maybeShowCustomEmoteE2EEWarning(room, content);

        const [toast] = ToastStore.sharedInstance().getToasts();
        expect(ToastStore.sharedInstance().getToasts()).toHaveLength(1);
        toast.props?.onPrimaryClick();
        expect(ToastStore.sharedInstance().getToasts()).toHaveLength(0);
    });

    it("does not show for unencrypted rooms", () => {
        const room = { hasEncryptionStateEvent: vi.fn().mockReturnValue(false) } as unknown as Room;
        maybeShowCustomEmoteE2EEWarning(room, content);
        expect(ToastStore.sharedInstance().getToasts()).toHaveLength(0);
    });
});
