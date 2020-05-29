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

import * as recent from '../../../emojipicker/recent';
import {DATA_BY_CATEGORY, getEmojiFromUnicode} from "../../../emoji";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";

export const CATEGORY_HEADER_HEIGHT = 22;
export const EMOJI_HEIGHT = 37;
export const EMOJIS_PER_ROW = 8;

class EmojiPicker extends React.Component {
    static propTypes = {
        onChoose: PropTypes.func.isRequired,
        selectedEmojis: PropTypes.instanceOf(Set),
        showQuickReactions: PropTypes.bool,
    };

    constructor(props) {
        super(props);

        this.state = {
            filter: "",
            previewEmoji: null,
            scrollTop: 0,
            // initial estimation of height, dialog is hardcoded to 450px height.
            // should be enough to never have blank rows of emojis as
            // 3 rows of overflow are also rendered. The actual value is updated on scroll.
            viewportHeight: 280,
        };

        // Convert recent emoji characters to emoji data, removing unknowns and duplicates
        this.recentlyUsed = Array.from(new Set(recent.get().map(getEmojiFromUnicode).filter(Boolean)));
        this.memoizedDataByCategory = {
            recent: this.recentlyUsed,
            ...DATA_BY_CATEGORY,
        };

        this.categories = [{
            id: "recent",
            name: _t("Frequently Used"),
            enabled: this.recentlyUsed.length > 0,
            visible: this.recentlyUsed.length > 0,
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
    }

    onScroll = () => {
        const body = this.bodyRef.current;
        this.setState({
            scrollTop: body.scrollTop,
            viewportHeight: body.clientHeight,
        });
        this.updateVisibility();
    };

    updateVisibility() {
        const body = this.bodyRef.current;
        const rect = body.getBoundingClientRect();
        for (const cat of this.categories) {
            const elem = body.querySelector(`[data-category-id="${cat.id}"]`);
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
                cat.ref.current.setAttribute("aria-selected", true);
                cat.ref.current.setAttribute("tabindex", 0);
            } else {
                cat.ref.current.classList.remove("mx_EmojiPicker_anchor_visible");
                cat.ref.current.setAttribute("aria-selected", false);
                cat.ref.current.setAttribute("tabindex", -1);
            }
        }
    }

    scrollToCategory(category) {
        this.bodyRef.current.querySelector(`[data-category-id="${category}"]`).scrollIntoView();
    }

    onChangeFilter(filter) {
        filter = filter.toLowerCase(); // filter is case insensitive stored lower-case
        for (const cat of this.categories) {
            let emojis;
            // If the new filter string includes the old filter string, we don't have to re-filter the whole dataset.
            if (filter.includes(this.state.filter)) {
                emojis = this.memoizedDataByCategory[cat.id];
            } else {
                emojis = cat.id === "recent" ? this.recentlyUsed : DATA_BY_CATEGORY[cat.id];
            }
            emojis = emojis.filter(emoji => emoji.filterString.includes(filter));
            this.memoizedDataByCategory[cat.id] = emojis;
            cat.enabled = emojis.length > 0;
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
        if (this.props.onChoose(emoji.unicode) !== false) {
            recent.add(emoji.unicode);
        }
    }

    _categoryHeightForEmojiCount(count) {
        if (count === 0) {
            return 0;
        }
        return CATEGORY_HEADER_HEIGHT + (Math.ceil(count / EMOJIS_PER_ROW) * EMOJI_HEIGHT);
    }

    render() {
        const Header = sdk.getComponent("emojipicker.Header");
        const Search = sdk.getComponent("emojipicker.Search");
        const Category = sdk.getComponent("emojipicker.Category");
        const Preview = sdk.getComponent("emojipicker.Preview");
        const QuickReactions = sdk.getComponent("emojipicker.QuickReactions");
        let heightBefore = 0;
        return (
            <div className="mx_EmojiPicker">
                <Header categories={this.categories} defaultCategory="recent" onAnchorClick={this.scrollToCategory} />
                <Search query={this.state.filter} onChange={this.onChangeFilter} />
                <AutoHideScrollbar className="mx_EmojiPicker_body" wrappedRef={e => this.bodyRef.current = e} onScroll={this.onScroll}>
                    {this.categories.map(category => {
                        const emojis = this.memoizedDataByCategory[category.id];
                        const categoryElement = (<Category key={category.id} id={category.id} name={category.name}
                            heightBefore={heightBefore} viewportHeight={this.state.viewportHeight}
                            scrollTop={this.state.scrollTop} emojis={emojis} onClick={this.onClickEmoji}
                            onMouseEnter={this.onHoverEmoji} onMouseLeave={this.onHoverEmojiEnd}
                            selectedEmojis={this.props.selectedEmojis} />);
                        const height = this._categoryHeightForEmojiCount(emojis.length);
                        heightBefore += height;
                        return categoryElement;
                    })}
                </AutoHideScrollbar>
                {this.state.previewEmoji || !this.props.showQuickReactions
                    ? <Preview emoji={this.state.previewEmoji} />
                    : <QuickReactions onClick={this.onClickEmoji} selectedEmojis={this.props.selectedEmojis} /> }
            </div>
        );
    }
}

export default EmojiPicker;
