import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import {emojioneList, shortnameToImage} from 'emojione';
import Fuse from 'fuse.js';

const EMOJI_REGEX = /:\w*:?/g;
const EMOJI_SHORTNAMES = Object.keys(emojioneList);

export default class EmojiProvider extends AutocompleteProvider {
    constructor() {
        super();
        console.log(EMOJI_SHORTNAMES);
        this.fuse = new Fuse(EMOJI_SHORTNAMES);
    }

    getCompletions(query: String) {
        let completions = [];
        const matches = query.match(EMOJI_REGEX);
        console.log(matches);
        if(!!matches) {
            const command = matches[0];
            completions = this.fuse.search(command).map(result => {
                let shortname = EMOJI_SHORTNAMES[result];
                let imageHTML = shortnameToImage(shortname);
                return {
                    title: shortname,
                    component: (
                        <div className="mx_Autocomplete_Completion">
                            <span dangerouslySetInnerHTML={{__html: imageHTML}}></span> {shortname}
                        </div>
                    )
                };
            }).slice(0, 4);
        }
        return Q.when(completions);
    }

    getName() {
        return 'Emoji';
    }
}
