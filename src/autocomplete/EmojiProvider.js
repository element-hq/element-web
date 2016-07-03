import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import {emojioneList, shortnameToImage, shortnameToUnicode} from 'emojione';
import Fuse from 'fuse.js';

const EMOJI_REGEX = /:\w*:?/g;
const EMOJI_SHORTNAMES = Object.keys(emojioneList);

let instance = null;

export default class EmojiProvider extends AutocompleteProvider {
    constructor() {
        super(EMOJI_REGEX);
        this.fuse = new Fuse(EMOJI_SHORTNAMES);
    }

    getCompletions(query: string, selection: {start: number, end: number}) {
        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            completions = this.fuse.search(command[0]).map(result => {
                let shortname = EMOJI_SHORTNAMES[result];
                let imageHTML = shortnameToImage(shortname);
                return {
                    completion: shortnameToUnicode(shortname),
                    component: (
                        <div className="mx_Autocomplete_Completion">
                            <span dangerouslySetInnerHTML={{__html: imageHTML}}></span> {shortname}
                        </div>
                    ),
                    range,
                };
            }).slice(0, 4);
        }
        return Q.when(completions);
    }

    getName() {
        return 'Emoji';
    }

    static getInstance() {
        if (instance == null)
            instance = new EmojiProvider();
        return instance;
    }
}
