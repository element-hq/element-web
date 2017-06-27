/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd

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
import {emojioneList, shortnameToImage, shortnameToUnicode} from 'emojione';
import FuzzyMatcher from './FuzzyMatcher';
import sdk from '../index';
import {PillCompletion} from './Components';
import type {SelectionRange, Completion} from './Autocompleter';

import EmojiData from 'emoji-datasource/emoji';

const emojiDataToEmojiOne = (name) => ':' + name + ':';

// Only include emojis that are in both data sets
const emojiOneShortNames = Object.keys(emojioneList);
const emojiDataWithEmojiOneSupport = EmojiData.filter((a) => {
    return emojiOneShortNames.indexOf(
        emojiDataToEmojiOne(a.short_name),
    ) !== -1;
});

const LIMIT = 20;
const CATEGORY_ORDER = [
  'People',
  'Foods',
  'Objects',
  'Activity',
  'Skin Tones',
  'Nature',
  'Places',
  'Flags',
  'Symbols',
];

const EMOJI_REGEX = /:\w*:?/g;
const EMOJI_SHORTNAMES = emojiDataWithEmojiOneSupport.sort(
    (a, b) => {
        if (a.category === b.category) {
            return a.sort_order - b.sort_order;
        }
        return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    },
).map((a) => {
    return {
        shortname: emojiDataToEmojiOne(a.short_name),
        shortnames: a.short_names.join(','),
    };
});

let instance = null;

export default class EmojiProvider extends AutocompleteProvider {
    constructor() {
        super(EMOJI_REGEX);
        this.matcher = new FuzzyMatcher(EMOJI_SHORTNAMES, {
            keys: ['shortname', 'shortnames'],
        });
    }

    async getCompletions(query: string, selection: SelectionRange) {
        const EmojiText = sdk.getComponent('views.elements.EmojiText');

        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            completions = this.matcher.match(command[0]).map(result => {
                const {shortname} = result;
                const unicode = shortnameToUnicode(shortname);
                return {
                    completion: unicode,
                    component: (
                        <PillCompletion title={shortname} initialComponent={<EmojiText style={{maxWidth: '1em'}}>{unicode}</EmojiText>} />
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

    static getInstance() {
        if (instance == null)
            {instance = new EmojiProvider();}
        return instance;
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_pill">
            {completions}
        </div>;
    }
}
