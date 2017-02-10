import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import {emojioneList, shortnameToImage, shortnameToUnicode} from 'emojione';
import FuzzyMatcher from './FuzzyMatcher';
import sdk from '../index';
import {PillCompletion} from './Components';
import type {SelectionRange, Completion} from './Autocompleter';

const EMOJI_REGEX = /:\w*:?/g;
const EMOJI_SHORTNAMES = Object.keys(emojioneList).map(shortname => {
    return {
        shortname,
    };
});

let instance = null;

export default class EmojiProvider extends AutocompleteProvider {
    constructor() {
        super(EMOJI_REGEX);
        this.matcher = new FuzzyMatcher(EMOJI_SHORTNAMES, {
            keys: 'shortname',
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
            }).slice(0, 8);
        }
        return completions;
    }

    getName() {
        return '😃 Emoji';
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
