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
import dis from '../dispatcher';
import {Store} from 'flux/utils';
import {convertToRaw, convertFromRaw} from 'draft-js';

const INITIAL_STATE = {
    editorStateMap: localStorage.getItem('content_state') ?
        JSON.parse(localStorage.getItem('content_state')) : {},
};

/**
 * A class for storing application state to do with the message composer. This is a simple
 * flux store that listens for actions and updates its state accordingly, informing any
 * listeners (views) of state changes.
 */
class MessageComposerStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = Object.assign({}, INITIAL_STATE);
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            case 'content_state':
                this._contentState(payload);
                break;
            case 'on_logged_out':
                this.reset();
                break;
        }
    }

    _contentState(payload) {
        const editorStateMap = this._state.editorStateMap;
        editorStateMap[payload.room_id] = convertToRaw(payload.content_state);
        localStorage.setItem('content_state', JSON.stringify(editorStateMap));
        this._setState({
            editorStateMap: editorStateMap,
        });
    }

    getContentState(roomId) {
        return this._state.editorStateMap[roomId] ?
            convertFromRaw(this._state.editorStateMap[roomId]) : null;
    }

    reset() {
        this._state = Object.assign({}, INITIAL_STATE);
    }
}

let singletonMessageComposerStore = null;
if (!singletonMessageComposerStore) {
    singletonMessageComposerStore = new MessageComposerStore();
}
module.exports = singletonMessageComposerStore;
