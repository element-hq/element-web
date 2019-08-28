/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

/**
 * Used while editing, to pass the event, and to preserve editor state
 * from one editor instance to another when remounting the editor
 * upon receiving the remote echo for an unsent event.
 */
export default class EditorStateTransfer {
    constructor(event) {
        this._event = event;
        this._serializedParts = null;
        this.caret = null;
    }

    setEditorState(caret, serializedParts) {
        this._caret = caret;
        this._serializedParts = serializedParts;
    }

    hasEditorState() {
        return !!this._serializedParts;
    }

    getSerializedParts() {
        return this._serializedParts;
    }

    getCaret() {
        return this._caret;
    }

    getEvent() {
        return this._event;
    }
}
