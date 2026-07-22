/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { mediaFromMxc } from "../../../customisations/Media";
import { type CustomEmote } from "../../../custom-emotes";

interface IProps {
    emote: CustomEmote;
}

export default class CustomEmotePreview extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        const { emote } = this.props;
        return (
            <div className="mx_EmojiPicker_footer mx_EmojiPicker_preview">
                <img
                    className="mx_EmojiPicker_preview_emoji mx_EmojiPicker_preview_customEmote"
                    src={mediaFromMxc(emote.url).getSquareThumbnailHttp(64) ?? undefined}
                    alt={emote.body || emote.shortcode}
                />
                <div className="mx_EmojiPicker_preview_text">
                    <div className="mx_EmojiPicker_name mx_EmojiPicker_preview_name">
                        {emote.body || emote.shortcode}
                    </div>
                    <div className="mx_EmojiPicker_shortcode">{emote.shortcode}</div>
                    <div className="mx_EmojiPicker_customPack_name">{emote.pack.displayName}</div>
                </div>
            </div>
        );
    }
}
