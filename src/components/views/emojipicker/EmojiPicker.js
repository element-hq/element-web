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

import * as recent from './recent';

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
};
const DATA_BY_EMOJI = {};

EMOJIBASE.forEach(emoji => {
    DATA_BY_EMOJI[emoji.unicode] = emoji;
    const categoryId = EMOJIBASE_CATEGORY_IDS[emoji.group];
    if (DATA_BY_CATEGORY.hasOwnProperty(categoryId)) {
        DATA_BY_CATEGORY[categoryId].push(emoji);
    }
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

        this.recentlyUsed = recent.get().map(unicode => DATA_BY_EMOJI[unicode]);
        this.memoizedDataByCategory = {
            recent: this.recentlyUsed,
            ...DATA_BY_CATEGORY,
        };

        this.categories = [{
            id: "recent",
            name: _t("Frequently Used"),
            enabled: this.recentlyUsed.length > 0,
            visible: true,
            ref: React.createRef(),
        }, {
            id: "people",
            name: _t("Smileys & People"),
            enabled: true,
            visible: true,
            ref: React.createRef(),
        }, {
            id: "nature",
            name: _t("Animals & Nature"),
            enabled: true,
            visible: false,
            ref: React.createRef(),
        }, {
            id: "foods",
            name: _t("Food & Drink"),
            enabled: true,
            visible: false,
            ref: React.createRef(),
        }, {
            id: "activity",
            name: _t("Activities"),
            enabled: true,
            visible: false,
            ref: React.createRef(),
        }, {
            id: "places",
            name: _t("Travel & Places"),
            enabled: true,
            visible: false,
            ref: React.createRef(),
        }, {
            id: "objects",
            name: _t("Objects"),
            enabled: true,
            visible: false,
            ref: React.createRef(),
        }, {
            id: "symbols",
            name: _t("Symbols"),
            enabled: true,
            visible: false,
            ref: React.createRef(),
        }, {
            id: "flags",
            name: _t("Flags"),
            enabled: true,
            visible: false,
            ref: React.createRef(),
        }];

        this.bodyRef = React.createRef();

        this.onChangeFilter = this.onChangeFilter.bind(this);
        this.onHoverEmoji = this.onHoverEmoji.bind(this);
        this.onHoverEmojiEnd = this.onHoverEmojiEnd.bind(this);
        this.onClickEmoji = this.onClickEmoji.bind(this);
        this.scrollToCategory = this.scrollToCategory.bind(this);
        this.updateVisibility = this.updateVisibility.bind(this);

        window.bodyRef = this.bodyRef;
    }

    updateVisibility() {
        const rect = this.bodyRef.current.getBoundingClientRect();
        for (const cat of this.categories) {
            const elem = this.bodyRef.current.querySelector(`[data-category-id="${cat.id}"]`);
            if (!elem) {
                cat.visible = false;
                cat.ref.current.classList.remove("mx_EmojiPicker_anchor_visible");
                continue;
            }
            const elemRect = elem.getBoundingClientRect();
            const y = elemRect.y - rect.y;
            const yEnd = elemRect.y + elemRect.height - rect.y;
            cat.visible = y < rect.height && yEnd > 0;
            // We update this here instead of through React to avoid re-render on scroll.
            if (cat.visible) {
                cat.ref.current.classList.add("mx_EmojiPicker_anchor_visible");
            } else {
                cat.ref.current.classList.remove("mx_EmojiPicker_anchor_visible");
            }
        }
    }

    scrollToCategory(category) {
        this.bodyRef.current.querySelector(`[data-category-id="${category}"]`).scrollIntoView();
    }

    onChangeFilter(filter) {
        for (let [id, emojis] of Object.entries(this.memoizedDataByCategory)) {
            // If the new filter string includes the old filter string, we don't have to re-filter the whole dataset.
            if (!filter.includes(this.state.filter)) {
                emojis = id === "recent" ? this.recentlyUsed : DATA_BY_CATEGORY[id];
            }
            this.memoizedDataByCategory[id] = emojis.filter(emoji => emoji.filterString.includes(filter));
            const cat = this.categories.find(cat => cat.id === id);
            cat.enabled = this.memoizedDataByCategory[id].length > 0;
            // The setState below doesn't re-render the header and we already have the refs for updateVisibility, so...
            cat.ref.current.disabled = !cat.enabled;
        }
        this.setState({ filter });
        // Header underlines need to be updated, but updating requires knowing
        // where the categories are, so we wait for a tick.
        setTimeout(this.updateVisibility, 0);
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
        recent.add(emoji.unicode);
        this.recentlyUsed = recent.get().map(unicode => DATA_BY_EMOJI[unicode]);
        this.memoizedDataByCategory.recent = this.recentlyUsed.filter(emoji =>
            emoji.filterString.includes(this.state.filter))
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
                <div className="mx_EmojiPicker_body" ref={this.bodyRef} onScroll={this.updateVisibility}>
                    {this.categories.map(category => (
                        <Category key={category.id} id={category.id} name={category.name}
                            emojis={this.memoizedDataByCategory[category.id]} onClick={this.onClickEmoji}
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
