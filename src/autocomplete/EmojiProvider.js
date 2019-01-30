/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd

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
import {shortnameToUnicode, asciiRegexp, unicodeRegexp} from 'emojione';
import QueryMatcher from './QueryMatcher';
import sdk from '../index';
import {PillCompletion} from './Components';
import type {Completion, SelectionRange} from './Autocompleter';
import _uniq from 'lodash/uniq';
import _sortBy from 'lodash/sortBy';
import SettingsStore from "../settings/SettingsStore";

import EmojiData from '../stripped-emoji.json';

const LIMIT = 20;
const CATEGORY_ORDER = [
    'people',
    'food',
    'objects',
    'activity',
    'nature',
    'travel',
    'flags',
    'regional',
    'symbols',
    'modifier',
];

// Match for ":wink:" or ascii-style ";-)" provided by emojione
// (^|\s|(emojiUnicode)) to make sure we're either at the start of the string or there's a
// whitespace character or an emoji before the emoji. The reason for unicodeRegexp is
// that we need to support inputting multiple emoji with no space between them.
const EMOJI_REGEX = new RegExp('(?:^|\\s|' + unicodeRegexp + ')(' + asciiRegexp + '|:[+-\\w]*:?)$', 'g');

// We also need to match the non-zero-length prefixes to remove them from the final match,
// and update the range so that we don't replace the whitespace or the previous emoji.
const MATCH_PREFIX_REGEX = new RegExp('(\\s|' + unicodeRegexp + ')');

const EMOJI_SHORTNAMES = Object.keys(EmojiData).map((key) => EmojiData[key]).sort(
    (a, b) => {
        if (a.category === b.category) {
            return a.emoji_order - b.emoji_order;
        }
        return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    },
).map((a, index) => {
    return {
        name: a.name,
        shortname: a.shortname,
        aliases: a.aliases ? a.aliases.join(' ') : '',
        aliases_ascii: a.aliases_ascii ? a.aliases_ascii.join(' ') : '',
        // Include the index so that we can preserve the original order
        _orderBy: index,
    };
});

function score(query, space) {
    const index = space.indexOf(query);
    if (index === -1) {
        return Infinity;
    } else {
        return index;
    }
}

export default class EmojiProvider extends AutocompleteProvider {
    constructor() {
        super(EMOJI_REGEX);
        this.matcher = new QueryMatcher(EMOJI_SHORTNAMES, {
            keys: ['aliases_ascii', 'shortname', 'aliases'],
            // For matching against ascii equivalents
            shouldMatchWordsOnly: false,
        });
        this.nameMatcher = new QueryMatcher(EMOJI_SHORTNAMES, {
            keys: ['name'],
            // For removing punctuation
            shouldMatchWordsOnly: true,
        });
    }

    async getCompletions(query: string, selection: SelectionRange, force?: boolean): Array<Completion> {
        if (!SettingsStore.getValue("MessageComposerInput.suggestEmoji")) {
            return []; // don't give any suggestions if the user doesn't want them
        }

        const EmojiText = sdk.getComponent('views.elements.EmojiText');

        let completions = [];
        const {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            let matchedString = command[0];

            // Remove prefix of any length (single whitespace or unicode emoji)
            const prefixMatch = MATCH_PREFIX_REGEX.exec(matchedString);
            if (prefixMatch) {
                matchedString = matchedString.slice(prefixMatch[0].length);
                range.start += prefixMatch[0].length;
            }
            completions = this.matcher.match(matchedString);

            // Do second match with shouldMatchWordsOnly in order to match against 'name'
            completions = completions.concat(this.nameMatcher.match(matchedString));

            const sorters = [];
            // First, sort by score (Infinity if matchedString not in shortname)
            sorters.push((c) => score(matchedString, c.shortname));
            // If the matchedString is not empty, sort by length of shortname. Example:
            //  matchedString = ":bookmark"
            //  completions = [":bookmark:", ":bookmark_tabs:", ...]
            if (matchedString.length > 1) {
                sorters.push((c) => c.shortname.length);
            }
            // Finally, sort by original ordering
            sorters.push((c) => c._orderBy);
            completions = _sortBy(_uniq(completions), sorters);

            completions = completions.map((result) => {
                const {shortname} = result;
                const unicode = shortnameToUnicode(shortname);
                return {
                    completion: unicode,
                    component: (
                        <PillCompletion title={shortname} initialComponent={<EmojiText style={{maxWidth: '1em'}}>{ unicode }</EmojiText>} />
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

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_pill">
            { completions }
        </div>;
    }
}
