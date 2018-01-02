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
import {Store} from 'flux/utils';
import dis from '../dispatcher';
import Analytics from '../Analytics';

const INITIAL_STATE = {
    allTags: [],
    selectedTags: [],
    // Last selected tag when shift was not being pressed
    anchorTag: null,
};

/**
 * A class for storing application state for filtering via TagPanel.
 */
class FilterStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = INITIAL_STATE;
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            case 'all_tags' :
                this._setState({
                    allTags: payload.tags,
                });
            break;
            case 'select_tag': {
                let newTags = [];
                // Shift-click semantics
                if (payload.shiftKey) {
                    // Select range of tags
                    let start = this._state.allTags.indexOf(this._state.anchorTag);
                    let end = this._state.allTags.indexOf(payload.tag);

                    if (start === -1) {
                        start = end;
                    }
                    if (start > end) {
                        const temp = start;
                        start = end;
                        end = temp;
                    }
                    newTags = payload.ctrlOrCmdKey ? this._state.selectedTags : [];
                    newTags = [...new Set(
                        this._state.allTags.slice(start, end + 1).concat(newTags),
                    )];
                } else {
                    if (payload.ctrlOrCmdKey) {
                        // Toggle individual tag
                        if (this._state.selectedTags.includes(payload.tag)) {
                            newTags = this._state.selectedTags.filter((t) => t !== payload.tag);
                        } else {
                            newTags = [...this._state.selectedTags, payload.tag];
                        }
                    } else {
                        // Select individual tag
                        newTags = [payload.tag];
                    }
                    // Only set the anchor tag if the tag was previously unselected, otherwise
                    // the next range starts with an unselected tag.
                    if (!this._state.selectedTags.includes(payload.tag)) {
                        this._setState({
                            anchorTag: payload.tag,
                        });
                    }
                }

                this._setState({
                    selectedTags: newTags,
                });

                Analytics.trackEvent('FilterStore', 'select_tag');
            }
            break;
            case 'deselect_tags':
                this._setState({
                    selectedTags: [],
                });
                Analytics.trackEvent('FilterStore', 'deselect_tags');
            break;
        }
    }

    getSelectedTags() {
        return this._state.selectedTags;
    }
}

if (global.singletonFilterStore === undefined) {
    global.singletonFilterStore = new FilterStore();
}
export default global.singletonFilterStore;
