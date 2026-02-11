/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Emoji as IEmoji } from "@matrix-org/emojibase-bindings";

import { type ButtonEvent } from "../elements/AccessibleButton";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";

interface IProps {
    emoji: IEmoji;
    /**
     * Set of which emojis are already selected and should be decorated as such.
     * If specified, emoji will use a checkbox role with aria-checked set appropriately.
     */
    selectedEmojis?: Set<string>;
    onClick(ev: ButtonEvent, emoji: IEmoji): void;
    onMouseEnter(emoji: IEmoji): void;
    onMouseLeave(emoji: IEmoji): void;
    disabled?: boolean;
    id?: string;
    className?: string;
}

class Emoji extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        const { onClick, onMouseEnter, onMouseLeave, emoji, selectedEmojis } = this.props;
        const isSelected = selectedEmojis?.has(emoji.unicode);
        return (
            <RovingAccessibleButton
                id={this.props.id}
                onClick={(ev: ButtonEvent) => onClick(ev, emoji)}
                onMouseEnter={() => onMouseEnter(emoji)}
                onMouseLeave={() => onMouseLeave(emoji)}
                className={this.props.className}
                disabled={this.props.disabled || undefined}
                role={selectedEmojis ? "checkbox" : undefined}
                aria-checked={this.props.disabled ? undefined : isSelected}
                focusOnMouseOver
            >
                <div className={`mx_EmojiPicker_item ${isSelected ? "mx_EmojiPicker_item_selected" : ""}`}>
                    {emoji.unicode}
                </div>
            </RovingAccessibleButton>
        );
    }
}

export default Emoji;
