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
import { Value } from 'slate';

const localStoragePrefix = 'editor_state_';

/**
 * A class for storing application state to do with the message composer (specifically in-progress message drafts).
 * It does not worry about cleaning up on log out as this is handled in Lifecycle.js by localStorage.clear()
 */
class MessageComposerStore {
    constructor() {
        this.prefix = localStoragePrefix;
    }

    _getKey(roomId: string): string {
        return this.prefix + roomId;
    }

    setEditorState(roomId: string, editorState: Value, richText: boolean) {
        localStorage.setItem(this._getKey(roomId), JSON.stringify({
            editor_state: editorState,
            rich_text: richText,
        }));
    }

    getEditorState(roomId): {editor_state: Value, rich_text: boolean} {
        const stateStr = localStorage.getItem(this._getKey(roomId));

        let state;
        if (stateStr) {
            state = JSON.parse(stateStr);

            // if it does not have the fields we expect then bail
            if (!state || state.rich_text === undefined || state.editor_state === undefined) return;
            state.editor_state = Value.fromJSON(state.editor_state);
        }

        return state;
    }
}

let singletonMessageComposerStore = null;
if (!singletonMessageComposerStore) {
    singletonMessageComposerStore = new MessageComposerStore();
}
module.exports = singletonMessageComposerStore;
