/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>

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

import React from 'react';
import PropTypes from 'prop-types';

import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import {getEmojiFromUnicode} from "../../../emoji";

// We use the variation-selector Heart in Quick Reactions for some reason
const QUICK_REACTIONS = ["👍", "👎", "😄", "🎉", "😕", "❤️", "🚀", "👀"].map(emoji => {
    const data = getEmojiFromUnicode(emoji);
    if (!data) {
        throw new Error(`Emoji ${emoji} doesn't exist in emojibase`);
    }
    return data;
});

class QuickReactions extends React.Component {
    static propTypes = {
        onClick: PropTypes.func.isRequired,
        selectedEmojis: PropTypes.instanceOf(Set),
    };

    constructor(props) {
        super(props);
        this.state = {
            hover: null,
        };
        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
    }

    onMouseEnter(emoji) {
        this.setState({
            hover: emoji,
        });
    }

    onMouseLeave() {
        this.setState({
            hover: null,
        });
    }

    render() {
        const Emoji = sdk.getComponent("emojipicker.Emoji");

        return (
            <section className="mx_EmojiPicker_footer mx_EmojiPicker_quick mx_EmojiPicker_category">
                <h2 className="mx_EmojiPicker_quick_header mx_EmojiPicker_category_label">
                    {!this.state.hover
                        ? _t("Quick Reactions")
                        : <React.Fragment>
                            <span className="mx_EmojiPicker_name">{this.state.hover.annotation}</span>
                            <span className="mx_EmojiPicker_shortcode">{this.state.hover.shortcodes[0]}</span>
                        </React.Fragment>
                    }
                </h2>
                <ul className="mx_EmojiPicker_list" aria-label={_t("Quick Reactions")}>
                    {QUICK_REACTIONS.map(emoji => <Emoji
                        key={emoji.hexcode} emoji={emoji} onClick={this.props.onClick}
                        onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}
                        selectedEmojis={this.props.selectedEmojis} />)}
                </ul>
            </section>
        );
    }
}

export default QuickReactions;
