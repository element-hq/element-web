/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useMemo } from "react";
import { EmojiPicker, type EmojiPickerProps, type PickerCustomEmote } from "@element-hq/web-shared-components";
import * as recent from "./recent";
import { getWebRovingAction } from "../accessibility/RovingTabIndex";
import { type CustomEmote } from "../custom-emotes";
import { mediaFromMxc } from "../customisations/Media";

interface CustomEmotePickerProps {
    customEmotes?: CustomEmote[];
    onChooseCustomEmote?: (emote: CustomEmote) => boolean;
}

type Props = Omit<
    EmojiPickerProps,
    "recentEmojis" | "onRecordRecent" | "getAction" | "customEmotes" | "onChooseCustomEmote"
> &
    CustomEmotePickerProps;

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
    customEmotes,
    onChooseCustomEmote,
}: Props): React.ReactNode {
    // There isn't anything for us to key the memoisation off here. This will just
    // update when the component mounts which is probably good enough.
    const recentEmojis = useMemo(() => recent.get(), []);

    // The picker only sees a structural subset of each emote, so keep a map back to
    // the originals rather than re-matching on fields that aren't a stable identity.
    const [pickerEmotes, emotesByPickerEmote] = useMemo(() => {
        const byPickerEmote = new Map<PickerCustomEmote, CustomEmote>();
        const mapped = customEmotes?.map((emote) => {
            const pickerEmote: PickerCustomEmote = {
                shortcode: emote.shortcode,
                url: mediaFromMxc(emote.url).srcHttp ?? emote.url,
                body: emote.body,
                packDisplayName: emote.pack.displayName,
            };
            byPickerEmote.set(pickerEmote, emote);
            return pickerEmote;
        });
        return [mapped, byPickerEmote] as const;
    }, [customEmotes]);

    return (
        <EmojiPicker
            selectedEmojis={selectedEmojis}
            onChoose={onChoose}
            onFinished={onFinished}
            isEmojiDisabled={isEmojiDisabled}
            getAction={getWebRovingAction}
            recentEmojis={recentEmojis}
            onRecordRecent={recent.add}
            customEmotes={pickerEmotes}
            onChooseCustomEmote={
                onChooseCustomEmote &&
                ((pickerEmote) => {
                    const match = emotesByPickerEmote.get(pickerEmote);
                    return match ? onChooseCustomEmote(match) : false;
                })
            }
        />
    );
}
