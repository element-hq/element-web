/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useMemo } from "react";
import { EmojiPicker, type EmojiPickerProps } from "@element-hq/web-shared-components";
import * as recent from "./recent";
import { getWebRovingAction } from "../accessibility/RovingTabIndex";

/**
 * Wrapped version of the shared-components emoji picker that passes in
 * the recent emojis from the web app's local storage (also passes in the
 * web roving actions).
 */
export function EmojiPickerWithRecents({
    selectedEmojis,
    onChoose,
    onFinished,
    isEmojiDisabled,
}: Omit<EmojiPickerProps, "recentEmojis" | "onRecordRecent" | "getAction">): React.ReactNode {
    // There isn't anything for us to key the memoisation off here. This will just
    // update when the component mounts which is probably good enough.
    const recentEmojis = useMemo(() => recent.get(), []);

    return (
        <EmojiPicker
            selectedEmojis={selectedEmojis}
            onChoose={onChoose}
            onFinished={onFinished}
            isEmojiDisabled={isEmojiDisabled}
            getAction={getWebRovingAction}
            recentEmojis={recentEmojis}
            onRecordRecent={recent.add}
        />
    );
}
