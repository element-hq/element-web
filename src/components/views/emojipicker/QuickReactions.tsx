/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import { getEmojiFromUnicode, IEmoji } from "../../../emoji";
import Emoji from "./Emoji";
import { ButtonEvent } from "../elements/AccessibleButton";
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
                        _t("Quick Reactions")
                    ) : (
                        <React.Fragment>
                            <span className="mx_EmojiPicker_name">{this.state.hover.label}</span>
                            <span className="mx_EmojiPicker_shortcode">{this.state.hover.shortcodes[0]}</span>
                        </React.Fragment>
                    )}
                </h2>
                <Toolbar className="mx_EmojiPicker_list" aria-label={_t("Quick Reactions")}>
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
