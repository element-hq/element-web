/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { getEmojiFromUnicode, type Emoji as IEmoji } from "@matrix-org/emojibase-bindings";

import { _t } from "../../../languageHandler";
import Emoji from "./Emoji";
import { type ButtonEvent } from "../elements/AccessibleButton";
import Toolbar from "../../../accessibility/Toolbar";

// We use the variation-selector Heart in Quick Reactions for some reason
const QUICK_REACTIONS = ["👍", "👎", "😄", "🎉", "😕", "❤️", "🚀", "👀"].map((emoji) => {
    const data = getEmojiFromUnicode(emoji);
    if (!data) {
        throw new Error(`Emoji ${emoji} doesn't exist in emojibase`);
    }
    return data;
});

interface IProps {
    selectedEmojis?: Set<string>;
    onClick(ev: ButtonEvent, emoji: IEmoji): void;
}

interface IState {
    hover?: IEmoji;
}

class QuickReactions extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {};
    }

    private onMouseEnter = (emoji: IEmoji): void => {
        this.setState({
            hover: emoji,
        });
    };

    private onMouseLeave = (): void => {
        this.setState({
            hover: undefined,
        });
    };

    public render(): React.ReactNode {
        return (
            <section className="mx_EmojiPicker_footer mx_EmojiPicker_quick mx_EmojiPicker_category">
                <h2 className="mx_EmojiPicker_quick_header mx_EmojiPicker_category_label">
                    {!this.state.hover ? (
                        _t("emoji|quick_reactions")
                    ) : (
                        <React.Fragment>
                            <span className="mx_EmojiPicker_name">{this.state.hover.label}</span>
                            <span className="mx_EmojiPicker_shortcode">{this.state.hover.shortcodes[0]}</span>
                        </React.Fragment>
                    )}
                </h2>
                <Toolbar className="mx_EmojiPicker_list" aria-label={_t("emoji|quick_reactions")}>
                    {QUICK_REACTIONS.map((emoji) => (
                        <Emoji
                            key={emoji.hexcode}
                            emoji={emoji}
                            onClick={this.props.onClick}
                            onMouseEnter={this.onMouseEnter}
                            onMouseLeave={this.onMouseLeave}
                            selectedEmojis={this.props.selectedEmojis}
                        />
                    ))}
                </Toolbar>
            </section>
        );
    }
}

export default QuickReactions;
