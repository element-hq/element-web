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
    tags: [],
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
            case 'select_tag':
                this._setState({
                    tags: [payload.tag],
                });
                Analytics.trackEvent('FilterStore', 'select_tag');
            break;
            case 'deselect_tags':
                this._setState({
                    tags: [],
                });
                Analytics.trackEvent('FilterStore', 'deselect_tags');
            break;
        }
    }

    getSelectedTags() {
        return this._state.tags;
    }
}

if (global.singletonFilterStore === undefined) {
    global.singletonFilterStore = new FilterStore();
}
export default global.singletonFilterStore;
