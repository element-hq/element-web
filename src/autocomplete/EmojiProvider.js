/*
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
import Fuse from 'fuse.js';
import sdk from '../index';
import {PillCompletion} from './Components';
import type {SelectionRange, Completion} from './Autocompleter';

const EMOJI_REGEX = /:\w*:?/g;
const EMOJI_SHORTNAMES = Object.keys(emojioneList);

let instance = null;

export default class EmojiProvider extends AutocompleteProvider {
    constructor() {
        super(EMOJI_REGEX);
        this.fuse = new Fuse(EMOJI_SHORTNAMES, {});
    }

    async getCompletions(query: string, selection: SelectionRange) {
        const EmojiText = sdk.getComponent('views.elements.EmojiText');

        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            completions = this.fuse.search(command[0]).map(result => {
                const shortname = EMOJI_SHORTNAMES[result];
                const unicode = shortnameToUnicode(shortname);
                return {
                    completion: unicode,
                    component: (
                        <PillCompletion title={shortname} initialComponent={<EmojiText style={{maxWidth: '1em'}}>{unicode}</EmojiText>} />
                    ),
                    range,
                };
            }).slice(0, 8);
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
