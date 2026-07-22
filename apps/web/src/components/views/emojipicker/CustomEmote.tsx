/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import { mediaFromMxc } from "../../../customisations/Media";
import { type CustomEmote as ICustomEmote } from "../../../custom-emotes";
import { type ButtonEvent } from "../elements/AccessibleButton";

interface IProps {
    emote: ICustomEmote;
    id: string;
    onClick(ev: ButtonEvent, emote: ICustomEmote): void;
    onMouseEnter(emote: ICustomEmote): void;
    onMouseLeave(emote: ICustomEmote): void;
}

export default class CustomEmote extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        const { emote, id, onClick, onMouseEnter, onMouseLeave } = this.props;
        return (
            <RovingAccessibleButton
                id={id}
                onClick={(ev: ButtonEvent) => onClick(ev, emote)}
                onMouseEnter={() => onMouseEnter(emote)}
                onMouseLeave={() => onMouseLeave(emote)}
                aria-label={`:${emote.shortcode}: — ${emote.pack.displayName}`}
                focusOnMouseOver
            >
                <img
                    className="mx_EmojiPicker_item mx_EmojiPicker_customEmote"
                    src={mediaFromMxc(emote.url).getSquareThumbnailHttp(48) ?? undefined}
                    alt={emote.body || emote.shortcode}
                    loading="lazy"
                />
            </RovingAccessibleButton>
        );
    }
}
