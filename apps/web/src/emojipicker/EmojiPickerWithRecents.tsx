/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useMemo } from "react";
import { getEmojiFromUnicode } from "@matrix-org/emojibase-bindings";
import { EmojiPicker, type EmojiPickerProps } from "@element-hq/web-shared-components";
import * as recent from "./recent";
import { getWebRovingAction } from "../accessibility/RovingTabIndex";

type HostOwnedEmojiPickerProp =
    | "recentEmojis"
    | "onRecordRecent"
    | "getAction"
    | "showQuickReactions"
    | "emojisPerRow"
    | "emojiRowHeight"
    | "categoryOrientation"
    | "previewFallbackEmoji"
    | "className";

type EmojiPickerWithRecentsProps = Omit<EmojiPickerProps, HostOwnedEmojiPickerProp>;

/**
 * Wrapped version of the shared-components emoji picker that passes in
 * the recent emojis from the web app's local storage (also passes in the
 * web roving actions).
 */
export function EmojiPickerWithRecents(props: EmojiPickerWithRecentsProps): React.ReactNode {
    // There isn't anything for us to key the memoisation off here. This will just
    // update when the component mounts which is probably good enough.
    const { recentEmojis, previewFallbackEmoji } = useMemo(() => {
        const recentEmojis = recent.get();
        return {
            recentEmojis,
            previewFallbackEmoji: recentEmojis.find((emoji) => getEmojiFromUnicode(emoji)) ?? "😀",
        };
    }, []);

    return (
        <EmojiPicker
            {...props}
            className="mx_EmojiPickerWithRecents"
            getAction={getWebRovingAction}
            recentEmojis={recentEmojis}
            onRecordRecent={recent.add}
            showQuickReactions
            emojisPerRow={11}
            emojiRowHeight={52}
            categoryOrientation="vertical"
            previewFallbackEmoji={previewFallbackEmoji}
        />
    );
}
