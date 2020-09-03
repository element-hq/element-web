/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import { _t } from '../languageHandler';
import AutocompleteProvider from './AutocompleteProvider';
import QueryMatcher from './QueryMatcher';
import {PillCompletion} from './Components';
import {ICompletion, ISelectionRange} from './Autocompleter';
import {uniq, sortBy} from 'lodash';
import SettingsStore from "../settings/SettingsStore";
import { shortcodeToUnicode } from '../HtmlUtils';
import { EMOJI, IEmoji } from '../emoji';

import EMOTICON_REGEX from 'emojibase-regex/emoticon';

const LIMIT = 20;

// Match for ascii-style ";-)" emoticons or ":wink:" shortcodes provided by emojibase
// anchored to only match from the start of parts otherwise it'll show emoji suggestions whilst typing matrix IDs
const EMOJI_REGEX = new RegExp('(' + EMOTICON_REGEX.source + '|(?:^|\\s):[+-\\w]*:?)$', 'g');

interface IEmojiShort {
    emoji: IEmoji;
    shortname: string;
    _orderBy: number;
}

const EMOJI_SHORTNAMES: IEmojiShort[] = EMOJI.sort((a, b) => {
    if (a.group === b.group) {
        return a.order - b.order;
    }
    return a.group - b.group;
}).map((emoji, index) => ({
    emoji,
    shortname: `:${emoji.shortcodes[0]}:`,
    // Include the index so that we can preserve the original order
    _orderBy: index,
}));

function score(query, space) {
    const index = space.indexOf(query);
    if (index === -1) {
        return Infinity;
    } else {
        return index;
    }
}

export default class EmojiProvider extends AutocompleteProvider {
    matcher: QueryMatcher<IEmojiShort>;
    nameMatcher: QueryMatcher<IEmojiShort>;

    constructor() {
        super(EMOJI_REGEX);
        this.matcher = new QueryMatcher<IEmojiShort>(EMOJI_SHORTNAMES, {
            keys: ['emoji.emoticon', 'shortname'],
            funcs: [
                (o) => o.emoji.shortcodes.length > 1 ? o.emoji.shortcodes.slice(1).map(s => `:${s}:`).join(" ") : "", // aliases
            ],
            // For matching against ascii equivalents
            shouldMatchWordsOnly: false,
        });
        this.nameMatcher = new QueryMatcher(EMOJI_SHORTNAMES, {
            keys: ['emoji.annotation'],
            // For removing punctuation
            shouldMatchWordsOnly: true,
        });
    }

    async getCompletions(query: string, selection: ISelectionRange, force?: boolean): Promise<ICompletion[]> {
        if (!SettingsStore.getValue("MessageComposerInput.suggestEmoji")) {
            return []; // don't give any suggestions if the user doesn't want them
        }

        let completions = [];
        const {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            const matchedString = command[0];
            completions = this.matcher.match(matchedString);

            // Do second match with shouldMatchWordsOnly in order to match against 'name'
            completions = completions.concat(this.nameMatcher.match(matchedString));

            const sorters = [];
            // make sure that emoticons come first
            sorters.push((c) => score(matchedString, c.emoji.emoticon || ""));

            // then sort by score (Infinity if matchedString not in shortname)
            sorters.push((c) => score(matchedString, c.shortname));
            // then sort by max score of all shortcodes, trim off the `:`
            sorters.push((c) => Math.min(...c.emoji.shortcodes.map(s => score(matchedString.substring(1), s))));
            // If the matchedString is not empty, sort by length of shortname. Example:
            //  matchedString = ":bookmark"
            //  completions = [":bookmark:", ":bookmark_tabs:", ...]
            if (matchedString.length > 1) {
                sorters.push((c) => c.shortname.length);
            }
            // Finally, sort by original ordering
            sorters.push((c) => c._orderBy);
            completions = sortBy(uniq(completions), sorters);

            completions = completions.map(({shortname}) => {
                const unicode = shortcodeToUnicode(shortname);
                return {
                    completion: unicode,
                    component: (
                        <PillCompletion title={shortname} aria-label={unicode}>
                            <span>{ unicode }</span>
                        </PillCompletion>
                    ),
                    range,
                };
            }).slice(0, LIMIT);
        }
        return completions;
    }

    getName() {
        return '😃 ' + _t('Emoji');
    }

    renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill"
                role="listbox"
                aria-label={_t("Emoji Autocomplete")}
            >
                { completions }
            </div>
        );
    }
}
