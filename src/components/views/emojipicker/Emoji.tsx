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

import React from 'react';

import {MenuItem} from "../../structures/ContextMenu";
import {IEmoji} from "../../../emoji";
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps {
    emoji: IEmoji;
    selectedEmojis?: Set<string>;
    onClick(emoji: IEmoji): void;
    onMouseEnter(emoji: IEmoji): void;
    onMouseLeave(emoji: IEmoji): void;
}

@replaceableComponent("views.emojipicker.Emoji")
class Emoji extends React.PureComponent<IProps> {
    render() {
        const { onClick, onMouseEnter, onMouseLeave, emoji, selectedEmojis } = this.props;
        const isSelected = selectedEmojis && selectedEmojis.has(emoji.unicode);
        return (
            <MenuItem
                element="li"
                onClick={() => onClick(emoji)}
                onMouseEnter={() => onMouseEnter(emoji)}
                onMouseLeave={() => onMouseLeave(emoji)}
                className="mx_EmojiPicker_item_wrapper"
                label={emoji.unicode}
            >
                <div className={`mx_EmojiPicker_item ${isSelected ? 'mx_EmojiPicker_item_selected' : ''}`}>
                    {emoji.unicode}
                </div>
            </MenuItem>
        );
    }
}

export default Emoji;
