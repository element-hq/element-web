/*
Copyright 2019 Tulir Asokan

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

import EMOJIBASE from 'emojibase-data/en/compact.json';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

const EMOJIBASE_CATEGORY_IDS = [
    "people", // smileys
    "people", // actually people
    "control", // modifiers and such, not displayed in picker
    "nature",
    "foods",
    "places",
    "activity",
    "objects",
    "symbols",
    "flags",
];

const DATA_BY_CATEGORY = {
    "people": [],
    "nature": [],
    "foods": [],
    "places": [],
    "activity": [],
    "objects": [],
    "symbols": [],
    "flags": [],
    "control": [],
};

EMOJIBASE.forEach(emoji => {
    DATA_BY_CATEGORY[EMOJIBASE_CATEGORY_IDS[emoji.group]].push(emoji);
    // This is used as the string to match the query against when filtering emojis.
    emoji.filterString = `${emoji.annotation}\n${emoji.shortcodes.join('\n')}}\n${emoji.emoticon || ''}`;
});

class EmojiPicker extends React.Component {
    static propTypes = {
        onChoose: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            filter: "",
            previewEmoji: null,
        };

        this.categories = [{
            id: "recent",
            name: _t("Frequently Used"),
        }, {
            id: "people",
            name: _t("Smileys & People"),
        }, {
            id: "nature",
            name: _t("Animals & Nature"),
        }, {
            id: "foods",
            name: _t("Food & Drink"),
        }, {
            id: "activity",
            name: _t("Activities"),
        }, {
            id: "places",
            name: _t("Travel & Places"),
        }, {
            id: "objects",
            name: _t("Objects"),
        }, {
            id: "symbols",
            name: _t("Symbols"),
        }, {
            id: "flags",
            name: _t("Flags"),
        }];

        this.onChangeFilter = this.onChangeFilter.bind(this);
        this.onHoverEmoji = this.onHoverEmoji.bind(this);
        this.onHoverEmojiEnd = this.onHoverEmojiEnd.bind(this);
        this.onClickEmoji = this.onClickEmoji.bind(this);
    }

    scrollToCategory() {
        // TODO
    }

    onChangeFilter(ev) {
        this.setState({
            filter: ev.target.value,
        });
    }

    onHoverEmoji(emoji) {
        this.setState({
            previewEmoji: emoji,
        });
    }

    onHoverEmojiEnd(emoji) {
        this.setState({
            previewEmoji: null,
        });
    }

    onClickEmoji(emoji) {
        this.props.onChoose(emoji.unicode);
    }

    render() {
        const Header = sdk.getComponent("emojipicker.Header");
        const Search = sdk.getComponent("emojipicker.Search");
        const Category = sdk.getComponent("emojipicker.Category");
        const Preview = sdk.getComponent("emojipicker.Preview");
        const QuickReactions = sdk.getComponent("emojipicker.QuickReactions");
        return (
            <div className="mx_EmojiPicker">
                <Header categories={this.categories} defaultCategory="recent" onAnchorClick={this.scrollToCategory}/>
                <Search query={this.state.filter} onChange={this.onChangeFilter}/>
                <div className="mx_EmojiPicker_body">
                    {this.categories.map(category => (
                        <Category key={category.id} emojis={DATA_BY_CATEGORY[category.id]} name={category.name}
                            filter={this.state.filter} onClick={this.onClickEmoji}
                            onMouseEnter={this.onHoverEmoji} onMouseLeave={this.onHoverEmojiEnd} />
                    ))}
                </div>
                {this.state.previewEmoji
                    ? <Preview emoji={this.state.previewEmoji} />
                    : <QuickReactions onClick={this.onClickEmoji} /> }
            </div>
        )
    }
}

export default EmojiPicker;
