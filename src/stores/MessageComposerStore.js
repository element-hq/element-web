/*
Copyright 2017, 2018 Vector Creations Ltd

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
import { Store } from 'flux/utils';
import { Value } from 'slate';

const INITIAL_STATE = {
    // a map of room_id to rich text editor composer state
    editorStateMap: localStorage.getItem('editor_state') ?
        JSON.parse(localStorage.getItem('editor_state')) : {},
};

/**
 * A class for storing application state to do with the message composer (specifically
 * in-progress message drafts). This is a simple
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
            case 'editor_state':
                this._editorState(payload);
                break;
            case 'on_logged_out':
                this.reset();
                break;
        }
    }

    _editorState(payload) {
        const editorStateMap = this._state.editorStateMap;
        editorStateMap[payload.room_id] = {
            editor_state: payload.editor_state,
            rich_text: payload.rich_text,
        };
        localStorage.setItem('editor_state', JSON.stringify(editorStateMap));
        this._setState({
            editorStateMap: editorStateMap,
        });
    }

    getEditorState(roomId) {
        const editorStateMap = this._state.editorStateMap;
        // const entry = this._state.editorStateMap[roomId];
        if (editorStateMap[roomId] && !Value.isValue(editorStateMap[roomId].editor_state)) {
            // rehydrate lazily to prevent massive churn at launch and cache it
            editorStateMap[roomId].editor_state = Value.fromJSON(editorStateMap[roomId].editor_state);
        }
        // explicitly don't setState here because the value didn't actually change, we just hydrated it,
        // if a listener received an update they too would call this method and have a hydrated Value
        return editorStateMap[roomId];
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
